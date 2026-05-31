// Resume approved plan — run full connector chain without re-routing.
const env = typeof $env !== 'undefined' ? $env : process.env;
const ctx = $('Parse Context').first().json;
const prep = $('Resume Prepare').first().json;
const plan = prep.plan;

if (!plan?.steps?.length) {
  return [{ json: { skipped: true, reason: 'no plan steps' } }];
}

const outcome = await executeConnectorChain(ctx, plan, env, (url, body) =>
  this.helpers.httpRequest({ method: 'POST', url, json: true, body }),
);

if (outcome.completedInStep) {
  return [
    {
      json: {
        completedInStep: true,
        callback: outcome.callback,
        stepIndex: outcome.stepIndex,
      },
    },
  ];
}

if (outcome.aborted) {
  return [
    {
      json: {
        completedInStep: false,
        aborted: true,
        priorResults: outcome.priorResults,
        plan: outcome.plan,
        status: 'error',
        reply: outcome.error,
      },
    },
  ];
}

return [{ json: { completedInStep: false, priorResults: outcome.priorResults, plan: outcome.plan } }];
