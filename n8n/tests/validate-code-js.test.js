import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateCodeJs } from '../scripts/validate-workflows.mjs';

describe('validateCodeJs', () => {
  it('flags multi-line ESM import like n8n VM', () => {
    const code = `import {
  evaluateSkipIf,
} from './plan-branching.core.js';

return [{ json: {} }];`;
    const issues = validateCodeJs('Run Connector Chain', code);
    assert.ok(issues.some((i) => i.includes('ESM import')));
  });

  it('flags export async function left in bundled code', () => {
    const code = 'export async function executeConnectorChain() {}\nreturn [];';
    const issues = validateCodeJs('Run Connector Chain', code);
    assert.ok(issues.some((i) => i.includes('ESM export')));
  });

  it('accepts top-level return in Code node jsCode', () => {
    const code = 'return [{ json: { ok: true } }];';
    const issues = validateCodeJs('Parse Context', code);
    assert.deepEqual(issues, []);
  });

  it('accepts bundled async helper without ESM', () => {
    const code = 'async function executeConnectorChain() { return null; }\nreturn [];';
    const issues = validateCodeJs('Run Connector Chain', code);
    assert.deepEqual(issues, []);
  });
});
