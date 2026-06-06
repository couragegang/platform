import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bundleN8nCode, stripModuleSyntax } from '../scripts/bundle-n8n-code.mjs';

describe('stripModuleSyntax', () => {
  it('removes multi-line import and export async function', () => {
    const input = `import {
  evaluateSkipIf,
  handleStepFailure,
} from './plan-branching.core.js';

export async function executeConnectorChain() {
  return null;
}
`;
    const out = stripModuleSyntax(input);
    assert.ok(!out.includes('import'));
    assert.ok(!out.includes('export'));
    assert.match(out, /async function executeConnectorChain/);
  });

  it('bundled Run Connector Chain code has no ESM syntax', () => {
    const bundled = bundleN8nCode(
      ['core/plan-branching.core.js', 'core/run-connector-chain.core.js'],
      'scripts/run-connector-chain.runner.js',
    );
    assert.ok(!/\bimport\s/.test(bundled), 'must not contain import');
    assert.ok(!/\bexport\s/.test(bundled), 'must not contain export');
    assert.match(bundled, /async function executeConnectorChain/);
    assert.match(bundled, /function planHasRunnableSteps/);
  });

  it('bundled Trello connector includes buildTrelloToolArguments', () => {
    const bundled = bundleN8nCode(
      ['connectors/trello/trello-task.core.js', 'connectors/trello/trello-router.core.js'],
      'scripts/connector-trello-parse.runner.js',
    );
    assert.ok(!/\bimport\s/.test(bundled), 'must not contain import');
    assert.match(bundled, /function buildTrelloToolArguments/);
    assert.match(bundled, /function resolveTrelloInternalSteps/);
  });
});
