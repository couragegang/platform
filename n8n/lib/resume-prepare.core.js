/**
 * Pure logic for Resume Prepare (HITL resume path).
 * Used by unit tests; bundled into n8n Code node via build-workflows.mjs.
 */

export function normalizeHistory(historyRaw) {
  return (historyRaw || [])
    .filter((m) => m.role && m.content)
    .map((m) => ({ role: m.role, content: m.content }));
}

export function buildToolContextMessage(hist) {
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

export function lastUserContent(hist) {
  for (let i = hist.length - 1; i >= 0; i--) {
    const t = hist[i];
    if (t.role === 'user' && t.content?.trim()) return t.content.trim();
  }
  return null;
}

export function notionToolArguments(toolName, hist, fallback) {
  const n = (toolName || '').toLowerCase();
  const lastUser = lastUserContent(hist);
  if (n.includes('write') || n.includes('create')) {
    const content = fallback?.trim() || lastUser || '';
    return { content, message: content, title: lastUser };
  }
  const query = lastUser || fallback || '';
  return { query, q: query, content: query, message: query };
}

const NOT_APPROVED = {
  skipInvoke: true,
  payload: {
    status: 'error',
    reply: 'Не удалось выполнить действие: подтверждение не найдено или уже недействительно.',
  },
};

export function prepareResumeInvoke(ctx, historyRaw, pending) {
  if (!pending || pending.status !== 'approved') {
    return NOT_APPROVED;
  }

  const history = normalizeHistory(historyRaw);
  const toolName = pending.toolName;
  const connectorKey = 'notion';
  let toolMessage = buildToolContextMessage(history);
  if (!toolMessage?.trim()) toolMessage = ctx.message;
  const toolArguments = notionToolArguments(toolName, history, toolMessage);

  return { toolName, connectorKey, toolArguments, skipInvoke: false };
}
