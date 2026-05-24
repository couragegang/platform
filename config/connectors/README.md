# MCP connector runtime (platform)

Реестр портов и URL для docker compose — **канон** в [`api-contracts`](../../../services/api-contracts/mcp-connectors/docs/connector-ports.md) (`mcp-connectors/docs/connector-ports.md`).

| connectorKey | compose service | host port | runtime_base_url (internal) |
|--------------|-----------------|-----------|-----------------------------|
| notion | mcp-notion | 8091 | `http://mcp-notion:8091/v1/notion` |

Сервис `mcp-notion` добавляется в `docker-compose.yml` в **фазе 1** плана n8n/MCP refactor.
