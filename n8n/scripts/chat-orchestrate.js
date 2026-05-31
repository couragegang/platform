/**
 * @deprecated Monolithic single Code node — use build-workflows.mjs (ADR-003).
 * L1 Notion heuristics removed in phase D; use n8n orchestrator + connector workflows.
 * Regenerate: node platform/n8n/scripts/build-workflow-json.mjs
 * Logic split: parse-context.js, router-merge.js, resume-prepare.js
 */
const env = typeof $env !== 'undefined' ? $env : process.env;
const CFG = {
  aiBase: env.N8N_AI_BASE_URL || 'http://ai:8083/v1/ai',
  mcpBase: env.N8N_MCP_BASE_URL || 'http://mcp:8081/v1/mcp',
  policyBase: env.N8N_POLICY_BASE_URL || 'http://policy:8085/v1/policy',
  knowledgeBase: env.N8N_KNOWLEDGE_BASE_URL || 'http://knowledge:8088/v1/knowledge',
  aiKey: env.AI_INTERNAL_API_KEY || 'dev-internal-key',
  policyKey: env.POLICY_INTERNAL_API_KEY || 'dev-internal-key',
  mcpKey: env.MCP_INTERNAL_API_KEY || 'dev-internal-key',
};

const body = $input.first().json.body;
const runId = body.runId;
const conversationId = body.conversationId;
const orgId = body.orgId;
const workspaceId = body.workspaceId;
const userId = body.userId;
const message = body.message || '';
const approvedPendingApprovalId = body.approvedPendingApprovalId;

async function http(opts) {
  return await this.helpers.httpRequest({ json: true, ...opts });
}

async function completeRun(payload) {
  await http.call(this, {
    method: 'POST',
    url: `${CFG.aiBase}/internal/runs/${runId}/complete`,
    headers: { 'X-Ai-Internal-Key': CFG.aiKey, 'Content-Type': 'application/json' },
    body: payload,
  });
}

function toHistory(items) {
  return (items || [])
    .filter((m) => m.role && m.content)
    .map((m) => ({ role: m.role, content: m.content }));
}

function buildToolContextMessage(history) {
  const parts = [];
  let lastAssistant = null;
  for (const turn of history) {
    if (turn.role === 'assistant') lastAssistant = turn;
    else if (turn.role === 'user' && turn.content?.trim()) parts.push(turn.content.trim());
  }
  let sb = '';
  if (lastAssistant?.content?.trim()) {
    sb += 'Контекст ассистента: ' + lastAssistant.content.trim();
  }
  if (parts.length) {
    if (sb) sb += '\n';
    sb += 'Запросы пользователя: ' + parts.join(' | ');
  }
  return sb;
}

function mentionsNotion(lower) {
  return lower.includes('notion') || lower.includes('ноушен') || lower.includes('ношен');
}

function matchesWriteIntent(lower) {
  return (
    ['сохран', 'запис', 'созда', 'добав', 'write', 'create', 'update', 'добавь'].some((w) =>
      lower.includes(w)
    )
  );
}

function matchesSearchFollowUp(lower) {
  if (lower.length > 40) return false;
  return ['назван', 'тема', 'topic', 'name', 'страниц'].some((w) => lower.includes(w)) || lower === 'название';
}

function matchesListIntent(lower) {
  return (
    ((lower.includes('какие') || lower.includes('какой') || lower.includes('что есть')) &&
      lower.includes('страниц')) ||
    (lower.includes('список') && lower.includes('страниц')) ||
    (lower.includes('перечисли') && lower.includes('страниц')) ||
    (lower.includes('show') && lower.includes('page'))
  );
}

function matchesSearchIntent(lower) {
  return ['найди', 'поиск', 'search', 'find', 'прочит', 'покаж', 'fetch'].some((w) => lower.includes(w));
}

function resolveToolIntent(text, activeConnectors) {
  if (!text?.trim() || !activeConnectors?.length) return null;
  if (!activeConnectors.includes('notion')) return null;
  const lower = text.toLowerCase();
  const notionOnly = activeConnectors.length === 1 && activeConnectors[0] === 'notion';
  if (!mentionsNotion(lower) && !notionOnly) return null;
  if (matchesListIntent(lower) || matchesSearchIntent(lower) || matchesSearchFollowUp(lower)) {
    return { connectorKey: 'notion', toolName: 'notion_search' };
  }
  if (matchesWriteIntent(lower)) {
    return { connectorKey: 'notion', toolName: 'notion_write_page' };
  }
  return null;
}

