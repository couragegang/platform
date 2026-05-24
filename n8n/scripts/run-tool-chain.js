// Sequential calls to chat-tool-step sub-workflow (separate n8n pipeline per step).
const env = typeof $env !== 'undefined' ? $env : process.env;
const toolStepUrl =
  env.N8N_TOOL_STEP_WEBHOOK_URL || 'http://n8n:5678/webhook/chat-tool-step';

const ctx = $('Parse Context').first().json;
const plan = $('LLM Route').first().json;
const steps = plan.steps || [];

if (!steps.length) {
  return [{ json: { skipped: true, reason: 'no steps' } }];
}

const priorResults = [];
for (let i = 0; i < steps.length; i++) {
  const step = steps[i];
  const res = await this.helpers.httpRequest({
    method: 'POST',
    url: toolStepUrl,
    json: true,
    body: {
      ...ctx,
      step,
      stepIndex: i + 1,
      totalSteps: steps.length,
      priorResults,
    },
  });

  if (res.action === 'complete') {
    return [{ json: { completedInStep: true, callback: res.callback, stepIndex: i + 1 } }];
  }

  priorResults.push({
    stepIndex: i + 1,
    connectorKey: step.connectorKey,
    toolName: step.toolName,
    label: step.label,
    ok: res.stepResult?.ok,
    summary: res.stepResult?.summary,
    error: res.stepResult?.error,
  });
}

return [{ json: { completedInStep: false, priorResults, plan } }];
