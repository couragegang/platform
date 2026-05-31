import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRouteRequest } from '../../core/merge-for-route.core.js';

const scriptsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../scripts');

describe('router-merge (phase D)', () => {
  it('legacy script has no L1 tool heuristics', () => {
    const src = readFileSync(path.join(scriptsDir, 'router-merge.js'), 'utf8');
    assert.doesNotMatch(src, /resolveToolIntent/);
    assert.doesNotMatch(src, /notionToolArguments/);
    assert.doesNotMatch(src, /resolvedTool/);
    assert.match(src, /buildRouteRequest/);
  });

  it('buildRouteRequest matches merge-for-route.core', () => {
    const ctx = { message: 'hi', runId: 'r1' };
    const items = [
      { items: [{ role: 'user', content: 'hello' }] },
      { items: [{ connectorKey: 'notion', status: 'active' }] },
      { items: [{ title: 'doc', snippet: 'text' }] },
    ];
    const out = buildRouteRequest(ctx, items);
    assert.equal(out.routeRequest.message, 'hi');
    assert.deepEqual(out.routeRequest.activeConnectorKeys, ['notion']);
    assert.match(out.routeRequest.knowledgeContext, /doc/);
  });
});
