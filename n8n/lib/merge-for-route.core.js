/**
 * Pure logic for Prepare Route Body (chat-orchestrator).
 * Used by unit tests; bundled into n8n Code node via build-workflows.mjs.
 */
export function buildRouteRequest(ctx, items) {
  let historyItems = [];
  let installations = { items: [] };
  let knowledge = { items: [] };

  for (const j of items) {
    if (Array.isArray(j.items) && j.items[0]?.role) historyItems = j.items;
    else if (Array.isArray(j.items) && j.items[0]?.connectorKey !== undefined) installations = j;
    else if (Array.isArray(j.items)) knowledge = j;
  }

  const messages = (historyItems || [])
    .filter((m) => m.role && m.content)
    .map((m) => ({ role: m.role, content: m.content }));

  const activeConnectorKeys = [];
  for (const inst of installations.items || []) {
    const st = inst.status || '';
    if (st === 'active' || st === 'error') activeConnectorKeys.push(inst.connectorKey);
  }

  const knowledgeContext = (knowledge.items || [])
    .slice(0, 5)
    .map((h) => `- ${h.title || 'doc'}: ${h.snippet || ''}`)
    .join('\n');

  return {
    ...ctx,
    routeRequest: {
      message: ctx.message,
      messages,
      activeConnectorKeys,
      knowledgeContext: knowledgeContext || null,
    },
  };
}
