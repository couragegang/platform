import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTrelloInternalSteps,
  buildTrelloMockSummary,
  resolveTrelloToolName,
} from '../../../connectors/trello/trello-router.core.js';

describe('trello-router', () => {
  it('resolves task to trello_create_card', () => {
    const steps = resolveTrelloInternalSteps(
      { connectorKey: 'trello', task: { message: 'Создай карточку на доске Roadmap в список To Do' } },
      [],
    );
    assert.equal(steps.length, 1);
    assert.equal(steps[0].toolName, 'trello_create_card');
    assert.equal(steps[0].arguments.board_name, 'Roadmap');
    assert.equal(steps[0].arguments.list_name, 'To Do');
  });

  it('resolves search intent', () => {
    assert.equal(resolveTrelloToolName('найди карточку баг в trello'), 'trello_search_cards');
  });

  it('builds mock summary for create', () => {
    const s = buildTrelloMockSummary(
      { board_name: 'B', list_name: 'L', name: 'Task', desc: 'body' },
      'trello_create_card',
    );
    assert.match(s, /Trello \(mock\)/);
    assert.match(s, /Task/);
  });
});
