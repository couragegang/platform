// Parse webhook body + env for one tool step in a chain.
const env = typeof $env !== 'undefined' ? $env : process.env;
const body = $input.first().json.body || $input.first().json;

const aiBase = env.N8N_AI_BASE_URL || 'http://ai:8083/v1/ai';
const mcpBase = env.N8N_MCP_BASE_URL || 'http://mcp:8081/v1/mcp';
const policyBase = env.N8N_POLICY_BASE_URL || 'http://policy:8085/v1/policy';
const aiKey = env.AI_INTERNAL_API_KEY || 'dev-internal-key';
const policyKey = env.POLICY_INTERNAL_API_KEY || 'dev-internal-key';
const mcpKey = env.MCP_INTERNAL_API_KEY || 'dev-internal-key';

const step = body.step;
const stepIndex = body.stepIndex || 1;
const totalSteps = body.totalSteps || 1;
const priorResults = body.priorResults || [];

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
};

if (!step?.connectorKey || !step?.toolName) {
  return [{ json: { ...base, valid: false, error: 'Invalid tool step payload' } }];
}

const toolArgs = enrichWriteArguments(step.toolName, step.arguments || {}, priorResults);
return [
  {
    json: {
      ...base,
      valid: true,
      step: {
        connectorKey: step.connectorKey,
        toolName: step.toolName,
        arguments: toolArgs,
      },
      fmtBody: {
        connectorKey: step.connectorKey,
        toolName: step.toolName,
        arguments: toolArgs,
        stepIndex,
        totalSteps,
      },
    },
  },
];
