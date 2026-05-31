import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTrelloToolArguments,
  extractBoardName,
  extractListName,
  resolveInputPath,
} from '../../../connectors/trello/trello-task.core.js';

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
    );
    assert.match(args.desc, /Итог/);
    assert.equal(args.name, 'Задача из чата');
  });

  it('resolveInputPath reads priorResults bracket', () => {
    const prior = [{ ok: true, artifacts: { page_url: 'https://x' } }];
    assert.equal(resolveInputPath('priorResults[0].artifacts.page_url', prior), 'https://x');
  });
});
