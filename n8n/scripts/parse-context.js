const env = typeof $env !== 'undefined' ? $env : process.env;
const body = $input.first().json.body || $input.first().json;
return [{
  json: {
    runId: body.runId,
    conversationId: body.conversationId,
    orgId: body.orgId,
    workspaceId: body.workspaceId,
    userId: body.userId,
    message: body.message || '',
    approvedPendingApprovalId: body.approvedPendingApprovalId || null,
    aiBase: env.N8N_AI_BASE_URL || 'http://ai:8083/v1/ai',
    mcpBase: env.N8N_MCP_BASE_URL || 'http://mcp:8081/v1/mcp',
    policyBase: env.N8N_POLICY_BASE_URL || 'http://policy:8085/v1/policy',
    knowledgeBase: env.N8N_KNOWLEDGE_BASE_URL || 'http://knowledge:8088/v1/knowledge',
    aiKey: env.AI_INTERNAL_API_KEY || 'dev-internal-key',
    policyKey: env.POLICY_INTERNAL_API_KEY || 'dev-internal-key',
    mcpKey: env.MCP_INTERNAL_API_KEY || 'dev-internal-key',
  },
}];
