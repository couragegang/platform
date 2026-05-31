import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  enrichWriteArguments,
  extractPagesFromSearchSummary,
  isCreateNew,
  pickPageFromPriorSearch,
} from '../lib/enrich-write-step.core.js';

describe('enrichWriteArguments', () => {
  it('adds page_url from prior notion_search when updating', () => {
    const prior = [
      {
        stepIndex: 1,
        toolName: 'notion_search',
        ok: true,
        summary:
          'Найдено в Notion:\n- Roadmap (https://www.notion.so/Roadmap-abc123)',
      },
    ];
    const args = enrichWriteArguments(
      'notion_write_page',
      { content: 'Новый пункт', page_title: 'Roadmap' },
      prior,
    );
    assert.equal(args.page_url, 'https://www.notion.so/Roadmap-abc123');
    assert.equal(args.page_title, 'Roadmap');
  });

  it('skips enrichment when create_new is true', () => {
    const prior = [
      {
        toolName: 'notion_search',
        ok: true,
        summary: 'Найдено в Notion:\n- Roadmap (https://www.notion.so/x)',
      },
    ];
    const args = enrichWriteArguments(
      'notion_write_page',
      { create_new: true, title: 'New', content: 'x' },
      prior,
    );
    assert.equal(args.page_url, undefined);
  });
});

describe('pickPageFromPriorSearch', () => {
  it('picks single search hit without title hint', () => {
    const page = pickPageFromPriorSearch(
      [
        {
          toolName: 'notion_search',
          ok: true,
          summary: 'Найдено в Notion:\n- Notes (https://www.notion.so/Notes-1)',
        },
      ],
      null,
    );
    assert.equal(page.title, 'Notes');
  });
});

describe('isCreateNew', () => {
  it('detects explicit create_new flag', () => {
    assert.equal(isCreateNew({ create_new: true }), true);
    assert.equal(isCreateNew({ create_new: false }), false);
  });
});

describe('extractPagesFromSearchSummary', () => {
  it('parses notion search summary lines', () => {
    const pages = extractPagesFromSearchSummary(
      'Найдено в Notion:\n- One (https://a)\n- Two (https://b)',
    );
    assert.equal(pages.length, 2);
    assert.equal(pages[0].title, 'One');
  });
});
