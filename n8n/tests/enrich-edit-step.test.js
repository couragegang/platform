import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { enrichEditArguments, enrichToolStepArguments, isEditTool } from '../lib/enrich-edit-step.core.js';

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

describe('isEditTool', () => {
  it('detects notion_edit_block', () => {
    assert.equal(isEditTool('notion_edit_block'), true);
    assert.equal(isEditTool('notion_write_page'), false);
  });
});

describe('enrichToolStepArguments', () => {
  it('enriches write and edit tools', () => {
    const prior = [
      {
        toolName: 'notion_search',
        ok: true,
        summary: 'Найдено в Notion:\n- Notes (https://www.notion.so/Notes-1)',
      },
    ];
    const write = enrichToolStepArguments(
      'notion_write_page',
      { content: 'x', page_title: 'Notes' },
      prior,
    );
    assert.equal(write.page_url, 'https://www.notion.so/Notes-1');
    const edit = enrichToolStepArguments(
      'notion_edit_block',
      { find_text: 'a', new_text: 'b', page_title: 'Notes' },
      prior,
    );
    assert.equal(edit.page_url, 'https://www.notion.so/Notes-1');
  });
});
