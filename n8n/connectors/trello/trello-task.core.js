/**
 * Trello L2: task message + inputsFromPrior → tool arguments for mcp-trello.
 */

/** @param {Array<object>} priorResults @param {number} index */
export function priorResultAt(priorResults, index) {
  return (priorResults || [])[index];
}

/**
 * @param {string} path e.g. notion.summary, priorResults[0].artifacts.page_url
 * @param {Array<object>} priorResults
 */
export function resolveInputPath(path, priorResults) {
  if (!path) return null;
  const p = path.trim();
  const bracket = p.match(/^priorResults\[(\d+)\]\.(.+)$/);
  if (bracket) {
    const row = priorResultAt(priorResults, Number(bracket[1]));
    return getNested(row, bracket[2]);
  }
  const dot = p.match(/^([a-z0-9_-]+)\.(.+)$/i);
  if (dot) {
    const key = dot[1];
    const row = [...(priorResults || [])].reverse().find((r) => r?.connectorKey === key);
    if (row) return getNested(row, dot[2]);
  }
  return null;
}

function getNested(obj, path) {
  if (!obj || !path) return null;
  const parts = path.split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return null;
    cur = cur[part];
  }
  if (cur == null) return null;
  return String(cur);
}

/** @param {string} message */
export function extractBoardName(message) {
  if (!message) return null;
  const patterns = [
    /(?:на|в)\s+доск(?:е|у)\s+[«"']?(.+?)(?:\s+в\s+список|\s+создай|\s+добавь|$)/iu,
    /(?:board|доска)\s+[«"']?([^«"'\n,.:;]+)/iu,
    /trello[:\s]+[«"']?([^«"'\n,.:;]+)/iu,
  ];
  for (const re of patterns) {
    const m = message.trim().match(re);
    if (m?.[1]?.trim() && m[1].trim().length <= 120) return m[1].trim();
  }
  return null;
}

/** @param {string} value */
function trimListHint(value) {
  if (!value) return null;
  const trimmed = value
    .replace(/\s+на\s+доск(?:е|у)\s+.+$/iu, '')
    .replace(/\s+in\s+board\s+.+$/iu, '')
    .trim();
  return trimmed || null;
}

/** @param {string} message */
export function extractTargetListName(message) {
  if (!message) return null;
  const patterns = [
    /(?:в|into)\s+(?:колонк[ауе]|список|list)\s+[«"']?([^«"'\n,.:;]+?)(?:\s+на\s+доск|\s+in\s+board|\s*$)/iu,
    /(?:move|перемест(?:и|ить)|перенес(?:и|ти)).+?(?:в|into|to)\s+(?:колонк[ауе]|список|list)\s+[«"']?([^«"'\n,.:;]+?)(?:\s+на\s+доск|\s*$)/iu,
  ];
  for (const re of patterns) {
    const m = message.trim().match(re);
    if (m?.[1]?.trim()) return trimListHint(m[1].trim());
  }
  return extractListName(message);
}

/** @param {string} message */
export function extractNewListName(message) {
  if (!message) return null;
  const patterns = [
    /(?:переимен(?:уй|ить)|rename).+?(?:в|to|into)\s+[«"']?([^«"'\n,.:;]+)/iu,
    /(?:колонк[ауе]|список|list)\s+[«"']?([^«"'\n,.:;]+)[«"']?\s+(?:в|to|into)\s+[«"']?([^«"'\n,.:;]+)/iu,
  ];
  const m1 = message.trim().match(patterns[0]);
  if (m1?.[1]?.trim()) return m1[1].trim();
  const m2 = message.trim().match(patterns[1]);
  if (m2?.[2]?.trim()) return m2[2].trim();
  return null;
}

/** @param {string} message */
export function extractListName(message) {
  if (!message) return null;
  const patterns = [
    /(?:создай|добавь|create|add)\s+(?:колонк[ауе]|список|list)\s+[«"']?([^«"'\n,.:;]+?)(?:\s+на\s+доск|\s+in\s+board|\s*$)/iu,
    /(?:в|into)\s+список\s+[«"']?([^«"'\n,.:;]+?)(?:\s+на\s+доск|\s*$)/iu,
    /(?:list|колонк[ауе])\s+[«"']?([^«"'\n,.:;]+?)(?:\s+на\s+доск|\s*$)/iu,
    /#([\w-]+)/,
  ];
  for (const re of patterns) {
    const m = message.trim().match(re);
    if (m?.[1]?.trim() && m[1].trim().length <= 80) return trimListHint(m[1].trim());
  }
  return null;
}

/** @param {string} message */
export function extractCardName(message) {
  if (!message) return null;
  const patterns = [
    /(?:перемест(?:и|ить)|перенес(?:и|ти)|move)\s+(?:карточк[ауе]|card)\s+[«"']?([^«"'\n]+?)\s+(?:в|into|to)\s+(?:колонк|список|list)/iu,
    /(?:удали|удалить|delete|remove|убери)\s+(?:карточк[ауе]|card)\s+[«"']?([^«"'\n]+?)(?:\s+на\s+доск|\s+из|\s+from|\s*$)/iu,
    /(?:карточк[ауе]|card)\s+[«"']([^«"']+)[«"']/iu,
    /(?:карточк[ауе]|card)\s+([\p{L}\p{N}_ -]{2,80}?)(?:\s+(?:в|into|to|на)\s+|\s*$)/iu,
    /(?:назови|название)\s+[«"']([^«"']+)[«"']/iu,
  ];
  for (const re of patterns) {
    const m = message.trim().match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

/** @param {string} message */
export function extractSearchQuery(message) {
  if (!message) return null;
  const trimmed = message.trim();
  const quoted = trimmed.match(/[«"']([^«"']+)[«"']/);
  if (quoted?.[1]?.trim()) {
    return cleanupSearchQuery(quoted[1].trim());
  }
  const patterns = [
    /(?:найди|найти|поиск|search|find|покаж(?:и)?)\s+(?:карточ(?:ку|ки|ек)|cards?)?\s*(?:про|about|with|с(?:\s+текстом)?)?\s*[«"']?(.+?)(?:\s+на\s+доск|\s+в\s+trello|$)/iu,
    /(?:карточ(?:ку|ки|ек)|cards?)\s+(?:про|about|with)?\s*[«"']?(.+?)(?:\s+на\s+доск|\s+в\s+trello|$)/iu,
    /(?:про|about)\s+[«"']?(.+?)(?:\s+на\s+доск|\s+в\s+trello|$)/iu,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m?.[1]?.trim()) {
      return cleanupSearchQuery(m[1].trim());
    }
  }
  return cleanupSearchQuery(trimmed);
}

/** @param {string} raw */
function cleanupSearchQuery(raw) {
  const cleaned = raw
    .replace(/\b(?:trello|на\s+доск(?:е|у)|доск(?:а|е|у)|board|в\s+trello)\b/giu, ' ')
    .replace(/\b(?:найди|найти|поиск|search|find|покаж(?:и)?|карточ(?:ку|ки|ек)|cards?)\b/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}

/**
 * @param {object} task
 * @param {Array<object>} priorResults
 * @param {string} [toolName]
 */
export function buildTrelloToolArguments(task, priorResults, toolName) {
  const message = task?.message || '';
  const constraints = task?.constraints || {};
  let description = message;
  const inputs = task?.inputsFromPrior || [];
  const extras = [];

  for (const path of inputs) {
    const val = resolveInputPath(path, priorResults);
    if (val) extras.push(val);
  }

  if (extras.length) {
    description = extras.join('\n');
    if (message && !extras.some((e) => message.includes(e))) {
      description = `${message}\n\n${description}`;
    }
  }

  const board =
    constraints.board || constraints.board_name || constraints.boardName || extractBoardName(message);
  const list =
    constraints.list || constraints.list_name || constraints.listName || extractListName(message);
  const name =
    constraints.name ||
    constraints.card_name ||
    constraints.title ||
    extractCardName(message) ||
    'Задача из чата';

  const normalizedTool = (toolName || '').toLowerCase();

  if (normalizedTool === 'trello_search_cards') {
    let query =
      constraints.query || constraints.q || extractSearchQuery(message) || extractCardName(message);
    if (!query && extras.length) {
      query = extras.join(' ');
    }
    const args = {};
    if (board) args.board_name = board;
    if (query) args.query = query;
    return args;
  }

  if (normalizedTool === 'trello_add_comment') {
    const cardRef =
      constraints.card_id ||
      constraints.cardId ||
      extractCardName(message) ||
      name;
    const text = constraints.desc || constraints.text || description;
    const args = { name: cardRef, desc: text };
    if (board) args.board_name = board;
    return args;
  }

  if (normalizedTool === 'trello_list_lists') {
    const args = {};
    if (board) args.board_name = board;
    return args;
  }

  if (normalizedTool === 'trello_create_list') {
    const args = { list_name: list || extractListName(message) || 'New list' };
    if (board) args.board_name = board;
    return args;
  }

  if (normalizedTool === 'trello_rename_list') {
    const current =
      constraints.list_name || constraints.listName || extractListName(message) || list;
    const args = {
      list_name: current,
      new_name:
        constraints.new_name ||
        constraints.newName ||
        constraints.name ||
        extractNewListName(message),
    };
    if (board) args.board_name = board;
    return args;
  }

  if (normalizedTool === 'trello_archive_list') {
    const args = { list_name: list || extractListName(message) || 'Archive' };
    if (board) args.board_name = board;
    return args;
  }

  if (normalizedTool === 'trello_move_card') {
    const cardRef =
      constraints.card_id || constraints.cardId || extractCardName(message) || name;
    const target =
      constraints.list_name ||
      constraints.listName ||
      constraints.target_list ||
      extractTargetListName(message) ||
      list;
    const args = { name: cardRef, list_name: target };
    if (board) args.board_name = board;
    return args;
  }

  if (normalizedTool === 'trello_delete_card') {
    const cardRef =
      constraints.card_id || constraints.cardId || extractCardName(message) || name;
    const args = { name: cardRef };
    if (board) args.board_name = board;
    return args;
  }

  if (normalizedTool === 'trello_create_card') {
    const args = {
      list_name: list || 'To Do',
      name,
      desc: description,
      description,
    };
    if (board) args.board_name = board;
    return args;
  }

  const args = {
    list_name: list || 'To Do',
    name,
    desc: description,
    description,
  };
  if (board) args.board_name = board;
  return args;
}
