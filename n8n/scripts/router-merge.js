// After Merge Context: items from Load History, Load Installations, Load Knowledge
const ctx = $('Parse Context').first().json;
const items = $input.all().map((i) => i.json);

let historyItems = [];
let installations = { items: [] };
let knowledge = { items: [] };
for (const j of items) {
  if (Array.isArray(j.items) && j.items[0]?.role) historyItems = j.items;
  else if (Array.isArray(j.items) && j.items[0]?.connectorKey !== undefined) installations = j;
  else if (Array.isArray(j.items) && (j.items[0]?.snippet !== undefined || j.items.length === 0)) knowledge = j;
}

const history = (historyItems || [])
  .filter((m) => m.role && m.content)
  .map((m) => ({ role: m.role, content: m.content }));

const activeConnectors = [];
for (const inst of installations.items || []) {
  const st = inst.status || '';
  if (st === 'active' || st === 'error') activeConnectors.push(inst.connectorKey);
}

const knowledgeContext = (knowledge.items || [])
  .slice(0, 5)
  .map((h) => `- ${h.title || 'doc'}: ${h.snippet || ''}`)
  .join('\n');

function mentionsNotion(lower) {
  return lower.includes('notion') || lower.includes('ноушен') || lower.includes('ношен');
}
function matchesWriteIntent(lower) {
  return ['сохран', 'запис', 'созда', 'добав', 'write', 'create', 'update', 'добавь'].some((w) => lower.includes(w));
}
function matchesSearchFollowUp(lower) {
  if (lower.length > 40) return false;
  return ['назван', 'тема', 'topic', 'name', 'страниц'].some((w) => lower.includes(w)) || lower === 'название';
}
function matchesListIntent(lower) {
  return (
    ((lower.includes('какие') || lower.includes('какой') || lower.includes('что есть')) && lower.includes('страниц')) ||
    (lower.includes('список') && lower.includes('страниц')) ||
    (lower.includes('перечисли') && lower.includes('страниц')) ||
    (lower.includes('show') && lower.includes('page'))
  );
}
function matchesSearchIntent(lower) {
  return ['найди', 'поиск', 'search', 'find', 'прочит', 'покаж', 'fetch'].some((w) => lower.includes(w));
}

function resolveToolIntent(text, connectors) {
  if (!text?.trim() || !connectors?.length || !connectors.includes('notion')) return null;
  const lower = text.toLowerCase();
  const notionOnly = connectors.length === 1 && connectors[0] === 'notion';
  if (!mentionsNotion(lower) && !notionOnly) return null;
  if (matchesListIntent(lower) || matchesSearchIntent(lower) || matchesSearchFollowUp(lower)) {
    return { connectorKey: 'notion', toolName: 'notion_search' };
  }
  if (matchesWriteIntent(lower)) return { connectorKey: 'notion', toolName: 'notion_write_page' };
  return null;
}

function lastUserContent(hist) {
  for (let i = hist.length - 1; i >= 0; i--) {
    const t = hist[i];
    if (t.role === 'user' && t.content?.trim()) return t.content.trim();
  }
  return null;
}

function deriveTitle(lastUser) {
  if (!lastUser?.trim()) return null;
  let t = lastUser.trim();
  const lower = t.toLowerCase();
  for (const prefix of ['запиши в notion', 'сохрани в notion', 'запиши', 'сохрани', 'создай']) {
    if (lower.startsWith(prefix)) {
      t = t.substring(prefix.length).trim();
      if (t.startsWith(':')) t = t.substring(1).trim();
      break;
    }
  }
  return t || null;
}

function notionToolArguments(toolName, hist, fallback) {
  const n = (toolName || '').toLowerCase();
  const lastUser = lastUserContent(hist);
  if (n.includes('write') || n.includes('create')) {
    const title = deriveTitle(lastUser);
    const content = fallback?.trim() || lastUser || '';
    const args = { content, message: content };
    if (title) args.title = title;
    return args;
  }
  const query = lastUser || fallback || '';
  return { query, q: query, content: query, message: query };
}

function buildToolContextMessage(hist) {
  const parts = [];
  let lastAssistant = null;
  for (const turn of hist) {
    if (turn.role === 'assistant') lastAssistant = turn;
    else if (turn.role === 'user' && turn.content?.trim()) parts.push(turn.content.trim());
  }
  let sb = '';
  if (lastAssistant?.content?.trim()) sb += 'Контекст ассистента: ' + lastAssistant.content.trim();
  if (parts.length) {
    if (sb) sb += '\n';
    sb += 'Запросы пользователя: ' + parts.join(' | ');
  }
  return sb;
}

function buildMcpContextPrompt(connectors) {
  if (!connectors?.length) return null;
  let sb = 'В workspace подключены интеграции: ' + connectors.join(', ') + '. ';
  if (connectors.includes('notion')) {
    sb +=
      'Для записи в Notion — notion_write_page (может потребоваться подтверждение). Для поиска — notion_search. ';
  }
  return sb;
}

const message = ctx.message;
const toolContextMessage = buildToolContextMessage(history);
const resolvedTool = ctx.orgId ? resolveToolIntent(message, activeConnectors) : null;
const toolArguments = resolvedTool
  ? notionToolArguments(resolvedTool.toolName, history, toolContextMessage)
  : null;

return [
  {
    json: {
      ...ctx,
      history,
      activeConnectors,
      knowledgeContext,
      toolContextMessage,
      resolvedTool,
      toolArguments,
      mcpContextPrompt: buildMcpContextPrompt(activeConnectors),
    },
  },
];
