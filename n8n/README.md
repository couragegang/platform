# n8n (фаза 2–3)

Self-hosted оркестратор чата (образ **≥ 1.121.0**).

## VPS (test / prod)

**Отдельный CI:** [`.github/workflows/deploy-n8n.yml`](../.github/workflows/deploy-n8n.yml) — push в `n8n/**`, `docker/n8n/**` или **Actions → Deploy n8n to VPS**.

Образ `ghcr.io/<owner>/n8n:<sha>-test|prod` ([`docker/n8n/Dockerfile`](../docker/n8n/Dockerfile)). Полный **Deploy to VPS** n8n **не** собирает (только BC-стек).

Workflow из `n8n/workflows/*.json` импортируются при **первом** старте volume (`n8n import:workflow`). После деплоя проверьте в UI, что оба workflow **Active**.

Порты: test **15678**, prod **5678** (см. [`deploy/vps/README.md`](../deploy/vps/README.md)).

**UI через nginx (test):** `https://ai-test.valoriel.ru/n8n/` — location в [`deploy/vps/nginx-ai-test.valoriel.ru.server.conf`](../deploy/vps/nginx-ai-test.valoriel.ru.server.conf); в baked env при `VPS_PUBLIC_BASE_URL` задаются `N8N_PATH=/n8n/`, `N8N_EDITOR_BASE_URL`, `WEBHOOK_URL`. Внутренние вызовы `ai-runtime` → `http://n8n:5678/webhook/...` не меняются.

## Почему два workflow (оба нужно импортировать)

В n8n **один workflow = один webhook path**. У нас два разных HTTP-входа:

| Workflow | Кто вызывает | Зачем отдельно |
|----------|--------------|----------------|
| `chat-orchestrator` | `ai-runtime` (`N8N_WEBHOOK_URL`) | Сессия, маршрут DeepSeek, resume HITL, цикл по цепочке tools |
| `chat-tool-step` | orchestrator (`N8N_TOOL_STEP_WEBHOOK_URL`, HTTP из ноды Run Tool Chain) | **Ровно один** tool: policy → HITL / deny / MCP |

Объединить в один JSON нельзя без потери модели «отдельный пайплайн на шаг»: orchestrator для N tools делает N POST на `/webhook/chat-tool-step` — так проще отладка, таймауты и повтор шага. Оба файла кладутся в образ n8n (`/opt/workflows/*.json`); entrypoint импортирует **все** `*.json` при первом старте volume.

## Два workflow

| Файл | Webhook | Назначение |
|------|---------|------------|
| [`workflows/chat-orchestrator-v0.json`](workflows/chat-orchestrator-v0.json) | `/webhook/chat-orchestrator` | Маршрутизация DeepSeek, цепочка шагов, LLM-ответ |
| [`workflows/chat-tool-step.json`](workflows/chat-tool-step.json) | `/webhook/chat-tool-step` | **Один** tool: policy → HITL / MCP invoke |

Цепочка из N tools = N последовательных вызовов `chat-tool-step` из orchestrator.

## Схема (визуальные ноды)

```
chat-orchestrator:
  Webhook → Parse Context → IF HITL Resume? → …
         → Load History / Installations / Knowledge → LLM Route
         → IF Tool Chain? → Run Tool Chain (HTTP × N → chat-tool-step)
         → Summarize / LLM Chat → Callback ai-runtime

chat-tool-step (на каждый шаг):
  Webhook → Parse Step Context → IF Valid?
         → Policy Evaluate → IF Require Approval? → Format Approval → Callback → Return Complete
         → IF Deny? → Format Denied → Callback → Return Complete
         → MCP Invoke → Return Continue
```

## Сборка JSON

```bash
node platform/n8n/scripts/build-workflows.mjs
```

Скрипты: [`scripts/`](scripts/) — orchestrator: `parse-context.js`, `merge-for-route.js`, `run-tool-chain.js`, …; tool-step: `tool-step-parse.js`, `tool-step-build-error.js`, `tool-step-return-*.js`.

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
