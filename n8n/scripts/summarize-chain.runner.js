// n8n Code node entry (bundled with summarize-chain.core.js at build time).
const ctx = $('Parse Context').first().json;
const chain = $input.first().json;
const env = typeof $env !== 'undefined' ? $env : process.env;
const aiBase = env.N8N_AI_BASE_URL || 'http://ai:8083/v1/ai';
const aiKey = env.AI_INTERNAL_API_KEY || 'dev-internal-key';

const prior = chain.priorResults || [];

if (shouldUseDirectSummary(prior)) {
  return [
    {
      json: {
        status: 'completed',
        reply: buildDirectReply(prior),
        runId: ctx.runId,
        aiBase: ctx.aiBase,
        aiKey: ctx.aiKey,
      },
    },
  ];
}

const historyNode = $('Merge for Route').first().json.routeRequest?.messages || [];

const llm = await this.helpers.httpRequest({
  method: 'POST',
  url: `${aiBase}/internal/llm/complete`,
  headers: { 'X-Ai-Internal-Key': aiKey, 'Content-Type': 'application/json' },
  json: true,
  body: {
    messages: historyNode,
    mcpContext: buildSummarizeContext(prior),
    workspaceId: String(ctx.workspaceId),
  },
});

return [
  {
    json: {
      status: llm.status || 'completed',
      reply: finalizeChainReply(prior, llm.reply || ''),
      runId: ctx.runId,
      aiBase: ctx.aiBase,
      aiKey: ctx.aiKey,
    },
  },
];
