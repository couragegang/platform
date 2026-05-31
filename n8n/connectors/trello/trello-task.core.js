/**
 * Trello L2: task message + inputsFromPrior (mock until mcp-trello BC).
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

/** @param {string} message */
export function extractListName(message) {
  if (!message) return null;
  const patterns = [
    /(?:в|into)\s+список\s+[«"']?([^«"'\n,.:;]+)/iu,
    /(?:list|колонк[ауе])\s+[«"']?([^«"'\n,.:;]+)/iu,
    /#([\w-]+)/,
  ];
  for (const re of patterns) {
    const m = message.trim().match(re);
    if (m?.[1]?.trim() && m[1].trim().length <= 80) return m[1].trim();
  }
  return null;
}

/** @param {string} message */
export function extractCardName(message) {
  if (!message) return null;
  const patterns = [
    /(?:карточк[ауе]|card)\s+[«"']([^«"']+)[«"']/iu,
    /(?:карточк[ауе]|card)\s+([\p{L}\p{N}_-]{2,80})/iu,
    /(?:назови|название)\s+[«"']([^«"']+)[«"']/iu,
  ];
  for (const re of patterns) {
    const m = message.trim().match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

/**
 * @param {object} task
 * @param {Array<object>} priorResults
 */
export function buildTrelloToolArguments(task, priorResults) {
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

  return {
    board_name: board || 'Roadmap',
    list_name: list || 'To Do',
    name,
    desc: description,
    description,
  };
}
