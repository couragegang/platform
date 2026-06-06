/**
 * Notion L2 mini-router: connector task → ordered internal tool steps.
 */

function mentionsNotion(lower) {
  return lower.includes('notion') || lower.includes('ноушен') || lower.includes('ношен');
}

function matchesEditBlockIntent(lower) {
  return (
    lower.includes('замени') ||
    lower.includes('исправ') ||
    lower.includes('отредакт') ||
    lower.includes('поменяй') ||
    lower.includes('replace') ||
    (lower.includes('измени') &&
      (lower.includes('фраз') || lower.includes('текст') || lower.includes('на '))) ||
    (lower.includes('change') && lower.includes('to'))
  );
}

function matchesWriteIntent(lower) {
  return ['сохран', 'запис', 'созда', 'добав', 'write', 'create', 'update', 'добавь'].some((w) =>
    lower.includes(w),
  );
}

function matchesDeleteIntent(lower) {
  return ['удали', 'удалить', 'удаление', 'delete', 'remove', 'архив', 'archive', 'trash', 'корзин'].some(
    (w) => lower.includes(w),
  );
}

function matchesSearchFollowUp(lower) {
  return (
    ['назван', 'тема', 'topic', 'name', 'страниц'].some((w) => lower.includes(w)) ||
    lower === 'название'
  );
}

function matchesListIntent(lower) {
  return (
    ((lower.includes('какие') || lower.includes('какой') || lower.includes('что есть')) &&
      lower.includes('страниц')) ||
    (lower.includes('список') && lower.includes('страниц')) ||
    (lower.includes('перечисли') && lower.includes('страниц')) ||
    (lower.includes('show') && lower.includes('page')) ||
    (lower.includes('list') && lower.includes('page')) ||
    (lower.includes('страниц') &&
      (lower.includes('есть') || lower.includes('имею') || lower.includes('доступ')))
  );
}

function matchesSearchIntent(lower) {
  return ['найди', 'поиск', 'search', 'find', 'прочит', 'покаж', 'показ', 'fetch', 'отобраз'].some(
    (w) => lower.includes(w),
  );
}

/** @param {string} message */
export function resolveNotionToolName(message) {
  if (!message?.trim()) return null;
  const lower = message.toLowerCase();
  if (matchesDeleteIntent(lower)) return 'notion_delete_page';
  if (matchesEditBlockIntent(lower)) return 'notion_edit_block';
  if (matchesWriteIntent(lower)) return 'notion_write_page';
  if (matchesListIntent(lower) || matchesSearchIntent(lower) || matchesSearchFollowUp(lower)) {
    return 'notion_search';
  }
  return null;
}

