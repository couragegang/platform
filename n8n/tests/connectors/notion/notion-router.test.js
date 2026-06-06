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

  it('lists pages instead of creating when user asks what pages exist', () => {
    assert.equal(resolveNotionToolName('какие у меня есть страницы?'), 'notion_search');
    const steps = resolveNotionInternalSteps({
      task: { message: 'какие у меня есть страницы?' },
    });
    assert.equal(steps.length, 1);
    assert.equal(steps[0].toolName, 'notion_search');
  });

  it('does not treat L1 paraphrase with «созданные» as write', () => {
    const msg =
      "Найти все страницы в Notion workspace пользователя, включая страницы, созданные ранее (например, 'Todo List').";
    assert.equal(resolveNotionToolName(msg), 'notion_search');
    const steps = resolveNotionInternalSteps({ task: { message: msg } });
    assert.equal(steps[0].toolName, 'notion_search');
    assert.notEqual(steps[0].arguments.create_new, true);
  });

  it('appends to existing todo list instead of creating a new page', () => {
    const msg = 'Обнови мой список дел на завтра-добавь туда вкусно покушать';
    const steps = resolveNotionInternalSteps({
      task: { message: msg },
      userMessage: msg,
    });
    assert.equal(steps.length, 2);
    assert.equal(steps[0].toolName, 'notion_search');
    assert.equal(steps[1].toolName, 'notion_write_page');
    assert.equal(steps[1].arguments.create_new, false);
    assert.equal(steps[1].arguments.content, 'вкусно покушать');
    assert.equal(steps[1].arguments.page_title, 'список дел на завтра');
  });

  it('routes L1 search paraphrase to notion_search not write', () => {
    const msg =
      "Найди страницу с заголовком 'Todo List' или подобным, которая была создана ранее";
    assert.equal(resolveNotionToolName(msg), 'notion_search');
    const steps = resolveNotionInternalSteps({ task: { message: msg } });
    assert.equal(steps.length, 1);
    assert.equal(steps[0].toolName, 'notion_search');
  });

  it('creates a new page without a prior search step', () => {
    const steps = resolveNotionInternalSteps({
      task: { message: 'Создай у меня в notion страницу со списком дел на завтра' },
    });
    assert.equal(steps.length, 1);
    assert.equal(steps[0].toolName, 'notion_write_page');
    assert.equal(steps[0].arguments.create_new, true);
    assert.equal(steps[0].arguments.title, 'список дел на завтра');
  });

  it('creates a todo list page from add intent', () => {
    const steps = resolveNotionInternalSteps({
      task: { message: 'Добавь мне To-do list' },
    });
    assert.equal(steps.length, 1);
    assert.equal(steps[0].toolName, 'notion_write_page');
    assert.equal(steps[0].arguments.create_new, true);
    assert.equal(steps[0].arguments.title, 'To-do list');
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
