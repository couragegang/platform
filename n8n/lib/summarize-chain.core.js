import { ensureNotionUrlsInReply, extractNotionUrls } from './notion-link.core.js';

/**
 * Single successful tool step with a Notion URL — use MCP summary as-is (no LLM rewrite).
 * @param {Array<{ ok?: boolean, summary?: string }>} priorResults
 */
export function shouldUseDirectSummary(priorResults) {
  if (!priorResults?.length || priorResults.length !== 1) {
    return false;
  }
  const step = priorResults[0];
  if (!step.ok) {
    return false;
  }
  return extractNotionUrls(step.summary || '').length > 0;
}

/** @param {Array<{ summary?: string }>} priorResults */
export function buildDirectReply(priorResults) {
  const summary = (priorResults[0]?.summary || '').trim();
  return ensureNotionUrlsInReply(summary, priorResults);
}

/** @param {Array<{ stepIndex?: number, label?: string, toolName?: string, ok?: boolean, summary?: string, error?: string }>} priorResults */
export function buildSummarizeContext(priorResults) {
  const lines = (priorResults || []).map(
    (r, i) =>
      `Шаг ${r.stepIndex ?? i + 1}: ${r.label || r.toolName} — ${r.ok ? r.summary : 'ошибка: ' + (r.error || '')}`,
  );
  return (
    'Результаты выполненных инструментов:\n' +
    lines.join('\n') +
    '\n\nСформируй краткий ответ пользователю на основе этих результатов. ' +
    'Обязательно сохрани в ответе все ссылки на страницы Notion (https://notion.so/… или https://notion.site/…) из результатов инструментов.'
  );
}

/**
 * @param {Array<{ summary?: string }>} priorResults
 * @param {string} llmReply
 */
export function finalizeChainReply(priorResults, llmReply) {
  return ensureNotionUrlsInReply(llmReply || '', priorResults || []);
}
