// After LLM Route: decide if plan HITL is required before connector chain.
const plan = $('LLM Route').first().json;
const needs = requiresPlanApproval(plan);
return [{ json: { needsPlanApproval: needs, plan } }];
