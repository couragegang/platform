/**
 * Detect failed / empty Notion search for plan branching (onFailure).
 */

import { extractPagesFromSearchSummary } from './notion-enrich.core.js';

/** @param {string} toolName @param {string} summary */
export function isFailedNotionSearch(toolName, summary) {
  const n = (toolName || '').toLowerCase();
  if (!n.includes('search')) {
    return false;
  }
  const s = (summary || '').toLowerCase();
  if (s.includes('ничего не найдено') || s.includes('not found') || s.includes('0 страниц')) {
    return true;
  }
  return extractPagesFromSearchSummary(summary).length === 0;
}
