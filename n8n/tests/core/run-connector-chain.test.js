import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  connectorWebhookPath,
  executeConnectorChain,
  mapConnectorResultToPrior,
  planHasRunnableSteps,
  registeredConnectorKeys,
  resolveStepWebhookUrl,
} from '../../core/run-connector-chain.core.js';

describe('run-connector-chain', () => {
  it('routes notion and trello to connector webhooks', () => {
    assert.equal(connectorWebhookPath('notion'), 'chat-connector-notion');
    assert.equal(connectorWebhookPath('trello'), 'chat-connector-trello');
    assert.ok(registeredConnectorKeys().includes('trello'));
    const url = resolveStepWebhookUrl({ connectorKey: 'trello' }, {});
    assert.match(url, /\/webhook\/chat-connector-trello$/);
  });

  it('falls back to tool-step for unknown connectors', () => {
    const url = resolveStepWebhookUrl(
      { connectorKey: 'github' },
      { N8N_TOOL_STEP_WEBHOOK_URL: 'http://n8n:5678/webhook/chat-tool-step' },
    );
    assert.equal(url, 'http://n8n:5678/webhook/chat-tool-step');
  });

  it('planHasRunnableSteps accepts connector_chain', () => {
    assert.equal(
      planHasRunnableSteps({ mode: 'connector_chain', steps: [{ connectorKey: 'notion' }] }),
      true,
    );
    assert.equal(planHasRunnableSteps({ mode: 'chat', steps: [] }), false);
  });

  it('mapConnectorResultToPrior preserves summary and artifacts', () => {
    const prior = mapConnectorResultToPrior(
      {
        ok: true,
        summary: 'done',
        artifacts: { page_url: 'https://notion.so/x' },
        stepResult: { ok: true, summary: 'done' },
      },
      { connectorKey: 'notion', label: 'Notion' },
      1,
    );
    assert.equal(prior.ok, true);
    assert.equal(prior.summary, 'done');
    assert.equal(prior.artifacts.page_url, 'https://notion.so/x');
  });

  it('executeConnectorChain skips step when skipIf matches', async () => {
    const calls = [];
    const out = await executeConnectorChain(
      { runId: 'r1' },
      {
        mode: 'connector_chain',
        steps: [
          { connectorKey: 'notion', onFailure: 'continue' },
          { connectorKey: 'trello', skipIf: 'priorConnector:notion.failed' },
        ],
      },
      {},
      async (url, body) => {
        calls.push({ url, body });
        return { action: 'continue', ok: false, error: 'search empty', stepResult: { ok: false } };
      },
    );
    assert.equal(calls.length, 1);
    assert.equal(out.priorResults.length, 2);
    assert.equal(out.priorResults[1].skipped, true);
    assert.equal(out.priorResults[1].connectorKey, 'trello');
  });

  it('executeConnectorChain aborts on onFailure abort', async () => {
    const out = await executeConnectorChain(
      { runId: 'r1' },
      {
        mode: 'connector_chain',
        steps: [{ connectorKey: 'notion', onFailure: 'abort' }],
      },
      {},
      async () => ({
        action: 'continue',
        ok: false,
        error: 'fail',
        stepResult: { ok: false },
      }),
    );
    assert.equal(out.aborted, true);
    assert.match(out.error, /fail/);
  });
});
