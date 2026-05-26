import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAllWorkflows } from '../scripts/validate-workflows.mjs';

const workflowsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'workflows');

describe('validate-workflows', () => {
  it('committed workflow JSON passes static checks', () => {
    const results = validateAllWorkflows(workflowsDir);
    const issues = results.flatMap((r) => r.issues.map((i) => `${r.file}: ${i}`));
    assert.deepEqual(issues, []);
  });
});
