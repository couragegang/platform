const ctx = $('Parse Context').first().json;
const historyRaw = $('Resume History').first().json.items || [];
const pending = $('Resume Pending').first().json;

const history = historyRaw
  .filter((m) => m.role && m.content)
  .map((m) => ({ role: m.role, content: m.content }));

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

function lastUserContent(hist) {
  for (let i = hist.length - 1; i >= 0; i--) {
    const t = hist[i];
    if (t.role === 'user' && t.content?.trim()) return t.content.trim();
  }
  return null;
}

function notionToolArguments(toolName, hist, fallback) {
  const n = (toolName || '').toLowerCase();
  const lastUser = lastUserContent(hist);
  if (n.includes('write') || n.includes('create')) {
    const content = fallback?.trim() || lastUser || '';
    return { content, message: content, title: lastUser };
  }
  const query = lastUser || fallback || '';
  return { query, q: query, content: query, message: query };
}

if (!pending || pending.status !== 'approved') {
  return [
    {
      json: {
        skipInvoke: true,
        payload: {
          status: 'error',
          reply: 'Не удалось выполнить действие: подтверждение не найдено или уже недействительно.',
        },
      },
    },
  ];
}

const toolName = pending.toolName;
const connectorKey = 'notion';
let toolMessage = buildToolContextMessage(history);
if (!toolMessage?.trim()) toolMessage = ctx.message;
const toolArguments = notionToolArguments(toolName, history, toolMessage);

return [{ json: { toolName, connectorKey, toolArguments, skipInvoke: false } }];
