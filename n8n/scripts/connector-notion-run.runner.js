// Run internal Notion tool steps via generic chat-tool-step.
const prep = $('Parse Connector Task').first().json;
if (!prep.valid) {
  return [
    {
      json: {
        action: 'continue',
        ok: false,
        error: prep.error,
        stepResult: { ok: false, error: prep.error },
      },
    },
  ];
}

const internalPrior = [];
let lastToolName = null;

for (let i = 0; i < prep.internalSteps.length; i++) {
  const internal = prep.internalSteps[i];
  const enrichedArgs = enrichNotionToolArguments(
    internal.toolName,
    internal.arguments || {},
    [...(prep.priorResults || []), ...internalPrior],
  );
  const toolStep = {
    connectorKey: 'notion',
    toolName: internal.toolName,
    arguments: enrichedArgs,
  };

  const res = await this.helpers.httpRequest({
    method: 'POST',
    url: prep.toolStepUrl,
    json: true,
    body: {
      orgId: prep.orgId,
      workspaceId: prep.workspaceId,
      userId: prep.userId,
      runId: prep.runId,
      step: toolStep,
      stepIndex: i + 1,
      totalSteps: prep.internalSteps.length,
      priorResults: internalPrior,
    },
  });

  lastToolName = internal.toolName;

  if (res.action === 'complete') {
    return [
      {
        json: {
          action: 'complete',
          ok: true,
          toolName: lastToolName,
          callback: res.callback,
          stepResult: res.stepResult,
        },
      },
    ];
  }

  const row = {
    stepIndex: i + 1,
    connectorKey: 'notion',
    toolName: internal.toolName,
    label: internal.label,
    ok: res.stepResult?.ok,
    summary: res.stepResult?.summary,
    error: res.stepResult?.error,
  };
  if (isFailedNotionSearch(internal.toolName, row.summary)) {
    row.ok = false;
    row.error = row.summary || 'Страницы не найдены в Notion';
  }
  internalPrior.push(row);

  if (!row.ok) {
    return [
      {
        json: {
          action: 'continue',
          ok: false,
          toolName: lastToolName,
          summary: row.error || res.stepResult?.error || 'Notion step failed',
          error: row.error || res.stepResult?.error,
          stepResult: row,
          artifacts: buildConnectorArtifacts(internalPrior),
        },
      },
    ];
  }
}

const last = internalPrior[internalPrior.length - 1];
return [
  {
    json: {
      action: 'continue',
      ok: true,
      toolName: lastToolName,
      summary: last?.summary,
      stepResult: last,
      artifacts: buildConnectorArtifacts(internalPrior),
    },
  },
];
