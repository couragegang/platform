const gate = $('Plan Gate').first().json;
const ctx = $('Parse Context').first().json;
return [
  {
    json: {
      ...ctx,
      plan: gate.plan,
      pendingBody: buildPlanPendingBody(gate.plan, ctx),
    },
  },
];
