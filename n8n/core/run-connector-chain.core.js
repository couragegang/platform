/**
 * Orchestrator L1: resolve webhook URL per connector and map connector responses.
 */

import {
  evaluateSkipIf,
  handleStepFailure,
  skippedStepResult,
} from './plan-branching.core.js';

const CONNECTOR_WEBHOOKS = {
  notion: 'chat-connector-notion',
  trello: 'chat-connector-trello',
};

/** @param {string} connectorKey */
export function connectorWebhookPath(connectorKey) {
  const key = (connectorKey || '').toLowerCase();
  return CONNECTOR_WEBHOOKS[key] || null;
}

export function registeredConnectorKeys() {
  return Object.keys(CONNECTOR_WEBHOOKS);
}

/**
 * @param {{ connectorKey?: string }} step
 * @param {Record<string, string>} env
 */
export function resolveStepWebhookUrl(step, env) {
  const path = connectorWebhookPath(step?.connectorKey);
  if (path) {
    const base =
      env.N8N_CONNECTOR_WEBHOOK_BASE_URL ||
      env.N8N_PUBLIC_WEBHOOK_URL ||
      'http://n8n:5678';
    const normalized = base.replace(/\/$/, '');
    return `${normalized}/webhook/${path}`;
  }
  return env.N8N_TOOL_STEP_WEBHOOK_URL || 'http://n8n:5678/webhook/chat-tool-step';
}

/** @param {object} res @param {object} step @param {number} stepIndex */
export function mapConnectorResultToPrior(res, step, stepIndex) {
  const inner = res.stepResult || {};
  return {
    stepIndex,
    connectorKey: step.connectorKey,
    toolName: res.toolName || inner.toolName || step.toolName,
    label: step.label,
    ok: res.ok !== false && inner.ok !== false,
    summary: res.summary || inner.summary,
    error: res.error || inner.error,
    artifacts: res.artifacts,
  };
}

/** @param {object} plan */
export function planHasRunnableSteps(plan) {
  const mode = plan?.mode;
  const steps = plan?.steps || [];
  if (!steps.length) return false;
  return mode === 'tool_chain' || mode === 'connector_chain';
}

/**
 * @param {object} ctx
 * @param {object} plan
 * @param {Record<string, string>} env
 * @param {(url: string, body: object) => Promise<object>} httpPost
 */
export async function executeConnectorChain(ctx, plan, env, httpPost) {
  const steps = plan.steps || [];
  const priorResults = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepIndex = i + 1;

    if (evaluateSkipIf(step.skipIf, priorResults)) {
      priorResults.push(skippedStepResult(step, stepIndex));
      continue;
    }

    const url = resolveStepWebhookUrl(step, env);
    const res = await httpPost(url, {
      ...ctx,
      step,
      stepIndex,
      totalSteps: steps.length,
      priorResults,
    });

    if (res.action === 'complete') {
      return { completedInStep: true, callback: res.callback, stepIndex, priorResults, plan };
    }

    const mapped = mapConnectorResultToPrior(res, step, stepIndex);
    priorResults.push(mapped);

    if (mapped.ok === false) {
      const failure = handleStepFailure(mapped, step.onFailure);
      if (failure.action === 'abort') {
        return {
          completedInStep: false,
          aborted: true,
          error: failure.error,
          priorResults,
          plan,
        };
      }
      if (failure.action === 'skip_remaining') {
        return { completedInStep: false, priorResults, plan, skippedRemaining: true };
      }
    }
  }

  return { completedInStep: false, priorResults, plan };
}
