/**
 * Extract Notion page/database UUID from a link or raw id (mirrors mcp-notion NotionIdParser).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX32_RE = /^[0-9a-f]{32}$/i;

function toUuid(hex32) {
  const h = hex32.toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function looksLikeNotionUrl(input) {
  return /notion\.(so|site|com)/i.test(input);
}

function looksLikeUrl(input) {
  return /^https?:\/\//i.test(input) || looksLikeNotionUrl(input);
}

function extractIdFromSegment(segment) {
  if (!segment) return null;
  const dash = segment.lastIndexOf('-');
  if (dash >= 0 && dash < segment.length - 1) {
    const candidate = segment.slice(dash + 1).replace(/-/g, '');
    if (HEX32_RE.test(candidate)) return toUuid(candidate);
  }
  const compact = segment.replace(/-/g, '');
  if (compact.length >= 32) {
    const tail = compact.slice(-32);
    if (HEX32_RE.test(tail)) return toUuid(tail);
  }
  if (HEX32_RE.test(compact)) return toUuid(compact);
  return null;
}

function parseFromNotionUrl(url) {
  try {
    const uri = new URL(url.startsWith('http') ? url : `https://${url}`);
    const path = uri.pathname || '';
    const segment = path.slice(path.lastIndexOf('/') + 1);
    return extractIdFromSegment(segment);
  } catch {
    return null;
  }
}

/** @returns {string|null} normalized UUID or null */
export function parseNotionPageId(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (UUID_RE.test(trimmed)) return trimmed.toLowerCase();
  const noDashes = trimmed.replace(/-/g, '');
  if (noDashes.length === 32 && HEX32_RE.test(noDashes)) return toUuid(noDashes);
  if (looksLikeNotionUrl(trimmed)) return parseFromNotionUrl(trimmed);
  if (looksLikeUrl(trimmed)) return null;
  const match = noDashes.match(/[0-9a-f]{32}/i);
  return match ? toUuid(match[0]) : null;
}

export function isResolvableNotionPageRef(ref) {
  return !!parseNotionPageId(ref);
}
