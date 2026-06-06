// Parse connector webhook + plan internal Notion tool steps.
const env = typeof $env !== 'undefined' ? $env : process.env;
const body = $input.first().json.body || $input.first().json;

const aiBase = env.N8N_AI_BASE_URL || 'http://ai:8083/v1/ai';
const mcpBase = env.N8N_MCP_BASE_URL || 'http://mcp:8081/v1/mcp';
const policyBase = env.N8N_POLICY_BASE_URL || 'http://policy:8085/v1/policy';
const aiKey = env.AI_INTERNAL_API_KEY || 'dev-internal-key';
const policyKey = env.POLICY_INTERNAL_API_KEY || 'dev-internal-key';
const mcpKey = env.MCP_INTERNAL_API_KEY || 'dev-internal-key';
const toolStepUrl = env.N8N_TOOL_STEP_WEBHOOK_URL || 'http://n8n:5678/webhook/chat-tool-step';

const step = body.step;
const priorResults = body.priorResults || [];
const stepIndex = body.stepIndex || 1;
const totalSteps = body.totalSteps || 1;

const base = {
  orgId: body.orgId,
  workspaceId: body.workspaceId,
  userId: body.userId,
  runId: body.runId,
  stepIndex,
  totalSteps,
  aiBase,
  mcpBase,
  policyBase,
  aiKey,
  policyKey,
  mcpKey,
  toolStepUrl,
};

if (!step?.connectorKey || step.connectorKey !== 'notion') {
  return [{ json: { ...base, valid: false, error: 'Invalid Notion connector step' } }];
}

const userMessage = body.message || '';
const stepWithUserMessage =
  userMessage && !step?.userMessage
    ? { ...step, userMessage }
    : step;
const internalSteps = resolveNotionInternalSteps(stepWithUserMessage, priorResults);
if (!internalSteps.length) {
  return [{ json: { ...base, valid: false, error: 'Could not resolve Notion tools for task' } }];
}

return [
  {
    json: {
      ...base,
      valid: true,
      priorResults,
      internalSteps,
      connectorLabel: step.label || 'Notion',
    },
  },
];
