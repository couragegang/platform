import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  anyPriorFailed,
  evaluateSkipIf,
  handleStepFailure,
  skippedStepResult,
} from '../../core/plan-branching.core.js';

describe('plan-branching', () => {
  it('anyPriorFailed detects failed non-skipped steps', () => {
    assert.equal(anyPriorFailed([{ ok: true }, { ok: false }]), true);
    assert.equal(anyPriorFailed([{ ok: false, skipped: true }]), false);
  });

  it('evaluateSkipIf priorFailed', () => {
    assert.equal(evaluateSkipIf('priorFailed', [{ ok: false }]), true);
    assert.equal(evaluateSkipIf('priorFailed', [{ ok: true }]), false);
  });

  it('evaluateSkipIf priorOk index', () => {
    assert.equal(evaluateSkipIf('priorOk:0', [{ ok: false }]), true);
    assert.equal(evaluateSkipIf('priorOk:0', [{ ok: true }]), false);
  });

  it('evaluateSkipIf priorConnector failed', () => {
    const prior = [{ connectorKey: 'notion', ok: false }];
    assert.equal(evaluateSkipIf('priorConnector:notion.failed', prior), true);
    assert.equal(evaluateSkipIf('priorConnector:trello.failed', prior), false);
  });

  it('handleStepFailure policies', () => {
    assert.deepEqual(handleStepFailure({ ok: true }, 'abort'), { action: 'continue' });
    assert.equal(handleStepFailure({ ok: false }, 'abort').action, 'abort');
    assert.equal(handleStepFailure({ ok: false }, 'skip_remaining').action, 'skip_remaining');
    assert.equal(handleStepFailure({ ok: false }, 'continue').action, 'continue');
  });

  it('skippedStepResult marks step skipped', () => {
    const row = skippedStepResult({ connectorKey: 'trello', label: 'S' }, 2);
    assert.equal(row.skipped, true);
    assert.equal(row.ok, true);
    assert.equal(row.stepIndex, 2);
  });
});
