import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildToolContextMessage,
  notionToolArguments,
  prepareResumeInvoke,
} from '../lib/resume-prepare.core.js';

describe('prepareResumeInvoke', () => {
  const ctx = { message: 'fallback message' };

  it('returns skipInvoke when pending is missing or not approved', () => {
    const r1 = prepareResumeInvoke(ctx, [], null);
    assert.equal(r1.skipInvoke, true);
    assert.match(r1.payload.reply, /подтверждение не найдено/);

    const r2 = prepareResumeInvoke(ctx, [], { status: 'pending', toolName: 'notion_write_page' });
    assert.equal(r2.skipInvoke, true);
  });

  it('builds notion invoke payload for approved pending', () => {
    const history = [
      { role: 'assistant', content: 'Создам страницу' },
      { role: 'user', content: 'запиши в notion' },
    ];
    const pending = { status: 'approved', toolName: 'notion_write_page' };

    const out = prepareResumeInvoke(ctx, history, pending);

    assert.equal(out.skipInvoke, false);
    assert.equal(out.connectorKey, 'notion');
    assert.equal(out.toolName, 'notion_write_page');
    assert.match(out.toolArguments.content, /запиши в notion/);
    assert.equal(out.toolArguments.title, 'запиши в notion');
  });

  it('uses ctx.message when history has no user turns', () => {
    const out = prepareResumeInvoke(ctx, [], { status: 'approved', toolName: 'notion_search' });
    assert.equal(out.toolArguments.query, 'fallback message');
  });
});

describe('notionToolArguments', () => {
  it('maps search tools to query fields', () => {
    const args = notionToolArguments('notion_search', [{ role: 'user', content: 'q1' }], '');
    assert.equal(args.query, 'q1');
    assert.equal(args.q, 'q1');
  });
});

describe('buildToolContextMessage', () => {
  it('combines assistant context and user requests', () => {
    const msg = buildToolContextMessage([
      { role: 'assistant', content: 'Ответ' },
      { role: 'user', content: 'один' },
      { role: 'user', content: 'два' },
    ]);
    assert.match(msg, /Контекст ассистента: Ответ/);
    assert.match(msg, /один \| два/);
  });
});
