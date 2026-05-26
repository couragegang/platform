// n8n Code node entry (bundled with merge-for-route.core.js at build time).
const ctx = $('Parse Context').first().json;
const items = $input.all().map((i) => i.json);
return [{ json: buildRouteRequest(ctx, items) }];
