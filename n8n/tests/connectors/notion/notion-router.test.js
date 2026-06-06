import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildNotionToolArguments,
  resolveNotionInternalSteps,
  resolveNotionToolName,
} from '../../../connectors/notion/notion-router.core.js';

describe('notion-router', () => {
  it('resolves delete intent from task message', () => {
    assert.equal(resolveNotionToolName('Удали страницу Ideas в notion'), 'notion_delete_page');
    assert.equal(resolveNotionToolName('delete page Roadmap from notion'), 'notion_delete_page');
  });

  it('plans search before delete when page unknown', () => {
    const steps = resolveNotionInternalSteps({
      task: { message: 'Удали страницу Ideas' },
      label: 'Удалить Ideas',
    });
    assert.equal(steps.length, 2);
    assert.equal(steps[0].toolName, 'notion_search');
    assert.equal(steps[1].toolName, 'notion_delete_page');
    assert.equal(steps[1].arguments.page_title, 'Ideas');
  });

  it('resolves edit intent from task message', () => {
    assert.equal(
      resolveNotionToolName('Замени на странице Ideas фразу было вкусно на очень вкусно'),
      'notion_edit_block',
    );
  });

  it('plans search before edit when page unknown', () => {
    const steps = resolveNotionInternalSteps({
      task: { message: 'Замени на странице Ideas фразу old на new' },
      label: 'Edit Ideas',
    });
    assert.equal(steps.length, 2);
    assert.equal(steps[0].toolName, 'notion_search');
    assert.equal(steps[1].toolName, 'notion_edit_block');
  });

  it('resolves list intent from L1 paraphrases', () => {
    assert.equal(
      resolveNotionToolName('Показать все страницы Notion пользователя'),
      'notion_search',
    );
    assert.equal(resolveNotionToolName('List all Notion pages'), 'notion_search');
  });

  it('falls back to original user message when router task is vague', () => {
    const steps = resolveNotionInternalSteps(
      {
        task: { message: 'Retrieve all Notion pages for the user' },
        userMessage: 'Какие у меня есть страницы в notion?',
      },
      [],
    );
    assert.equal(steps.length, 1);
    assert.equal(steps[0].toolName, 'notion_search');
    assert.equal(steps[0].arguments.query, 'Какие у меня есть страницы в notion?');
  });

  it('single explicit toolName step passes through', () => {
    const steps = resolveNotionInternalSteps({
      toolName: 'notion_search',
      arguments: { query: 'roadmap' },
    });
    assert.equal(steps.length, 1);
    assert.equal(steps[0].toolName, 'notion_search');
    assert.deepEqual(steps[0].arguments, { query: 'roadmap' });
  });

  it('buildNotionToolArguments extracts replace pair', () => {
    const args = buildNotionToolArguments(
      'notion_edit_block',
      'замени фразу было вкусно на очень вкусно',
    );
    assert.equal(args.find_text, 'было вкусно');
    assert.equal(args.new_text, 'очень вкусно');
  });
});