function lastUserContent(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const t = history[i];
    if (t.role === 'user' && t.content?.trim()) return t.content.trim();
  }
  return null;
}

function deriveTitle(lastUser) {
  if (!lastUser?.trim()) return null;
  let t = lastUser.trim();
  const lower = t.toLowerCase();
  const prefixes = [
    'запиши в notion',
    'запиши в ноушен',
    'сохрани в notion',
    'создай в notion',
    'добавь в notion',
    'запиши',
    'сохрани',
    'создай страницу',
    'создай',
  ];
  for (const prefix of prefixes) {
    if (lower.startsWith(prefix)) {
      t = t.substring(prefix.length).trim();
      if (t.startsWith(':') || t.startsWith('—') || t.startsWith('-')) t = t.substring(1).trim();
      break;
    }
  }
  if (t.length > 120) {
    const dot = t.indexOf('.');
    t = dot > 10 && dot < 120 ? t.substring(0, dot).trim() : t.substring(0, 120).trim() + '…';
  }
  return t || null;
}

function notionToolArguments(toolName, history, contextFallback) {
  const normalized = (toolName || '').toLowerCase();
  const lastUser = lastUserContent(history);
  if (normalized.includes('write') || normalized.includes('create')) {
    const title = deriveTitle(lastUser);
    const content = contextFallback?.trim() || lastUser || '';
    const args = { content, message: content };
    if (title) args.title = title;
    return args;
  }
  const query = lastUser || contextFallback || '';
  return { query, q: query, content: query, message: query };
}

function buildMcpContextPrompt(activeConnectors) {
  if (!activeConnectors?.length) return null;
  let sb = 'В workspace подключены интеграции: ' + activeConnectors.join(', ') + '. ';
  if (activeConnectors.includes('notion')) {
    sb +=
      'Для записи в Notion пользователь должен явно попросить сохранить/создать страницу — тогда сработает notion_write_page (может потребоваться подтверждение). ' +
      'Для поиска и списка страниц — notion_search. ' +
      'Никогда не выдумывай результаты поиска в Notion — если инструмент не вызывался, так и скажи. ';
  }
  sb += 'Не обещай выполнить действие во внешней системе, если пользователь не просил об этом явно.';
  return sb;
}

async function loadHistory() {
  const res = await http.call(this, {
    method: 'GET',
    url: `${CFG.aiBase}/internal/conversations/${conversationId}/messages`,
    qs: { limit: 30 },
    headers: { 'X-Ai-Internal-Key': CFG.aiKey },
  });
  return toHistory(res.items);
}

async function loadActiveConnectors() {
  try {
    const res = await http.call(this, {
      method: 'GET',
      url: `${CFG.mcpBase}/workspaces/${workspaceId}/installations`,
    });
    const keys = [];
    for (const item of res.items || []) {
      const status = item.status || '';
      if (status === 'active' || status === 'error') keys.push(item.connectorKey);
    }
    return keys.filter(Boolean);
  } catch {
    return [];
  }
}

async function loadKnowledgeContext() {
  if (!orgId) return '';
  try {
    const res = await http.call(this, {
      method: 'POST',
      url: `${CFG.knowledgeBase}/search`,
      body: { orgId, workspaceId, query: message, connectorKeys: null, sourceIds: null },
    });
    const hits = res.items || [];
    if (!hits.length) return '';
    return hits
      .slice(0, 5)
      .map((h) => `- ${h.title || 'doc'}: ${h.snippet || ''}`)
      .join('\n');
  } catch {
    return '';
  }
}

async function evaluatePolicy(connectorKey, toolName) {
  if (!orgId) return { decision: 'allow' };
  try {
    const res = await http.call(this, {
      method: 'POST',
      url: `${CFG.policyBase}/internal/evaluate`,
      headers: { 'X-Policy-Internal-Key': CFG.policyKey, 'Content-Type': 'application/json' },
      body: {
        orgId,
        workspaceId,
        connectorKey,
        toolName,
        toolArguments: {},
        userId: userId || undefined,
      },
    });
    return { decision: res.decision || 'allow', pendingApprovalId: res.pendingApprovalId || null };
  } catch {
    return { decision: 'allow' };
  }
}

