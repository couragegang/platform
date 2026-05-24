const inv = $('MCP Invoke').first().json;
return [
  {
    json: {
      action: 'continue',
      stepResult: {
        ok: inv.ok,
        summary: inv.summary,
        error: inv.error,
      },
    },
  },
];
