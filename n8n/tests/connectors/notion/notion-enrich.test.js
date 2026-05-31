import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  enrichEditArguments,
  enrichNotionToolArguments,
  enrichWriteArguments,
  extractPagesFromSearchSummary,
  isCreateNew,
  isEditTool,
  pickPageFromPriorSearch,
} from '../../../connectors/notion/notion-enrich.core.js';

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

describe('enrichEditArguments', () => {
  it('adds page_url from prior search', () => {
    const prior = [
      {
        toolName: 'notion_search',
        ok: true,
        summary: 'Найдено в Notion:\n- Ideas (https://www.notion.so/Ideas-abc)',
      },
    ];
    const args = enrichEditArguments(
      'notion_edit_block',
      { find_text: 'old', new_text: 'new', page_title: 'Ideas' },
      prior,
    );
    assert.equal(args.page_url, 'https://www.notion.so/Ideas-abc');
  });
});

describe('enrichNotionToolArguments', () => {
  it('enriches write and edit tools', () => {
    const prior = [
      {
        toolName: 'notion_search',
        ok: true,
        summary: 'Найдено в Notion:\n- Notes (https://www.notion.so/Notes-1)',
      },
    ];
    const write = enrichNotionToolArguments(
      'notion_write_page',
      { content: 'x', page_title: 'Notes' },
      prior,
    );
    assert.equal(write.page_url, 'https://www.notion.so/Notes-1');
    const edit = enrichNotionToolArguments(
      'notion_edit_block',
      { find_text: 'a', new_text: 'b', page_title: 'Notes' },
      prior,
    );
    assert.equal(edit.page_url, 'https://www.notion.so/Notes-1');
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

describe('isEditTool', () => {
  it('detects notion_edit_block', () => {
    assert.equal(isEditTool('notion_edit_block'), true);
    assert.equal(isEditTool('notion_write_page'), false);
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
