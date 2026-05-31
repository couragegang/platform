# MCP connector runtime (platform)

Реестр портов и URL для docker compose — **канон** в [`api-contracts/mcp-connectors/docs/connector-ports.md`](../../../services/api-contracts/mcp-connectors/docs/connector-ports.md).

**Как добавить новый коннектор end-to-end:** [`cursor-context/docs/how-to-add-mcp-connector.md`](../../../cursor-context/docs/how-to-add-mcp-connector.md).

| connectorKey | compose service | host port | runtime_base_url (internal) | n8n L2 |
|--------------|-----------------|-----------|---------------------------|--------|
| notion | mcp-notion | 8091 | `http://mcp-notion:8091/v1/notion` | `chat-connector-notion` |
| trello | mcp-trello | 8092 | `http://mcp-trello:8092/v1/trello` | `chat-connector-trello` |

Сервисы `mcp-{key}` добавляются в [`docker-compose.yml`](../../docker-compose.yml) и в Flyway seed `mcp-gateway` (`runtime_base_url`).
