import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const n8nRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowsDir = path.join(n8nRoot, 'workflows');

describe('build-workflows sync', () => {
  it('regenerated JSON matches committed artifacts', () => {
    const before = new Map(
      [
        'chat-orchestrator-v0.json',
        'chat-tool-step.json',
        'chat-connector-notion.json',
        'chat-connector-trello.json',
      ].map((f) => [
        f,
        fs.readFileSync(path.join(workflowsDir, f), 'utf8'),
      ]),
    );

    execFileSync('node', ['scripts/build-workflows.mjs'], { cwd: n8nRoot, stdio: 'pipe' });

    for (const [file, prev] of before) {
      const next = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
      assert.equal(next, prev, `${file} drift: run node scripts/build-workflows.mjs and commit`);
    }
  });
});
