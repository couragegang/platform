import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPlanPendingBody,
  extractApprovedPlan,
  requiresPlanApproval,
} from '../../core/plan-approval.core.js';

describe('requiresPlanApproval', () => {
  it('returns true for explicit flag', () => {
    assert.equal(requiresPlanApproval({ requiresPlanApproval: true, steps: [] }), true);
  });

  it('returns true for two steps', () => {
    assert.equal(
      requiresPlanApproval({
        mode: 'connector_chain',
        steps: [{ connectorKey: 'notion' }, { connectorKey: 'notion' }],
      }),
      true,
    );
  });

  it('returns false for single step', () => {
    assert.equal(
      requiresPlanApproval({ mode: 'connector_chain', steps: [{ connectorKey: 'notion' }] }),
      false,
    );
  });
});

describe('buildPlanPendingBody', () => {
  it('includes planned steps and approvalKind plan', () => {
    const body = buildPlanPendingBody(
      {
        mode: 'connector_chain',
        steps: [{ connectorKey: 'notion', label: 'A' }, { connectorKey: 'trello', label: 'B' }],
      },
      { orgId: 'o1', workspaceId: 'w1', runId: 'r1' },
    );
    assert.equal(body.approvalKind, 'plan');
    assert.equal(body.plannedSteps.length, 2);
  });
});

describe('extractApprovedPlan', () => {
  it('reads plan from approved pending', () => {
    const plan = extractApprovedPlan({
      status: 'approved',
      approvalKind: 'plan',
      plannedSteps: [{ connectorKey: 'notion', task: { message: 'x' } }],
      toolArguments: { mode: 'connector_chain' },
    });
    assert.equal(plan.steps.length, 1);
  });
});
