/**
 * Generates chat-orchestrator-v0.json + chat-tool-step.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { bundleN8nCode } from './bundle-n8n-code.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

const parseContext = read('parse-context.js');
const mergeForRoute = bundleN8nCode(['core/merge-for-route.core.js'], 'scripts/merge-for-route.runner.js');
const runToolChain = bundleN8nCode(
  ['core/plan-branching.core.js', 'core/run-connector-chain.core.js'],
  'scripts/run-connector-chain.runner.js',
);
const summarizeChain = bundleN8nCode(
  ['connectors/notion/notion-link.core.js', 'core/summarize-chain.core.js'],
  'scripts/summarize-chain.runner.js',
);
const toolStepParse = read('tool-step-parse.runner.js');
const connectorNotionParse = bundleN8nCode(
  ['connectors/notion/notion-router.core.js'],
  'scripts/connector-notion-parse.runner.js',
);
const connectorNotionRun = bundleN8nCode(
  [
    'connectors/notion/notion-router.core.js',
    'connectors/notion/notion-enrich.core.js',
    'connectors/notion/notion-search-outcome.core.js',
  ],
  'scripts/connector-notion-run.runner.js',
);
const connectorTrelloParse = bundleN8nCode(
  ['connectors/trello/trello-router.core.js'],
  'scripts/connector-trello-parse.runner.js',
);
const connectorTrelloRun = bundleN8nCode(
  ['connectors/trello/trello-router.core.js'],
  'scripts/connector-trello-run.runner.js',
);
const toolStepBuildError = read('tool-step-build-error.js');
const toolStepReturnComplete = read('tool-step-return-complete.js');
const toolStepReturnContinue = read('tool-step-return-continue.js');
const resumePrepare = bundleN8nCode(
  ['core/plan-approval.core.js', 'lib/resume-prepare.core.js'],
  'scripts/resume-prepare.runner.js',
);
const planGate = bundleN8nCode(
  ['core/plan-approval.core.js'],
  'scripts/plan-gate.runner.js',
);
const planPendingBody = bundleN8nCode(
  ['core/plan-approval.core.js'],
  'scripts/plan-pending-body.runner.js',
);
const resumeRunChain = bundleN8nCode(
  ['core/plan-branching.core.js', 'core/run-connector-chain.core.js'],
  'scripts/resume-run-chain.runner.js',
);

const nid = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function codeNode(name, pos, jsCode) {
  return {
    parameters: { mode: 'runOnceForAllItems', jsCode },
    id: nid(name),
    name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: pos,
  };
}

function httpPost(name, pos, url, body, headers = []) {
  return {
    parameters: {
      method: 'POST',
      url,
      sendHeaders: true,
      headerParameters: { parameters: headers },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: body,
      options: { response: { response: { neverError: true } } },
    },
    id: nid(name),
    name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: pos,
  };
}

function httpGet(name, pos, url, headers = [], query = []) {
  return {
    parameters: {
      method: 'GET',
      url,
      sendHeaders: true,
      headerParameters: { parameters: headers },
      sendQuery: query.length > 0,
      queryParameters: { parameters: query },
      options: { response: { response: { neverError: true } } },
    },
    id: nid(name),
    name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: pos,
  };
}

const ctx = "$('Parse Context').first().json";
const stepCtx = "$('Parse Step Context').first().json";

// Стабильные id — import перезаписывает ту же запись, без дубликатов по имени.
const orchestrator = {
  id: 'cgChatOrchestr01',
  name: 'chat-orchestrator',
  nodes: [
    {
      // onReceived: ответ webhook сразу; ai-runtime ждёт callback, не HTTP-ответ workflow.
      parameters: { httpMethod: 'POST', path: 'chat-orchestrator', responseMode: 'onReceived', options: {} },
      id: 'webhook-orchestrator',
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [200, 400],
      webhookId: 'chat-orchestrator',
    },
    codeNode('Parse Context', [400, 400], parseContext),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'resume',
              leftValue: `={{ ${ctx}.approvedPendingApprovalId }}`,
              rightValue: '',
              operator: { type: 'string', operation: 'notEmpty', singleValue: true },
            },
          ],
          combinator: 'and',
        },
      },
      id: 'if-hitl-resume',
      name: 'IF HITL Resume?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [600, 400],
    },
    httpGet(
      'Resume History',
      [820, 280],
      `={{ ${ctx}.aiBase }}/internal/conversations/{{ ${ctx}.conversationId }}/messages`,
      [{ name: 'X-Ai-Internal-Key', value: `={{ ${ctx}.aiKey }}` }],
      [{ name: 'limit', value: '30' }],
    ),
    httpGet(
      'Resume Pending',
      [820, 400],
      `={{ ${ctx}.policyBase }}/pending-approvals/{{ ${ctx}.approvedPendingApprovalId }}`,
      [],
    ),
    {
      parameters: { mode: 'append', numberInputs: 2 },
      id: 'resume-merge',
      name: 'Resume Merge',
      type: 'n8n-nodes-base.merge',
      typeVersion: 3.2,
      position: [1020, 340],
    },
    codeNode('Resume Prepare', [1220, 340], resumePrepare),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'plan-resume',
              leftValue: '={{ $("Resume Prepare").first().json.resumeMode === "plan" ? "yes" : "" }}',
              rightValue: '',
              operator: { type: 'string', operation: 'notEmpty', singleValue: true },
            },
          ],
          combinator: 'and',
        },
      },
      id: 'if-plan-resume',
      name: 'IF Plan Resume?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [1420, 240],
    },
    codeNode('Resume Run Connector Chain', [1620, 160], resumeRunChain),
    httpPost(
      'Resume MCP',
      [1420, 340],
      `={{ ${ctx}.mcpBase }}/internal/workspaces/{{ ${ctx}.workspaceId }}/tools/invoke`,
      `={{ JSON.stringify({ connectorKey: $json.connectorKey, toolName: $json.toolName, arguments: $json.toolArguments }) }}`,
      [
        { name: 'X-Mcp-Internal-Key', value: `={{ ${ctx}.mcpKey }}` },
        { name: 'Content-Type', value: 'application/json' },
      ],
    ),
    codeNode('Resume Callback', [1620, 340], `const ctx = $('Parse Context').first().json;
const prep = $('Resume Prepare').first().json;
let payload = prep.payload;
if (!prep.skipInvoke) {
  const inv = $('Resume MCP').first().json;
  payload = { status: inv.ok ? 'completed' : 'error', reply: inv.ok ? inv.summary : ('Ошибка: ' + (inv.error||'failed')), toolName: prep.toolName, connectorKey: prep.connectorKey };
}
await this.helpers.httpRequest({ method:'POST', url: ctx.aiBase + '/internal/runs/' + ctx.runId + '/complete', headers:{'X-Ai-Internal-Key':ctx.aiKey,'Content-Type':'application/json'}, body: payload, json:true });
return [{ json: payload }];`),
    httpGet(
      'Load History',
      [820, 520],
      `={{ ${ctx}.aiBase }}/internal/conversations/{{ ${ctx}.conversationId }}/messages`,
      [{ name: 'X-Ai-Internal-Key', value: `={{ ${ctx}.aiKey }}` }],
      [{ name: 'limit', value: '30' }],
    ),
    httpGet(
      'Load Installations',
      [820, 640],
      `={{ ${ctx}.mcpBase }}/workspaces/{{ ${ctx}.workspaceId }}/installations`,
      [],
    ),
    httpPost(
      'Load Knowledge',
      [820, 760],
      `={{ ${ctx}.knowledgeBase }}/search`,
      `={{ JSON.stringify({ orgId: ${ctx}.orgId, workspaceId: ${ctx}.workspaceId, query: ${ctx}.message, connectorKeys: null, sourceIds: null }) }}`,
      [{ name: 'Content-Type', value: 'application/json' }],
    ),
    {
      parameters: { mode: 'append', numberInputs: 3 },
      id: 'merge-for-route',
      name: 'Merge for Route',
      type: 'n8n-nodes-base.merge',
      typeVersion: 3.2,
      position: [1040, 640],
    },
    codeNode('Prepare Route Body', [1240, 640], mergeForRoute),
    httpPost(
      'LLM Route',
      [1440, 640],
      `={{ $('Prepare Route Body').first().json.aiBase }}/internal/llm/route`,
      `={{ JSON.stringify($('Prepare Route Body').first().json.routeRequest) }}`,
      [
        { name: 'X-Ai-Internal-Key', value: `={{ $('Prepare Route Body').first().json.aiKey }}` },
        { name: 'Content-Type', value: 'application/json' },
      ],
    ),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'chain',
              leftValue:
                '={{ ($json.mode === "tool_chain" || $json.mode === "connector_chain") && ($json.steps || []).length > 0 ? "yes" : "" }}',
              rightValue: '',
              operator: { type: 'string', operation: 'notEmpty', singleValue: true },
            },
          ],
          combinator: 'and',
        },
      },
      id: 'if-tool-chain',
      name: 'IF Tool Chain?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [1640, 640],
    },
    codeNode('Plan Gate', [1860, 480], planGate),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'plan-hitl',
              leftValue: '={{ $json.needsPlanApproval ? "yes" : "" }}',
              rightValue: '',
              operator: { type: 'string', operation: 'notEmpty', singleValue: true },
            },
          ],
          combinator: 'and',
        },
      },
      id: 'if-needs-plan-approval',
      name: 'IF Needs Plan Approval?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [2060, 480],
    },
    codeNode('Build Plan Pending Body', [2280, 400], planPendingBody),
    httpPost(
      'Create Plan Pending',
      [2500, 400],
      `={{ ${ctx}.policyBase }}/internal/pending-approvals`,
      `={{ JSON.stringify($('Build Plan Pending Body').first().json.pendingBody) }}`,
      [
        { name: 'X-Policy-Internal-Key', value: `={{ ${ctx}.policyKey }}` },
        { name: 'Content-Type', value: 'application/json' },
      ],
    ),
    httpPost(
      'Format Plan Approval',
      [2720, 400],
      `={{ ${ctx}.aiBase }}/internal/hitl/format-plan-approval`,
      `={{ JSON.stringify({
        steps: $('Build Plan Pending Body').first().json.plan.steps || [],
        reasoning: $('Build Plan Pending Body').first().json.plan.reasoning
      }) }}`,
      [
        { name: 'X-Ai-Internal-Key', value: `={{ ${ctx}.aiKey }}` },
        { name: 'Content-Type', value: 'application/json' },
      ],
    ),
    httpPost(
      'Callback Plan Awaiting',
      [2940, 400],
      `={{ ${ctx}.aiBase }}/internal/runs/{{ ${ctx}.runId }}/complete`,
      `={{ JSON.stringify({
        status: "awaiting_plan_approval",
        reply: $("Format Plan Approval").first().json.message,
        pendingApprovalId: $("Create Plan Pending").first().json.body || $("Create Plan Pending").first().json,
        approvalKind: "plan"
      }) }}`,
      [
        { name: 'X-Ai-Internal-Key', value: `={{ ${ctx}.aiKey }}` },
        { name: 'Content-Type', value: 'application/json' },
      ],
    ),
    codeNode(
      'Done In Plan Step',
      [3160, 400],
      `return [{ json: { status: 'completed', reply: 'План отправлен на подтверждение (callback уже отправлен).' } }];`,
    ),
    codeNode('Run Connector Chain', [2280, 560], runToolChain),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'aborted',
              leftValue: '={{ $json.aborted ? "yes" : "" }}',
              rightValue: '',
              operator: { type: 'string', operation: 'notEmpty', singleValue: true },
            },
          ],
          combinator: 'and',
        },
      },
      id: 'if-chain-aborted',
      name: 'IF Chain Aborted?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [2500, 480],
    },
    codeNode(
      'Build Aborted Callback',
      [2720, 400],
      `const row = $input.first().json;
return [{ json: { status: row.status || 'error', reply: row.reply || row.error || 'Цепочка прервана', runId: $('Parse Context').first().json.runId, aiBase: $('Parse Context').first().json.aiBase, aiKey: $('Parse Context').first().json.aiKey } }];`,
    ),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'done',
              leftValue: '={{ $json.completedInStep ? "yes" : "" }}',
              rightValue: '',
              operator: { type: 'string', operation: 'notEmpty', singleValue: true },
            },
          ],
          combinator: 'and',
        },
      },
      id: 'if-completed-in-step',
      name: 'IF Completed In Step?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [2080, 560],
    },
    codeNode('Summarize Chain', [2280, 640], summarizeChain),
    codeNode(
      'Done In Tool Step',
      [2280, 480],
      `return [{ json: { status: 'completed', reply: 'Шаг завершён (callback уже отправлен).' } }];`,
    ),
    httpPost(
      'LLM Chat',
      [1860, 780],
      `={{ $('Prepare Route Body').first().json.aiBase }}/internal/llm/complete`,
      `={{ JSON.stringify({
        messages: $('Prepare Route Body').first().json.routeRequest.messages,
        mcpContext: $('Prepare Route Body').first().json.routeRequest.knowledgeContext,
        workspaceId: String($('Prepare Route Body').first().json.workspaceId)
      }) }}`,
      [
        { name: 'X-Ai-Internal-Key', value: `={{ $('Prepare Route Body').first().json.aiKey }}` },
        { name: 'Content-Type', value: 'application/json' },
      ],
    ),
    codeNode('Build Callback', [2480, 700], `const row = $input.first().json;
const ctx = $('Parse Context').first().json;
const payload = row.status ? row : { status: row.status || 'completed', reply: row.reply || '' };
return [{ json: { ...payload, runId: ctx.runId, aiBase: ctx.aiBase, aiKey: ctx.aiKey } }];`),
    httpPost(
      'Callback ai-runtime',
      [2680, 700],
      `={{ $json.aiBase + '/internal/runs/' + $json.runId + '/complete' }}`,
      `={{ JSON.stringify({ status: $json.status, reply: $json.reply, pendingApprovalId: $json.pendingApprovalId, approvalKind: $json.approvalKind, toolName: $json.toolName, connectorKey: $json.connectorKey }) }}`,
      [
        { name: 'X-Ai-Internal-Key', value: '={{ $json.aiKey }}' },
        { name: 'Content-Type', value: 'application/json' },
      ],
    ),
  ],
  connections: {
    Webhook: { main: [[{ node: 'Parse Context', type: 'main', index: 0 }]] },
    'Parse Context': { main: [[{ node: 'IF HITL Resume?', type: 'main', index: 0 }]] },
    'IF HITL Resume?': {
      main: [
        [
          { node: 'Resume History', type: 'main', index: 0 },
          { node: 'Resume Pending', type: 'main', index: 0 },
        ],
        [
          { node: 'Load History', type: 'main', index: 0 },
          { node: 'Load Installations', type: 'main', index: 0 },
          { node: 'Load Knowledge', type: 'main', index: 0 },
        ],
      ],
    },
    'Resume History': { main: [[{ node: 'Resume Merge', type: 'main', index: 0 }]] },
    'Resume Pending': { main: [[{ node: 'Resume Merge', type: 'main', index: 1 }]] },
    'Resume Merge': { main: [[{ node: 'Resume Prepare', type: 'main', index: 0 }]] },
    'Resume Prepare': { main: [[{ node: 'IF Plan Resume?', type: 'main', index: 0 }]] },
    'IF Plan Resume?': {
      main: [
        [{ node: 'Resume Run Connector Chain', type: 'main', index: 0 }],
        [{ node: 'Resume MCP', type: 'main', index: 0 }],
      ],
    },
    'Resume Run Connector Chain': { main: [[{ node: 'IF Chain Aborted?', type: 'main', index: 0 }]] },
    'Resume MCP': { main: [[{ node: 'Resume Callback', type: 'main', index: 0 }]] },
    'Load History': { main: [[{ node: 'Merge for Route', type: 'main', index: 0 }]] },
    'Load Installations': { main: [[{ node: 'Merge for Route', type: 'main', index: 1 }]] },
    'Load Knowledge': { main: [[{ node: 'Merge for Route', type: 'main', index: 2 }]] },
    'Merge for Route': { main: [[{ node: 'Prepare Route Body', type: 'main', index: 0 }]] },
    'Prepare Route Body': { main: [[{ node: 'LLM Route', type: 'main', index: 0 }]] },
    'LLM Route': { main: [[{ node: 'IF Tool Chain?', type: 'main', index: 0 }]] },
    'IF Tool Chain?': {
      main: [
        [{ node: 'Plan Gate', type: 'main', index: 0 }],
        [{ node: 'LLM Chat', type: 'main', index: 0 }],
      ],
    },
    'Plan Gate': { main: [[{ node: 'IF Needs Plan Approval?', type: 'main', index: 0 }]] },
    'IF Needs Plan Approval?': {
      main: [
        [
          { node: 'Build Plan Pending Body', type: 'main', index: 0 },
        ],
        [{ node: 'Run Connector Chain', type: 'main', index: 0 }],
      ],
    },
    'Build Plan Pending Body': { main: [[{ node: 'Create Plan Pending', type: 'main', index: 0 }]] },
    'Create Plan Pending': { main: [[{ node: 'Format Plan Approval', type: 'main', index: 0 }]] },
    'Format Plan Approval': { main: [[{ node: 'Callback Plan Awaiting', type: 'main', index: 0 }]] },
    'Callback Plan Awaiting': { main: [[{ node: 'Done In Plan Step', type: 'main', index: 0 }]] },
    'Run Connector Chain': { main: [[{ node: 'IF Chain Aborted?', type: 'main', index: 0 }]] },
    'IF Chain Aborted?': {
      main: [
        [{ node: 'Build Aborted Callback', type: 'main', index: 0 }],
        [{ node: 'IF Completed In Step?', type: 'main', index: 0 }],
      ],
    },
    'Build Aborted Callback': { main: [[{ node: 'Build Callback', type: 'main', index: 0 }]] },
    'IF Completed In Step?': {
      main: [
        [{ node: 'Done In Tool Step', type: 'main', index: 0 }],
        [{ node: 'Summarize Chain', type: 'main', index: 0 }],
      ],
    },
    'Summarize Chain': { main: [[{ node: 'Build Callback', type: 'main', index: 0 }]] },
    'LLM Chat': { main: [[{ node: 'Build Callback', type: 'main', index: 0 }]] },
    'Build Callback': { main: [[{ node: 'Callback ai-runtime', type: 'main', index: 0 }]] },
  },
  active: true,
  settings: { executionOrder: 'v1' },
  versionId: 'chat-orchestrator-v3-llm-router',
  meta: { templateCredsSetupCompleted: true },
  tags: [],
};

const toolStep = {
  id: 'cgChatToolStp01',
  name: 'chat-tool-step',
  nodes: [
    {
      parameters: { httpMethod: 'POST', path: 'chat-tool-step', responseMode: 'lastNode', options: {} },
      id: 'webhook-tool-step',
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [200, 400],
      webhookId: 'chat-tool-step',
    },
    codeNode('Parse Step Context', [400, 400], toolStepParse),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'valid',
              leftValue: `={{ ${stepCtx}.valid ? "yes" : "" }}`,
              rightValue: '',
              operator: { type: 'string', operation: 'notEmpty', singleValue: true },
            },
          ],
          combinator: 'and',
        },
      },
      id: 'if-valid-step',
      name: 'IF Valid Step?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [600, 400],
    },
    codeNode('Build Error Response', [820, 260], toolStepBuildError),
    httpPost(
      'Policy Evaluate',
      [820, 440],
      `={{ ${stepCtx}.policyBase }}/internal/evaluate`,
      `={{ JSON.stringify({
        orgId: ${stepCtx}.orgId,
        workspaceId: ${stepCtx}.workspaceId,
        connectorKey: ${stepCtx}.step.connectorKey,
        toolName: ${stepCtx}.step.toolName,
        toolArguments: ${stepCtx}.step.arguments,
        userId: ${stepCtx}.userId || undefined
      }) }}`,
      [
        { name: 'X-Policy-Internal-Key', value: `={{ ${stepCtx}.policyKey }}` },
        { name: 'Content-Type', value: 'application/json' },
      ],
    ),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'approval',
              leftValue: '={{ $("Policy Evaluate").first().json.decision === "require_approval" ? "yes" : "" }}',
              rightValue: '',
              operator: { type: 'string', operation: 'notEmpty', singleValue: true },
            },
          ],
          combinator: 'and',
        },
      },
      id: 'if-require-approval',
      name: 'IF Require Approval?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [1040, 440],
    },
    httpPost(
      'Format Approval',
      [1260, 340],
      `={{ ${stepCtx}.aiBase }}/internal/hitl/format-approval`,
      `={{ JSON.stringify(${stepCtx}.fmtBody) }}`,
      [
        { name: 'X-Ai-Internal-Key', value: `={{ ${stepCtx}.aiKey }}` },
        { name: 'Content-Type', value: 'application/json' },
      ],
    ),
    httpPost(
      'Callback Awaiting',
      [1480, 340],
      `={{ ${stepCtx}.aiBase }}/internal/runs/{{ ${stepCtx}.runId }}/complete`,
      `={{ JSON.stringify({
        status: "awaiting_approval",
        reply: $("Format Approval").first().json.message,
        pendingApprovalId: $("Policy Evaluate").first().json.pendingApprovalId,
        toolName: ${stepCtx}.step.toolName,
        connectorKey: ${stepCtx}.step.connectorKey
      }) }}`,
      [
        { name: 'X-Ai-Internal-Key', value: `={{ ${stepCtx}.aiKey }}` },
        { name: 'Content-Type', value: 'application/json' },
      ],
    ),
    codeNode(
      'Set Status Approval',
      [1700, 340],
      `return [{ json: { callbackStatus: 'awaiting_approval' } }];`,
    ),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'deny',
              leftValue: '={{ $("Policy Evaluate").first().json.decision === "deny" ? "yes" : "" }}',
              rightValue: '',
              operator: { type: 'string', operation: 'notEmpty', singleValue: true },
            },
          ],
          combinator: 'and',
        },
      },
      id: 'if-deny',
      name: 'IF Deny?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [1260, 540],
    },
    httpPost(
      'Format Denied',
      [1480, 640],
      `={{ ${stepCtx}.aiBase }}/internal/hitl/format-denied`,
      `={{ JSON.stringify(${stepCtx}.fmtBody) }}`,
      [
        { name: 'X-Ai-Internal-Key', value: `={{ ${stepCtx}.aiKey }}` },
        { name: 'Content-Type', value: 'application/json' },
      ],
    ),
    httpPost(
      'Callback Denied',
      [1700, 640],
      `={{ ${stepCtx}.aiBase }}/internal/runs/{{ ${stepCtx}.runId }}/complete`,
      `={{ JSON.stringify({
        status: "denied",
        reply: $("Format Denied").first().json.message,
        toolName: ${stepCtx}.step.toolName,
        connectorKey: ${stepCtx}.step.connectorKey
      }) }}`,
      [
        { name: 'X-Ai-Internal-Key', value: `={{ ${stepCtx}.aiKey }}` },
        { name: 'Content-Type', value: 'application/json' },
      ],
    ),
    codeNode('Set Status Denied', [1920, 640], `return [{ json: { callbackStatus: 'denied' } }];`),
    httpPost(
      'MCP Invoke',
      [1480, 740],
      `={{ ${stepCtx}.mcpBase }}/internal/workspaces/{{ ${stepCtx}.workspaceId }}/tools/invoke`,
      `={{ JSON.stringify({
        connectorKey: ${stepCtx}.step.connectorKey,
        toolName: ${stepCtx}.step.toolName,
        arguments: ${stepCtx}.step.arguments
      }) }}`,
      [
        { name: 'X-Mcp-Internal-Key', value: `={{ ${stepCtx}.mcpKey }}` },
        { name: 'Content-Type', value: 'application/json' },
      ],
    ),
    codeNode('Return Complete', [2140, 480], toolStepReturnComplete),
    codeNode('Return Continue', [1700, 740], toolStepReturnContinue),
  ],
  connections: {
    Webhook: { main: [[{ node: 'Parse Step Context', type: 'main', index: 0 }]] },
    'Parse Step Context': { main: [[{ node: 'IF Valid Step?', type: 'main', index: 0 }]] },
    'IF Valid Step?': {
      main: [
        [{ node: 'Policy Evaluate', type: 'main', index: 0 }],
        [{ node: 'Build Error Response', type: 'main', index: 0 }],
      ],
    },
    'Policy Evaluate': { main: [[{ node: 'IF Require Approval?', type: 'main', index: 0 }]] },
    'IF Require Approval?': {
      main: [
        [
          { node: 'Format Approval', type: 'main', index: 0 },
        ],
        [{ node: 'IF Deny?', type: 'main', index: 0 }],
      ],
    },
    'Format Approval': { main: [[{ node: 'Callback Awaiting', type: 'main', index: 0 }]] },
    'Callback Awaiting': { main: [[{ node: 'Set Status Approval', type: 'main', index: 0 }]] },
    'Set Status Approval': { main: [[{ node: 'Return Complete', type: 'main', index: 0 }]] },
    'IF Deny?': {
      main: [
        [
          { node: 'Format Denied', type: 'main', index: 0 },
        ],
        [{ node: 'MCP Invoke', type: 'main', index: 0 }],
      ],
    },
    'Format Denied': { main: [[{ node: 'Callback Denied', type: 'main', index: 0 }]] },
    'Callback Denied': { main: [[{ node: 'Set Status Denied', type: 'main', index: 0 }]] },
    'Set Status Denied': { main: [[{ node: 'Return Complete', type: 'main', index: 0 }]] },
    'MCP Invoke': { main: [[{ node: 'Return Continue', type: 'main', index: 0 }]] },
  },
  active: true,
  settings: { executionOrder: 'v1' },
  versionId: 'chat-tool-step-v2-visual',
  meta: { templateCredsSetupCompleted: true },
  tags: [],
};

const connectorNotion = {
  id: 'cgChatConnNot01',
  name: 'chat-connector-notion',
  nodes: [
    {
      parameters: {
        httpMethod: 'POST',
        path: 'chat-connector-notion',
        responseMode: 'lastNode',
        options: {},
      },
      id: 'webhook-connector-notion',
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [200, 400],
      webhookId: 'chat-connector-notion',
    },
    codeNode('Parse Connector Task', [400, 400], connectorNotionParse),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'valid',
              leftValue: '={{ $("Parse Connector Task").first().json.valid ? "yes" : "" }}',
              rightValue: '',
              operator: { type: 'string', operation: 'notEmpty', singleValue: true },
            },
          ],
          combinator: 'and',
        },
      },
      id: 'if-valid-connector',
      name: 'IF Valid Task?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [600, 400],
    },
    codeNode(
      'Build Connector Error',
      [820, 280],
      `const prep = $('Parse Connector Task').first().json;
return [{ json: { action: 'continue', ok: false, error: prep.error, stepResult: { ok: false, error: prep.error } } }];`,
    ),
    codeNode('Run Internal Tools', [820, 480], connectorNotionRun),
  ],
  connections: {
    Webhook: { main: [[{ node: 'Parse Connector Task', type: 'main', index: 0 }]] },
    'Parse Connector Task': { main: [[{ node: 'IF Valid Task?', type: 'main', index: 0 }]] },
    'IF Valid Task?': {
      main: [
        [{ node: 'Run Internal Tools', type: 'main', index: 0 }],
        [{ node: 'Build Connector Error', type: 'main', index: 0 }],
      ],
    },
  },
  active: true,
  settings: { executionOrder: 'v1' },
  versionId: 'chat-connector-notion-v1',
  meta: { templateCredsSetupCompleted: true },
  tags: [],
};

const outDir = path.join(__dirname, '..', 'workflows');
fs.writeFileSync(path.join(outDir, 'chat-orchestrator-v0.json'), JSON.stringify(orchestrator, null, 2));
fs.writeFileSync(path.join(outDir, 'chat-tool-step.json'), JSON.stringify(toolStep, null, 2));
fs.writeFileSync(
  path.join(outDir, 'chat-connector-notion.json'),
  JSON.stringify(connectorNotion, null, 2),
);
const connectorTrello = {
  id: 'cgChatConnTrello01',
  name: 'chat-connector-trello',
  nodes: [
    {
      parameters: {
        httpMethod: 'POST',
        path: 'chat-connector-trello',
        responseMode: 'lastNode',
        options: {},
      },
      id: 'webhook-connector-trello',
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [200, 400],
      webhookId: 'chat-connector-trello',
    },
    codeNode('Parse Connector Task', [400, 400], connectorTrelloParse),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'valid',
              leftValue: '={{ $("Parse Connector Task").first().json.valid ? "yes" : "" }}',
              rightValue: '',
              operator: { type: 'string', operation: 'notEmpty', singleValue: true },
            },
          ],
          combinator: 'and',
        },
      },
      id: 'if-valid-trello',
      name: 'IF Valid Task?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [600, 400],
    },
    codeNode(
      'Build Connector Error',
      [820, 280],
      `const prep = $('Parse Connector Task').first().json;
return [{ json: { action: 'continue', ok: false, error: prep.error, stepResult: { ok: false, error: prep.error } } }];`,
    ),
    codeNode('Run Internal Tools', [820, 480], connectorTrelloRun),
  ],
  connections: {
    Webhook: { main: [[{ node: 'Parse Connector Task', type: 'main', index: 0 }]] },
    'Parse Connector Task': { main: [[{ node: 'IF Valid Task?', type: 'main', index: 0 }]] },
    'IF Valid Task?': {
      main: [
        [{ node: 'Run Internal Tools', type: 'main', index: 0 }],
        [{ node: 'Build Connector Error', type: 'main', index: 0 }],
      ],
    },
  },
  active: true,
  settings: { executionOrder: 'v1' },
  versionId: 'chat-connector-trello-v1',
  meta: { templateCredsSetupCompleted: true },
  tags: [],
};

fs.writeFileSync(
  path.join(outDir, 'chat-connector-trello.json'),
  JSON.stringify(connectorTrello, null, 2),
);
console.log('Wrote orchestrator + tool-step + connector-notion + connector-trello workflows');
