/**
 * Trello L2 mini-router (mock until mcp-trello BC is deployed).
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

/** @param {string} message */
export function resolveTrelloToolName(message) {
  if (!message?.trim()) return null;
  const lower = message.toLowerCase();
  const wantsCreate = CREATE_VERBS.some((w) => lower.includes(w));
  if (matchesSearchIntent(lower) && !wantsCreate) {
    return 'trello_search_cards';
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
      arguments: buildTrelloToolArguments(task, priorResults),
      label: step.label || 'Действие в Trello',
    },
  ];
}

/** Mock invoke when mcp-trello is not wired. */
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
  return `Trello (mock): карточка «${name}» → доска ${board}, список ${list}${preview ? ` — «${preview}»` : ''}`;
}
