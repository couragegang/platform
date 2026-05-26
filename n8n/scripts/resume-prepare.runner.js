// n8n Code node entry (bundled with resume-prepare.core.js at build time).
const ctx = $('Parse Context').first().json;
const historyRaw = $('Resume History').first().json.items || [];
const pending = $('Resume Pending').first().json;
const result = prepareResumeInvoke(ctx, historyRaw, pending);
return [{ json: result }];
