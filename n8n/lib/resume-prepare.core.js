/**
 * Pure logic for Resume Prepare (HITL resume path).
 * Used by unit tests; bundled into n8n Code node via build-workflows.mjs.
 */

import { extractApprovedPlan } from '../core/plan-approval.core.js';

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
  if (n.includes('edit')) {
    return { find_text: '', new_text: '', message: lastUser || fallback || '' };
  }
  if (n.includes('write') || n.includes('create')) {
    const content = fallback?.trim() || lastUser || '';
    return { content, message: content, title: lastUser };
  }
  const query = lastUser || fallback || '';
  return { query, q: query, content: query, message: query };
}

function nonBlank(value) {
  return value != null && String(value).trim() !== '';
}

function hasStoredPayload(toolName, args) {
  const n = (toolName || '').toLowerCase();
  if (n.includes('edit')) {
    return (
      nonBlank(args.find_text) ||
      nonBlank(args.old_text) ||
      nonBlank(args.new_text) ||
      nonBlank(args.replace_with)
    );
  }
  if (n.includes('write') || n.includes('create')) {
    return nonBlank(args.content) || nonBlank(args.message) || nonBlank(args.title);
  }
  return nonBlank(args.query) || nonBlank(args.q) || nonBlank(args.content) || nonBlank(args.message);
}

/** После HITL — аргументы из pending approval (то, что показали пользователю на подтверждение). */
export function resolveToolArguments(toolName, storedArgs, hist, fallback) {
  if (storedArgs && typeof storedArgs === 'object' && hasStoredPayload(toolName, storedArgs)) {
    return { ...storedArgs };
  }
  return notionToolArguments(toolName, hist, fallback);
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

  const plan = extractApprovedPlan(pending);
  if (plan) {
    return {
      resumeMode: 'plan',
      plan,
      skipInvoke: true,
    };
  }

  const history = normalizeHistory(historyRaw);
  const toolName = pending.toolName;
  const connectorKey = pending.connectorKey || 'notion';
  let toolMessage = buildToolContextMessage(history);
  if (!toolMessage?.trim()) toolMessage = ctx.message;
  const toolArguments = resolveToolArguments(
    toolName,
    pending.toolArguments,
    history,
    toolMessage,
  );

  return { resumeMode: 'tool', toolName, connectorKey, toolArguments, skipInvoke: false };
}
