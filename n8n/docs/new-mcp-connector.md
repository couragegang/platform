# n8n: workflow `chat-connector-{key}` (L2)

Часть полного чеклиста: **[`cursor-context/docs/how-to-add-mcp-connector.md`](../../../cursor-context/docs/how-to-add-mcp-connector.md)** (BC, gateway, compose, ai-runtime).

ADR: [`adr-003-n8n-connector-sub-orchestrators.md`](../../../cursor-context/docs/adr-003-n8n-connector-sub-orchestrators.md).

---

## Когда нужен L2

Добавляйте `chat-connector-{key}`, если коннектор:

- имеет **несколько** internal tools (search → write → …);
- требует **enrich** аргументов из `priorResults`;
- не должен раздувать generic `chat-tool-step` ветками `if (connector === '…')`.

Коннектор **без** L2 остаётся на прямом вызове `chat-tool-step` из L1 (`run-connector-chain` fallback для неизвестных keys).

---

## 1. Модули `connectors/{key}/`

```
connectors/{key}/
  {key}-task.core.js       # task.message, inputsFromPrior, constraints → tool args
  {key}-router.core.js     # task → [{ toolName, arguments, label }, …]
scripts/
  connector-{key}-parse.runner.js   # webhook → internalSteps
  connector-{key}-run.runner.js     # loop tool-step или mock
tests/connectors/{key}/
```

**Эталоны:** `connectors/notion/`, `connectors/trello/`.

### parse-runner

- Вход: тело от L1 (`step`, `stepIndex`, `priorResults`, session ids).
- Выход: `{ valid, internalSteps[], toolStepUrl, … }` или `{ valid: false, error }`.

### run-runner

- Для каждого internal step: `POST /webhook/chat-tool-step` с `{ connectorKey, toolName, arguments }`.
- Обработка `action: awaiting_approval` → проброс `complete` callback в ai-runtime.
- Агрегация `summary`, `artifacts` для следующего шага L1.
- **Mock:** env `{KEY}_CONNECTOR_MOCK=true` — без HTTP к MCP (см. Slack).

---

## 2. Сборка workflow

В [`scripts/build-workflows.mjs`](../scripts/build-workflows.mjs):

1. `bundleN8nCode` для parse/run runners.
2. Константа `connector{Key}` по образцу `connectorSlack` / `connectorNotion`.
3. `fs.writeFileSync(…/chat-connector-{key}.json)`.

| Поле | Значение |
|------|----------|
| `id` | уникальный, напр. `cgChatConnSlack01` |
| `name` | `chat-connector-{key}` |
| webhook `path` | `chat-connector-{key}` |

Узлы: **Webhook** → **Parse Connector Task** → **IF Valid Task?** → **Run Internal Tools** / **Build Connector Error**.

```bash
cd platform/n8n
npm run build
npm test
npm run validate
```

Добавить JSON в [`tests/build-sync.test.js`](../tests/build-sync.test.js).

---

## 3. L1 — регистрация webhook

[`core/run-connector-chain.core.js`](../core/run-connector-chain.core.js):

```js
const CONNECTOR_WEBHOOKS = {
  notion: 'chat-connector-notion',
  trello: 'chat-connector-trello',
  {key}: 'chat-connector-{key}',
};
```

---

## 4. Docker entrypoint (managed workflows)

Обновить **все** места со списком имён/id:

| Файл | Что добавить |
|------|----------------|
| [`docker/n8n/entrypoint.sh`](../../docker/n8n/entrypoint.sh) | `MANAGED_IDS`, duplicate cleanup, `managed_workflows_present` count |
| [`docker/n8n/purge-managed-workflows.sh`](../../docker/n8n/purge-managed-workflows.sh) | `MANAGED_NAMES` |
| [`scripts/validate-workflows.mjs`](../scripts/validate-workflows.mjs) | `WORKFLOW_SPECS` |
| [`README.md`](../README.md) | таблица workflow |

После деплоя образа n8n: bundle hash меняется → auto re-import. Принудительно: `FORCE_WORKFLOW_REIMPORT=1`.

---

## 5. ai-runtime (после L2)

В [`OrchestratorToolCatalog`](../../../services/ai-runtime/src/main/java/com/couragegang/ai/service/OrchestratorToolCatalog.java):

- `CONNECTOR_WORKFLOW_KEYS` += `{key}`;
- `connectorCapabilities` — описание для router;
- `toolsForConnectors` — tools для **step HITL** (не для L1 prompt).

---

## 6. Контракт L1 → L2 (webhook body)

```json
{
  "runId": "uuid",
  "orgId": "uuid",
  "workspaceId": "uuid",
  "userId": "uuid",
  "step": {
    "connectorKey": "{key}",
    "task": {
      "message": "намерение пользователя для этого коннектора",
      "constraints": {},
      "inputsFromPrior": ["notion.summary", "notion.artifacts.page_url"]
    },
    "label": "Краткая подпись шага",
    "skipIf": null,
    "onFailure": "continue"
  },
  "stepIndex": 1,
  "totalSteps": 2,
  "priorResults": []
}
```

**Ответ L2 → L1:**

```json
{
  "action": "continue",
  "ok": true,
  "summary": "текст для цепочки",
  "artifacts": { },
  "stepResult": { "ok": true, "summary": "…" }
}
```

| `action` | Значение |
|----------|----------|
| `continue` | Шаг завершён, L1 идёт дальше |
| `complete` | Весь run завершён внутри шага (callback уже отправлен) |

При `ok: false` L1 применяет `onFailure`: `abort` | `continue` | `skip_remaining` ([`plan-branching.core.js`](../core/plan-branching.core.js)).

---

## 7. Ветвление плана (L1)

Поля шага в JSON от router (не в n8n-коде L2):

| Поле | Примеры |
|------|---------|
| `skipIf` | `priorFailed`, `priorOk:0`, `priorConnector:notion.failed` |
| `onFailure` | `continue`, `abort`, `skip_remaining` |

---

## 8. Чеклист L2

- [ ] `connectors/{key}/*.core.js` + runners + tests
- [ ] `build-workflows.mjs` + `chat-connector-{key}.json` в repo
- [ ] `CONNECTOR_WEBHOOKS` + entrypoint/purge/validate/build-sync
- [ ] `OrchestratorToolCatalog` + `CONNECTOR_WORKFLOW_KEYS`
- [ ] При готовом `mcp-{key}`: убрать mock, run → `chat-tool-step` → gateway
- [ ] `npm test` green
