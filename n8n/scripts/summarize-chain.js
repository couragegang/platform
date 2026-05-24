const ctx = $('Parse Context').first().json;
const chain = $input.first().json;
const env = typeof $env !== 'undefined' ? $env : process.env;
const aiBase = env.N8N_AI_BASE_URL || 'http://ai:8083/v1/ai';
const aiKey = env.AI_INTERNAL_API_KEY || 'dev-internal-key';

const prior = chain.priorResults || [];
const lines = prior.map(
  (r, i) =>
    `Шаг ${r.stepIndex}: ${r.label || r.toolName} — ${r.ok ? r.summary : 'ошибка: ' + (r.error || '')}`,
);

const extra =
  'Результаты выполненных инструментов:\n' +
  lines.join('\n') +
  '\n\nСформируй краткий ответ пользователю на основе этих результатов.';

const historyNode = $('Merge for Route').first().json.routeRequest?.messages || [];

const llm = await this.helpers.httpRequest({
  method: 'POST',
  url: `${aiBase}/internal/llm/complete`,
  headers: { 'X-Ai-Internal-Key': aiKey, 'Content-Type': 'application/json' },
  json: true,
  body: {
    messages: historyNode,
    mcpContext: extra,
    workspaceId: String(ctx.workspaceId),
  },
});

return [
  {
    json: {
      status: llm.status || 'completed',
      reply: llm.reply || '',
      runId: ctx.runId,
      aiBase: ctx.aiBase,
      aiKey: ctx.aiKey,
    },
  },
];
