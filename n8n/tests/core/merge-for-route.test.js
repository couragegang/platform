import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRouteRequest } from '../../core/merge-for-route.core.js';

describe('buildRouteRequest', () => {
  const ctx = {
    message: 'hello',
    workspaceId: 'ws-1',
    orgId: 'org-1',
  };

  it('merges history, installations and knowledge into routeRequest', () => {
    const items = [
      { items: [{ role: 'user', content: 'hi' }] },
      {
        items: [
          { connectorKey: 'notion', status: 'active' },
          { connectorKey: 'trello', status: 'revoked' },
          { connectorKey: 'notion', status: 'error' },
        ],
      },
      { items: [{ title: 'Doc', snippet: 'snippet text' }] },
    ];

    const out = buildRouteRequest(ctx, items);

    assert.equal(out.message, 'hello');
    assert.deepEqual(out.routeRequest.messages, [{ role: 'user', content: 'hi' }]);
    assert.deepEqual(out.routeRequest.activeConnectorKeys, ['notion', 'notion']);
    assert.match(out.routeRequest.knowledgeContext, /Doc/);
    assert.equal(out.routeRequest.message, 'hello');
  });

  it('handles empty parallel inputs', () => {
    const out = buildRouteRequest(ctx, []);
    assert.deepEqual(out.routeRequest.messages, []);
    assert.deepEqual(out.routeRequest.activeConnectorKeys, []);
    assert.equal(out.routeRequest.knowledgeContext, null);
  });
});
