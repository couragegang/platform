# n8n (фаза 2–3)

Self-hosted оркестратор чата (образ **≥ 1.121.0**).

## VPS (test / prod)

**Отдельный CI:** [`.github/workflows/deploy-n8n.yml`](../.github/workflows/deploy-n8n.yml) — push в `n8n/**`, `docker/n8n/**` или **Actions → Deploy n8n to VPS**.

Образ `ghcr.io/<owner>/n8n:<sha>-test|prod` ([`docker/n8n/Dockerfile`](../docker/n8n/Dockerfile)). Полный **Deploy to VPS** n8n **не** собирает (только BC-стек).

Workflow из `/opt/workflows/*.json` **импортируются только при изменении** файлов в образе (sha256 bundle → `~/.n8n/.workflows-bundle.sha256`). Обычный `docker compose restart n8n` **не** пересоздаёт workflow — сохраняются executions/статистика. При деплое нового образа с другими JSON — один re-import (id `cgChatOrchestr01`, `cgChatToolStp01`, `cgChatConnNot01`, `cgChatConnSlack01`, update in place). Дубликаты по имени удаляются без purge. Принудительно: `FORCE_WORKFLOW_REIMPORT=1` (полный purge + import).

Порты: test **15678**, prod **5678** (см. [`deploy/vps/README.md`](../deploy/vps/README.md)).

**UI через nginx (test):** `https://ai-test.valoriel.ru/n8n/` — location в [`deploy/vps/nginx-ai-test.valoriel.ru.server.conf`](../deploy/vps/nginx-ai-test.valoriel.ru.server.conf); baked env по контуру (`ai-test.valoriel.ru`, не `VPS_PUBLIC_BASE_URL`).

## Почему три workflow

В n8n **один workflow = один webhook path**:

| Workflow | Кто вызывает | Зачем отдельно |
|----------|--------------|----------------|
| `chat-orchestrator` | `ai-runtime` (`N8N_WEBHOOK_URL`) | Сессия, маршрут DeepSeek, resume HITL, цепочка шагов |
| `chat-connector-notion` | orchestrator (шаги Notion) | Mini-router + enrich; внутри N× `chat-tool-step` |
| `chat-tool-step` | connector / прочие коннекторы | **Один** tool: policy → HITL / MCP (без Notion-логики) |

Все `workflows/*.json` в образе n8n; entrypoint импортирует при смене bundle sha256.

## Workflows (текущее и целевое)

| Файл | Webhook | Назначение |
|------|---------|------------|
| [`workflows/chat-orchestrator-v0.json`](workflows/chat-orchestrator-v0.json) | `/webhook/chat-orchestrator` | Маршрутизация DeepSeek, цепочка шагов, LLM-ответ (webhook **onReceived** — ответ сразу, результат через callback в ai-runtime) |
| [`workflows/chat-tool-step.json`](workflows/chat-tool-step.json) | `/webhook/chat-tool-step` | **Один** tool: policy → HITL / MCP invoke (generic) |
| [`workflows/chat-connector-notion.json`](workflows/chat-connector-notion.json) | `/webhook/chat-connector-notion` | **ADR-003 фаза A:** task/toolName → mini-router → внутренние tool-step |

Orchestrator: `Run Connector Chain` → `chat-connector-{key}` (notion, trello); неизвестные коннекторы → `chat-tool-step`. **Фазы B–D:** plan HITL, ветвление, L1 без tool-эвристик.

- ADR: [`cursor-context/docs/adr-003-n8n-connector-sub-orchestrators.md`](../../cursor-context/docs/adr-003-n8n-connector-sub-orchestrators.md)
- **Новый MCP (полный чеклист):** [`cursor-context/docs/how-to-add-mcp-connector.md`](../../cursor-context/docs/how-to-add-mcp-connector.md)
- **Только n8n L2:** [`docs/new-mcp-connector.md`](docs/new-mcp-connector.md)

## Схема (визуальные ноды)

```
chat-orchestrator:
  Webhook → Parse Context → IF HITL Resume? → …
         → Load History / Installations / Knowledge → LLM Route
         → IF Tool Chain? → Run Connector Chain (Notion → chat-connector-notion; иначе chat-tool-step)
         → Summarize / LLM Chat → Callback ai-runtime

chat-tool-step (на каждый шаг):
  Webhook → Parse Step Context → IF Valid?
         → Policy Evaluate → IF Require Approval? → Format Approval → Callback → Return Complete
         → IF Deny? → Format Denied → Callback → Return Complete
         → MCP Invoke → Return Continue
```

## Сборка JSON

```bash
cd platform/n8n
npm test          # unit + static validation + drift check
npm run build     # regenerate workflows/*.json
node scripts/build-workflows.mjs
```

Скрипты: [`scripts/`](scripts/) — orchestrator: `parse-context.js`, `lib/merge-for-route.core.js`, `run-tool-chain.js`, …; tool-step: `tool-step-parse.js`, …

**Тесты:** [`tests/`](tests/) — pure-функции Code nodes + статическая проверка JSON (expressions, Merge nodes, connections). CI: [`.github/workflows/n8n-workflow-tests.yml`](../.github/workflows/n8n-workflow-tests.yml).

## Импорт

1. Импортировать **оба** JSON в n8n.
2. **Activate** оба workflow.
3. `docker compose up -d --build ai n8n`

## Env

```env
AI_ORCHESTRATOR=n8n
AI_N8N_ENABLED=true
N8N_WEBHOOK_URL=http://n8n:5678/webhook/chat-orchestrator
N8N_TOOL_STEP_WEBHOOK_URL=http://n8n:5678/webhook/chat-tool-step
AI_INTERNAL_API_KEY=dev-internal-key
POLICY_INTERNAL_API_KEY=dev-internal-key
MCP_INTERNAL_API_KEY=dev-internal-key
```

Контракты: [`api-contracts/ai/orchestrator.yaml`](../../services/api-contracts/ai/orchestrator.yaml).
