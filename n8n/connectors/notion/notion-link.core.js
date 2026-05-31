/** Matches Notion page URLs (notion.so and notion.site). */
export const NOTION_URL_RE =
  /https:\/\/(?:[\w-]+\.)*notion\.(?:so|site)\/[^\s)\]"'<>]+/gi;

/** @param {string} text */
export function extractNotionUrls(text) {
  if (!text) {
    return [];
  }
  const seen = new Set();
  const urls = [];
  for (const match of text.matchAll(NOTION_URL_RE)) {
    const url = match[0].replace(/[.,;:!?)]+$/, '');
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

/**
 * @param {string} reply
 * @param {Array<{ summary?: string }>|string[]} sources
 */
export function ensureNotionUrlsInReply(reply, sources) {
  const texts = (sources || []).map((s) => (typeof s === 'string' ? s : s?.summary || ''));
  const urls = extractNotionUrls(texts.join('\n'));
  if (!urls.length) {
    return reply || '';
  }

  let result = (reply || '').trim();
  const missing = urls.filter((url) => !result.includes(url));
  if (!missing.length) {
    return result;
  }

  const links = missing.map((url) => `[Открыть страницу в Notion](${url})`).join('\n');
  return result ? `${result}\n\n${links}` : links;
}
