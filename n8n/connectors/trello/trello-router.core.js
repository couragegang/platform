/**
 * Trello L2 mini-router: resolves tool names and delegates invoke to chat-tool-step → mcp-trello.
 */

import { buildTrelloToolArguments } from './trello-task.core.js';

function matchesSearchIntent(lower) {
  return ['найди', 'поиск', 'search', 'find', 'покаж', 'список карточ'].some((w) =>
    lower.includes(w),
  );
}

function matchesCommentIntent(lower) {
  return ['коммент', 'comment', 'ответь', 'reply'].some((w) => lower.includes(w));
}

function matchesCreateIntent(lower) {
  return CREATE_VERBS.some((w) => lower.includes(w)) || lower.includes('карточк');
}

const CREATE_VERBS = ['создай', 'создать', 'добавь', 'добавить', 'create', 'add card', 'new card'];

function matchesMoveIntent(lower) {
  const hasMoveVerb = ['перемест', 'перенес', 'move', 'перетащ', 'drag'].some((w) =>
    lower.includes(w),
  );
  const hasMoveTarget = /(?:в|into|to)\s+(?:колонк|список|list)\s/.test(lower);
  return hasMoveVerb && (hasMoveTarget || lower.includes('карточ'));
}

function matchesListColumnsIntent(lower) {
  return (
    ['колонк', 'списк', 'lists', 'columns', 'column'].some((w) => lower.includes(w)) &&
    ['покаж', 'список', 'list', 'какие', 'show', 'вывед'].some((w) => lower.includes(w)) &&
    !lower.includes('карточ')
  );
}

function matchesCreateListIntent(lower) {
  return (
    CREATE_VERBS.some((w) => lower.includes(w)) &&
    ['колонк', 'список', 'list', 'column'].some((w) => lower.includes(w)) &&
    !lower.includes('карточ')
  );
}

function matchesRenameListIntent(lower) {
  return (
    ['переимен', 'rename'].some((w) => lower.includes(w)) &&
    ['колонк', 'список', 'list', 'column'].some((w) => lower.includes(w))
  );
}

function matchesArchiveListIntent(lower) {
  return (
    ['архив', 'archive'].some((w) => lower.includes(w)) &&
    ['колонк', 'список', 'list', 'column'].some((w) => lower.includes(w))
  );
}

function matchesDeleteCardIntent(lower) {
  const hasDeleteVerb = ['удали', 'удалить', 'delete', 'remove', 'убери'].some((w) =>
    lower.includes(w),
  );
  const hasCard = lower.includes('карточ') || lower.includes('card');
  return hasDeleteVerb && hasCard;
}

/** @param {string} message */
export function resolveTrelloToolName(message) {
  if (!message?.trim()) return null;
  const lower = message.toLowerCase();
  const wantsCreate = CREATE_VERBS.some((w) => lower.includes(w));
  if (matchesSearchIntent(lower) && !wantsCreate && !matchesListColumnsIntent(lower)) {
    return 'trello_search_cards';
  }
  if (matchesMoveIntent(lower)) {
    return 'trello_move_card';
  }
  if (matchesListColumnsIntent(lower)) {
    return 'trello_list_lists';
  }
  if (matchesRenameListIntent(lower)) {
    return 'trello_rename_list';
  }
  if (matchesArchiveListIntent(lower)) {
    return 'trello_archive_list';
  }
  if (matchesDeleteCardIntent(lower)) {
    return 'trello_delete_card';
  }
  if (matchesCreateListIntent(lower)) {
    return 'trello_create_list';
  }
  if (matchesCommentIntent(lower)) {
    return 'trello_add_comment';
  }
  if (matchesCreateIntent(lower)) {
    return 'trello_create_card';
  }
  if (lower.includes('trello')) {
    return 'trello_create_card';
  }
  return null;
}

/** @param {object} step @param {Array<object>} priorResults */
export function resolveTrelloInternalSteps(step, priorResults = []) {
  if (step?.toolName) {
    return [
      {
        connectorKey: 'trello',
        toolName: step.toolName,
        arguments: step.arguments || {},
        label: step.label || step.toolName,
      },
    ];
  }

  const task = step?.task;
  if (!task?.message?.trim()) {
    return [];
  }

  const toolName = resolveTrelloToolName(task.message);
  if (!toolName) {
    return [];
  }

  return [
    {
      connectorKey: 'trello',
      toolName,
      arguments: buildTrelloToolArguments(task, priorResults, toolName),
      label: step.label || 'Действие в Trello',
    },
  ];
}

/** Local mock invoke when TRELLO_CONNECTOR_MOCK=true (dev without credentials). */
export function buildTrelloMockSummary(args, toolName) {
  const board = args?.board_name || args?.board || 'Roadmap';
  const list = args?.list_name || args?.list || 'To Do';
  const name = args?.name || args?.card_name || 'Карточка';
  const desc = (args?.desc || args?.description || '').trim();
  const preview = desc.length > 200 ? `${desc.slice(0, 200)}…` : desc;
  const n = (toolName || '').toLowerCase();
  if (n.includes('search')) {
    const q = args?.query || preview || name;
    return `Trello (mock): поиск «${q}» на доске ${board}`;
  }
  if (n.includes('comment')) {
    return `Trello (mock): комментарий к карточке «${name}»${preview ? ` — «${preview}»` : ''}`;
  }
  if (n.includes('move')) {
    return `Trello (mock): карточка «${name}» → колонка ${list}`;
  }
  if (n.includes('list_lists') || n.includes('list lists')) {
    return `Trello (mock): колонки на доске ${board}`;
  }
  if (n.includes('create_list')) {
    return `Trello (mock): создана колонка «${list}» на доске ${board}`;
  }
  if (n.includes('rename_list')) {
    return `Trello (mock): колонка «${list}» переименована в «${args?.new_name || args?.name || 'New'}»`;
  }
  if (n.includes('archive_list')) {
    return `Trello (mock): колонка «${list}» архивирована на доске ${board}`;
  }
  if (n.includes('delete_card')) {
    return `Trello (mock): карточка «${name}» удалена`;
  }
  return `Trello (mock): карточка «${name}» → доска ${board}, список ${list}${preview ? ` — «${preview}»` : ''}`;
}
