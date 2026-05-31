/**
 * Enrich Notion tool arguments from prior search steps (L2 connector only).
 */

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
  const body = trimmed.slice(2);
  const urlMatch = body.match(/^(.+?)\s+\((https?:\/\/[^)]+)\)\s*$/);
  if (urlMatch) {
    return { title: urlMatch[1].trim(), url: urlMatch[2].trim() };
  }
  return { title: body.trim(), url: null };
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

export function enrichWriteArguments(toolName, args, priorResults) {
  const base = { ...(args || {}) };
  if (!isWriteTool(toolName) || isCreateNew(base)) {
    return base;
  }
  if (base.page_id || base.page_url) {
    return base;
  }
  const hint = base.page_title || base.target_page || base.title || null;
  const picked = pickPageFromPriorSearch(priorResults, hint);
  if (picked?.url) {
    base.page_url = picked.url;
  }
  if (picked?.title && !base.page_title) {
    base.page_title = picked.title;
  }
  return base;
}

export function enrichEditArguments(toolName, args, priorResults) {
  const base = { ...(args || {}) };
  if (!isEditTool(toolName)) {
    return base;
  }
  if (base.page_id || base.page_url) {
    return base;
  }
  const hint = base.page_title || base.target_page || base.title || null;
  const picked = pickPageFromPriorSearch(priorResults, hint);
  if (picked?.url) {
    base.page_url = picked.url;
  }
  if (picked?.title && !base.page_title) {
    base.page_title = picked.title;
  }
  return base;
}

export function enrichNotionToolArguments(toolName, args, priorResults) {
  let out = enrichWriteArguments(toolName, args, priorResults);
  out = enrichEditArguments(toolName, out, priorResults);
  return out;
}
