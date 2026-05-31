import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTrelloToolArguments,
  extractBoardName,
  extractListName,
  extractSearchQuery,
  resolveInputPath,
} from '../../../connectors/trello/trello-task.core.js';
import { resolveTrelloToolName } from '../../../connectors/trello/trello-router.core.js';

describe('trello-task', () => {
  it('extracts board and list from message', () => {
    assert.equal(extractBoardName('на доске Product Roadmap создай карточку'), 'Product Roadmap');
    assert.equal(extractListName('в список Done'), 'Done');
  });

  it('merges inputsFromPrior into desc', () => {
    const prior = [{ connectorKey: 'notion', summary: 'Итог: страница готова' }];
    const args = buildTrelloToolArguments(
      { message: 'создай карточку', inputsFromPrior: ['notion.summary'] },
      prior,
      'trello_create_card',
    );
    assert.match(args.desc, /Итог/);
    assert.equal(args.name, 'Задача из чата');
  });

  it('builds move card arguments', () => {
    assert.equal(
      resolveTrelloToolName('перемести карточку Bug fix в колонку Done'),
      'trello_move_card',
    );
    const args = buildTrelloToolArguments(
      { message: 'перемести карточку Bug fix в колонку Done на доске Roadmap' },
      [],
      'trello_move_card',
    );
    assert.equal(args.name, 'Bug fix');
    assert.equal(args.list_name, 'Done');
    assert.equal(args.board_name, 'Roadmap');
  });

  it('builds create list arguments', () => {
    assert.equal(resolveTrelloToolName('создай колонку Review на доске Roadmap'), 'trello_create_list');
    const args = buildTrelloToolArguments(
      { message: 'создай колонку Review на доске Roadmap' },
      [],
      'trello_create_list',
    );
    assert.equal(args.list_name, 'Review');
    assert.equal(args.board_name, 'Roadmap');
  });

  it('builds search query from message', () => {
    assert.equal(extractSearchQuery('найди карточку баг в trello'), 'баг');
    const args = buildTrelloToolArguments(
      { message: 'найди карточку deploy на доске Roadmap' },
      [],
      'trello_search_cards',
    );
    assert.equal(args.board_name, 'Roadmap');
    assert.equal(args.query, 'deploy');
    assert.equal(args.list_name, undefined);
  });

  it('resolves list columns intent', () => {
    assert.equal(resolveTrelloToolName('покажи колонки на доске Roadmap'), 'trello_list_lists');
  });

  it('resolves delete card intent', () => {
    assert.equal(resolveTrelloToolName('удали карточку Old task'), 'trello_delete_card');
    const args = buildTrelloToolArguments(
      { message: 'удали карточку Old task' },
      [],
      'trello_delete_card',
    );
    assert.equal(args.name, 'Old task');
  });

  it('resolveInputPath reads priorResults bracket', () => {
    const prior = [{ ok: true, artifacts: { page_url: 'https://x' } }];
    assert.equal(resolveInputPath('priorResults[0].artifacts.page_url', prior), 'https://x');
  });
});
