/**
 * Enrich Notion tool arguments from prior search steps (L2 connector only).
 */

import { isResolvableNotionPageRef, parseNotionPageId } from './notion-id.core.js';

export function isWriteTool(toolName) {
  const n = (toolName || '').toLowerCase();
  return n.includes('write') || n.includes('create');
}

export function isEditTool(toolName) {
  const n = (toolName || '').toLowerCase();
  return n.includes('edit');
}

export function isCreateNew(args) {
  if (!args || typeof args !== 'object') return false;
  const flag = args.create_new;
  if (flag === true || flag === 'true' || flag === 1 || flag === '1') return true;
  const mode = String(args.mode || args.action || '').toLowerCase();
  return mode.includes('create') || mode.includes('new');
}

export function parseSearchResultLine(line) {
  const trimmed = (line || '').trim();
  if (!trimmed.startsWith('- ')) return null;
  let body = trimmed.slice(2);
  let id = null;
  const idMatch = body.match(/\{([0-9a-f-]{36})\}\s*$/i);
  if (idMatch) {
    id = idMatch[1].toLowerCase();
    body = body.slice(0, idMatch.index).trim();
  }
  const urlMatch = body.match(/^(.+?)\s+\((https?:\/\/[^)]+)\)\s*$/);
  if (urlMatch) {
    return { title: urlMatch[1].trim(), url: urlMatch[2].trim(), id };
  }
  return { title: body.trim(), url: null, id };
}

export function extractPagesFromSearchSummary(summary) {
  if (!summary || typeof summary !== 'string') return [];
  return summary
    .split('\n')
    .map(parseSearchResultLine)
    .filter(Boolean);
}

export function pickPageFromPages(pages, pageTitleHint) {
  if (!pages.length) return null;
  if (pageTitleHint) {
    const hint = pageTitleHint.toLowerCase().trim();
    const exact = pages.find((p) => p.title.toLowerCase() === hint);
    if (exact) return exact;
    const partial = pages.find(
      (p) =>
        p.title.toLowerCase().includes(hint) || hint.includes(p.title.toLowerCase()),
    );
    if (partial) return partial;
  }
  if (pages.length === 1) return pages[0];
  return null;
}

export function pickPageFromPriorSearch(priorResults, pageTitleHint) {
  const results = priorResults || [];
  for (let i = results.length - 1; i >= 0; i--) {
    const row = results[i];
    if (!row?.ok) continue;
    const n = (row.toolName || '').toLowerCase();
    if (!n.includes('search') && !n.includes('read') && !n.includes('fetch')) continue;
    const pages = extractPagesFromSearchSummary(row.summary);
    const picked = pickPageFromPages(pages, pageTitleHint);
    if (picked) return picked;
  }
  return null;
}

function hasResolvablePageTarget(args) {
  if (!args) return false;
  if (args.page_id && isResolvableNotionPageRef(args.page_id)) return true;
  if (args.page_url && isResolvableNotionPageRef(args.page_url)) return true;
  return false;
}

function applyPickedPage(base, picked) {
  if (!picked) return;
  if (picked.id) {
    base.page_id = picked.id;
  } else if (picked.url) {
    const parsed = parseNotionPageId(picked.url);
    if (parsed) base.page_id = parsed;
  }
  if (picked.url) {
    base.page_url = picked.url;
  }
  if (picked.title && !base.page_title) {
    base.page_title = picked.title;
  }
}

function enrichPageTargetArguments(toolName, args, priorResults, toolMatcher) {
  const base = { ...(args || {}) };
  if (!toolMatcher(toolName) || isCreateNew(base)) {
    return base;
  }
  const hint = base.page_title || base.target_page || base.title || null;
  const picked = pickPageFromPriorSearch(priorResults, hint);
  if (hasResolvablePageTarget(base)) {
    if (!base.page_id && base.page_url) {
      const parsed = parseNotionPageId(base.page_url);
      if (parsed) base.page_id = parsed;
    }
    return base;
  }
  applyPickedPage(base, picked);
  return base;
}

export function enrichWriteArguments(toolName, args, priorResults) {
  return enrichPageTargetArguments(toolName, args, priorResults, isWriteTool);
}

export function enrichEditArguments(toolName, args, priorResults) {
  return enrichPageTargetArguments(toolName, args, priorResults, isEditTool);
}

export function enrichNotionToolArguments(toolName, args, priorResults) {
  let out = enrichWriteArguments(toolName, args, priorResults);
  out = enrichEditArguments(toolName, out, priorResults);
  return out;
}
