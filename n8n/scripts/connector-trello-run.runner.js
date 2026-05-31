// Run internal Trello step (mock or via chat-tool-step).
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

const internal = prep.internalSteps[0];
const args = internal.arguments || {};

if (prep.trelloMock) {
  const summary = buildTrelloMockSummary(args, internal.toolName);
  return [
    {
      json: {
        action: 'continue',
        ok: true,
        toolName: internal.toolName,
        summary,
        stepResult: { ok: true, summary },
        artifacts: {
          board_name: args.board_name,
          list_name: args.list_name,
          card_name: args.name,
        },
      },
    },
  ];
}

const res = await this.helpers.httpRequest({
  method: 'POST',
  url: prep.toolStepUrl,
  json: true,
  body: {
    orgId: prep.orgId,
    workspaceId: prep.workspaceId,
    userId: prep.userId,
    runId: prep.runId,
    step: {
      connectorKey: 'trello',
      toolName: internal.toolName,
      arguments: args,
    },
    stepIndex: 1,
    totalSteps: 1,
    priorResults: prep.priorResults || [],
  },
});

if (res.action === 'complete') {
  return [
    {
      json: {
        action: 'complete',
        ok: true,
        toolName: internal.toolName,
        callback: res.callback,
        stepResult: res.stepResult,
      },
    },
  ];
}

const ok = res.stepResult?.ok;
return [
  {
    json: {
      action: 'continue',
      ok: !!ok,
      toolName: internal.toolName,
      summary: res.stepResult?.summary,
      error: res.stepResult?.error,
      stepResult: res.stepResult,
      artifacts: ok
        ? {
            board_name: args.board_name,
            list_name: args.list_name,
            card_name: args.name,
          }
        : undefined,
    },
  },
];
