/**
 * Conditional plan execution (ADR-003 phase C): skipIf / onFailure per L1 step.
 */

/** @param {Array<{ ok?: boolean, connectorKey?: string, skipped?: boolean }>} priorResults */
export function anyPriorFailed(priorResults) {
  return (priorResults || []).some((r) => r && r.ok === false && !r.skipped);
}

/**
 * @param {string|null|undefined} skipIf
 * @param {Array<object>} priorResults
 * @returns {boolean} true = skip this step
 */
export function evaluateSkipIf(skipIf, priorResults) {
  if (!skipIf || typeof skipIf !== 'string') {
    return false;
  }
  const expr = skipIf.trim().toLowerCase();
  if (!expr) return false;

  if (expr === 'priorfailed' || expr === 'any_prior_failed') {
    return anyPriorFailed(priorResults);
  }

  const priorNotOk = expr.match(/^priorok:(\d+)$/);
  if (priorNotOk) {
    const idx = Number(priorNotOk[1]);
    const row = (priorResults || [])[idx];
    return !row || row.ok === false;
  }

  const connectorFail = expr.match(/^priorconnector:([a-z0-9_-]+)\.failed$/);
  if (connectorFail) {
    const key = connectorFail[1];
    return (priorResults || []).some((r) => r?.connectorKey === key && r.ok === false && !r.skipped);
  }

  return false;
}

/**
 * @param {object} stepResult
 * @param {string|null|undefined} onFailure
 */
export function handleStepFailure(stepResult, onFailure) {
  if (!stepResult || stepResult.ok !== false) {
    return { action: 'continue' };
  }
  const policy = (onFailure || 'continue').trim().toLowerCase();
  if (policy === 'abort') {
    return {
      action: 'abort',
      error: stepResult.error || stepResult.summary || 'Шаг завершился с ошибкой',
    };
  }
  if (policy === 'skip_remaining' || policy === 'skip') {
    return { action: 'skip_remaining' };
  }
  return { action: 'continue' };
}

/** @param {object} step */
export function skippedStepResult(step, stepIndex) {
  return {
    stepIndex,
    connectorKey: step.connectorKey,
    toolName: step.toolName,
    label: step.label || step.connectorKey,
    ok: true,
    skipped: true,
    summary: 'Шаг пропущен (skipIf)',
  };
}