function extractReplacePair(message) {
  if (!message?.trim()) return null;
  const patterns = [
    /(?:замени|поменяй|исправь|измени)(?:\s+фразу)?\s+[«"']?(.+?)[«"']?\s+на\s+[«"']?(.+?)[«"']?\s*$/iu,
    /replace\s+[«"']?(.+?)[«"']?\s+with\s+[«"']?(.+?)[«"']?\s*$/iu,
  ];
  for (const re of patterns) {
    const m = message.trim().match(re);
    if (m && m[1]?.trim() && m[2]?.trim()) {
      return { find_text: m[1].trim(), new_text: m[2].trim() };
    }
  }
  return null;
}

function extractPageTargetHint(message) {
  if (!message?.trim()) return null;
  const patterns = [
    /(?:удали|удалить|delete|remove|archive)\s+(?:страниц(?:у|е)\s+)?[«"']?([\p{L}\p{N}_«"'-]+?)(?=\s|$|\.|,)/iu,
    /(?:на|в)\s+страниц(?:у|е)\s+([\p{L}\p{N}_«"'-]+?)(?=\s+(?:замени|добавь|запиши|допиши|исправь|измени|поменяй)|\s*$)/iu,
    /(?:на|в)\s+страниц(?:у|е)\s+[«"']?([^«"'\n,.:;]+)/iu,
    /(?:добавь|запиши|допиши|обнови|внеси|замени|исправь|измени|поменяй)\s+(?:в|на)\s+страниц(?:у|е)\s+[«"']?([^«"'\n,.:;]+)/iu,
    /(?:to|on|into)\s+(?:page|note)\s+[«"']?([^«"'\n,.]+)/iu,
  ];
  for (const re of patterns) {
    const m = message.trim().match(re);
    if (m?.[1]?.trim() && m[1].trim().length <= 120) return m[1].trim();
  }
  return null;
}

function impliesCreateNew(message) {
  if (!message?.trim()) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('новую страницу') ||
    lower.includes('новая страница') ||
    lower.includes('create new') ||
    lower.includes('new page') ||
    lower.includes('создай новую')
  );
}

/** @param {string} toolName @param {string} message @param {object} constraints */
export function buildNotionToolArguments(toolName, message, constraints = {}) {
  const args = { ...(constraints || {}) };
  const n = (toolName || '').toLowerCase();
  const text = message || '';

  if (n.includes('delete') || n.includes('remove') || n.includes('archive')) {
    const pageHint = extractPageTargetHint(text) || args.page_title;
    if (pageHint) args.page_title = pageHint;
    return args;
  }

  if (n.includes('edit')) {
    const pair = extractReplacePair(text);
    if (pair) {
      args.find_text = args.find_text || pair.find_text;
      args.new_text = args.new_text || pair.new_text;
      args.replace_with = args.replace_with || pair.new_text;
    }
    const pageHint = extractPageTargetHint(text) || args.page_title;
    if (pageHint) args.page_title = pageHint;
    return args;
  }

  if (n.includes('write') || n.includes('create')) {
    const createNew = args.create_new === true || impliesCreateNew(text);
    args.create_new = createNew;
    args.content = args.content || text;
    args.message = args.message || text;
    if (createNew && args.title) {
      /* keep router-provided title */
    } else if (createNew) {
      const title = extractPageTargetHint(text);
      if (title) args.title = title;
    } else {
      const pageHint = extractPageTargetHint(text) || args.page_title;
      if (pageHint) args.page_title = pageHint;
    }
    return args;
  }

  const query = args.query || args.q || text;
  args.query = query;
  args.q = query;
  args.content = args.content || query;
  args.message = args.message || query;
  return args;
}

function stepHasPageTarget(args) {
  return !!(args?.page_id || args?.page_url);
}

function priorHasResolvablePage(priorResults) {
  for (let i = (priorResults || []).length - 1; i >= 0; i--) {
    const row = priorResults[i];
    if (!row?.ok) continue;
    const n = (row.toolName || '').toLowerCase();
    if (n.includes('search') && row.summary) return true;
    if (row.artifacts?.page_url) return true;
  }
  return false;
}

function needsSearchBefore(toolName, args, priorResults) {
  const n = (toolName || '').toLowerCase();
  if (n.includes('search')) return false;
  if (stepHasPageTarget(args)) return false;
  if (priorHasResolvablePage(priorResults)) return false;
  return n.includes('write') || n.includes('edit') || n.includes('create') || n.includes('delete');
}

/**
 * @param {object} step — orchestrator step (toolName and/or task)
 * @param {Array<object>} priorResults — from L1 chain (other connectors)
 */
export function resolveNotionInternalSteps(step, priorResults = []) {
  if (step?.toolName) {
    return [
      {
        connectorKey: 'notion',
        toolName: step.toolName,
        arguments: step.arguments || {},
        label: step.label || step.toolName,
      },
    ];
  }

  const taskMessage = step?.task?.message || step?.message || '';
  const userMessage = step?.userMessage || step?.task?.userMessage || '';
  const constraints = step?.task?.constraints || {};
  let toolName = resolveNotionToolName(taskMessage);
  let argsMessage = taskMessage;
  if (!toolName && userMessage) {
    toolName = resolveNotionToolName(userMessage);
    if (toolName) {
      argsMessage = userMessage;
    }
  }
  if (!toolName) {
    return [];
  }

  const args = buildNotionToolArguments(toolName, argsMessage, constraints);
  const internal = [];

  if (needsSearchBefore(toolName, args, priorResults)) {
    const hint = args.page_title || constraints.page_hint || null;
    internal.push({
      connectorKey: 'notion',
      toolName: 'notion_search',
      arguments: buildNotionToolArguments('notion_search', hint || argsMessage, constraints),
      label: 'Поиск страницы в Notion',
    });
  }

  internal.push({
    connectorKey: 'notion',
    toolName,
    arguments: args,
    label: step?.label || toolName,
  });

  return internal;
}

/** @param {Array<{ ok?: boolean, summary?: string, artifacts?: object }>} internalPrior */
export function buildConnectorArtifacts(internalPrior) {
  const artifacts = {};
  for (let i = internalPrior.length - 1; i >= 0; i--) {
    const row = internalPrior[i];
    if (!row?.ok) continue;
    const urls = (row.summary || '').match(/https:\/\/[^\s)\]]+/g) || [];
    if (urls[0] && !artifacts.page_url) {
      artifacts.page_url = urls[0].replace(/[.,;:!?)]+$/, '');
    }
    if (row.artifacts?.page_url) {
      artifacts.page_url = row.artifacts.page_url;
    }
    if (row.artifacts?.page_title) {
      artifacts.page_title = row.artifacts.page_title;
    }
  }
  return Object.keys(artifacts).length ? artifacts : undefined;
}
