/**
 * Plan HITL (ADR-003 phase B): when to pause before Run Connector Chain.
 */

/** @param {object} plan */
export function requiresPlanApproval(plan) {
  if (!plan) return false;
  if (plan.requiresPlanApproval === true) return true;
  const steps = plan.steps || [];
  if (steps.length < 2) return false;
  const keys = new Set(steps.map((s) => (s.connectorKey || '').toLowerCase()).filter(Boolean));
  return keys.size >= 2 || steps.length >= 2;
}

/** @param {object} plan @param {object} ctx */
export function buildPlanPendingBody(plan, ctx) {
  const steps = plan.steps || [];
  return {
    orgId: ctx.orgId,
    workspaceId: ctx.workspaceId,
    requestedByUserId: ctx.userId || undefined,
    agentRunId: ctx.runId,
    approvalKind: 'plan',
    toolName: 'connector_plan',
    toolArguments: {
      mode: plan.mode || 'connector_chain',
      steps,
      reasoning: plan.reasoning || null,
    },
    plannedSteps: steps,
  };
}

/** @param {object} pending */
export function extractApprovedPlan(pending) {
  if (!pending || pending.status !== 'approved') return null;
  const kind = pending.approvalKind || (pending.toolName === 'connector_plan' ? 'plan' : 'tool');
  if (kind !== 'plan') return null;
  const args = pending.toolArguments || {};
  const steps = pending.plannedSteps || args.steps || [];
  if (!steps.length) return null;
  return {
    mode: args.mode || 'connector_chain',
    steps,
    reasoning: args.reasoning || null,
  };
}
