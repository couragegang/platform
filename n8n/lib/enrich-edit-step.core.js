/**
 * Enrich notion_edit_block arguments (page from prior search).
 */

import {
  isCreateNew,
  pickPageFromPriorSearch,
} from './enrich-write-step.core.js';

export function isEditTool(toolName) {
  const n = (toolName || '').toLowerCase();
  return n.includes('edit');
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

export function enrichToolStepArguments(toolName, args, priorResults) {
  let out = { ...(args || {}) };
  if (!isCreateNew(out)) {
    const hint = out.page_title || out.target_page || out.title || null;
    const picked = pickPageFromPriorSearch(priorResults, hint);
    if (picked?.url && !out.page_url && !out.page_id) {
      out.page_url = picked.url;
    }
    if (picked?.title && !out.page_title) {
      out.page_title = picked.title;
    }
  }
  out = enrichEditArguments(toolName, out, priorResults);
  return out;
}
