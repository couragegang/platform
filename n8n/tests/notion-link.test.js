import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ensureNotionUrlsInReply,
  extractNotionUrls,
} from '../connectors/notion/notion-link.core.js';
import {
  buildDirectReply,
  finalizeChainReply,
  shouldUseDirectSummary,
} from '../core/summarize-chain.core.js';

describe('extractNotionUrls', () => {
  it('finds notion.so and notion.site URLs', () => {
    const text =
      'Страница: https://www.notion.so/Roadmap-abc123 и https://acme.notion.site/Page-xyz';
    const urls = extractNotionUrls(text);
    assert.equal(urls.length, 2);
    assert.ok(urls[0].includes('notion.so'));
    assert.ok(urls[1].includes('notion.site'));
  });
});

describe('ensureNotionUrlsInReply', () => {
  it('appends missing Notion links from tool summaries', () => {
    const prior = [
      {
        summary:
          'Текст добавлен на страницу Notion: https://www.notion.so/Roadmap-abc123',
      },
    ];
    const reply = ensureNotionUrlsInReply('Готово, текст записан.', prior);
    assert.ok(reply.includes('https://www.notion.so/Roadmap-abc123'));
    assert.ok(reply.includes('[Открыть страницу в Notion]'));
  });

  it('does not duplicate URLs already in reply', () => {
    const url = 'https://www.notion.so/Roadmap-abc123';
    const reply = ensureNotionUrlsInReply(`Ссылка: ${url}`, [{ summary: `done ${url}` }]);
    assert.equal((reply.match(/Roadmap-abc123/g) || []).length, 1);
  });
});

describe('summarize-chain reply', () => {
  it('uses direct summary for single write step with URL', () => {
    const prior = [
      {
        ok: true,
        summary:
          'Страница создана в Notion: https://www.notion.so/New-Page-abc123',
      },
    ];
    assert.equal(shouldUseDirectSummary(prior), true);
    assert.ok(buildDirectReply(prior).includes('https://www.notion.so/New-Page-abc123'));
  });

  it('restores URLs dropped by LLM on multi-step chain', () => {
    const prior = [
      { ok: true, summary: 'Найдено: Roadmap' },
      {
        ok: true,
        summary:
          'Текст добавлен на страницу Notion: https://www.notion.so/Roadmap-abc123',
      },
    ];
    assert.equal(shouldUseDirectSummary(prior), false);
    const reply = finalizeChainReply(prior, 'Текст добавлен на страницу Roadmap.');
    assert.ok(reply.includes('https://www.notion.so/Roadmap-abc123'));
  });
});