async function invokeTool(connectorKey, toolName, args) {
  const res = await http.call(this, {
    method: 'POST',
    url: `${CFG.mcpBase}/internal/workspaces/${workspaceId}/tools/invoke`,
    headers: { 'X-Mcp-Internal-Key': CFG.mcpKey, 'Content-Type': 'application/json' },
    body: { connectorKey, toolName, arguments: args || {} },
  });
  return res;
}

async function completeLlm(history, mcpContext, knowledgeContext) {
  let extra = mcpContext || '';
  if (knowledgeContext) {
    extra += (extra ? '\n\n' : '') + 'Релевантные документы из базы знаний:\n' + knowledgeContext;
  }
  const res = await http.call(this, {
    method: 'POST',
    url: `${CFG.aiBase}/internal/llm/complete`,
    headers: { 'X-Ai-Internal-Key': CFG.aiKey, 'Content-Type': 'application/json' },
    body: {
      messages: history,
      mcpContext: extra || null,
      workspaceId: workspaceId ? String(workspaceId) : null,
    },
  });
  return { reply: res.reply || '', status: res.status || 'completed' };
}

async function handleApprovedResume(history) {
  const pending = await http.call(this, {
    method: 'GET',
    url: `${CFG.policyBase}/pending-approvals/${approvedPendingApprovalId}`,
  });
  if (!pending || pending.status !== 'approved') {
    const payload = {
      status: 'error',
      reply: 'Не удалось выполнить действие: подтверждение не найдено или уже недействительно.',
    };
    await completeRun.call(this, payload);
    return payload;
  }
  const connectorKey = 'notion';
  const toolName = pending.toolName;
  let toolMessage = buildToolContextMessage(history);
  if (!toolMessage?.trim()) toolMessage = message;
  const args = notionToolArguments(toolName, history, toolMessage);
  const invoked = await invokeTool.call(this, connectorKey, toolName, args);
  const payload = {
    status: invoked.ok ? 'completed' : 'error',
    reply: invoked.ok ? invoked.summary : 'Ошибка: ' + (invoked.error || 'tool failed'),
    toolName,
    connectorKey,
  };
  await completeRun.call(this, payload);
  return payload;
}

// --- main ---
let result;

if (approvedPendingApprovalId) {
  const history = await loadHistory.call(this);
  result = await handleApprovedResume.call(this, history);
} else {
  const [history, activeConnectors, knowledgeContext] = await Promise.all([
    loadHistory.call(this),
    loadActiveConnectors.call(this),
    loadKnowledgeContext.call(this),
  ]);

  const toolContextMessage = buildToolContextMessage(history);
  const resolvedTool = resolveToolIntent(message, activeConnectors);

  if (resolvedTool && orgId) {
    const policy = await evaluatePolicy.call(this, resolvedTool.connectorKey, resolvedTool.toolName);

    if (policy.decision === 'require_approval') {
      result = {
        status: 'awaiting_approval',
        reply: 'Для выполнения действия требуется подтверждение: ' + resolvedTool.toolName,
        pendingApprovalId: policy.pendingApprovalId,
        toolName: resolvedTool.toolName,
        connectorKey: resolvedTool.connectorKey,
      };
    } else if (policy.decision === 'deny') {
      result = {
        status: 'denied',
        reply: 'Действие запрещено политикой: ' + resolvedTool.toolName,
        toolName: resolvedTool.toolName,
        connectorKey: resolvedTool.connectorKey,
      };
    } else {
      const args = notionToolArguments(resolvedTool.toolName, history, toolContextMessage);
      const invoked = await invokeTool.call(this, resolvedTool.connectorKey, resolvedTool.toolName, args);
      result = {
        status: invoked.ok ? 'completed' : 'error',
        reply: invoked.ok ? invoked.summary : 'Ошибка инструмента: ' + (invoked.error || 'failed'),
        toolName: resolvedTool.toolName,
        connectorKey: resolvedTool.connectorKey,
      };
    }
  } else {
    const mcpContext = buildMcpContextPrompt(activeConnectors);
    const llm = await completeLlm.call(this, history, mcpContext, knowledgeContext);
    result = { status: llm.status, reply: llm.reply };
  }
}

await completeRun.call(this, result);
return [{ json: result }];
