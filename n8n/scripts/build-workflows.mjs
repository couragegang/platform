/**
 * Generates chat-orchestrator-v0.json + chat-tool-step.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

const parseContext = read('parse-context.js');
const mergeForRoute = read('merge-for-route.js');
const runToolChain = read('run-tool-chain.js');
const summarizeChain = read('summarize-chain.js');
const toolStepParse = read('tool-step-parse.js');
const toolStepBuildError = read('tool-step-build-error.js');
const toolStepReturnComplete = read('tool-step-return-complete.js');
const toolStepReturnContinue = read('tool-step-return-continue.js');
const resumePrepare = read('resume-prepare.js');

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

const ctx = "={{ $('Parse Context').first().json }}";
const stepCtx = "={{ $('Parse Step Context').first().json }}";

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
      parameters: { mode: 'combine', combinationMode: 'multiplex', options: {} },
      id: 'resume-merge',
      name: 'Resume Merge',
      type: 'n8n-nodes-base.merge',
      typeVersion: 3,
      position: [1020, 340],
    },
    codeNode('Resume Prepare', [1220, 340], resumePrepare),
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
      parameters: { mode: 'combine', combinationMode: 'multiplex', options: {} },
      id: 'merge-for-route',
      name: 'Merge for Route',
      type: 'n8n-nodes-base.merge',
      typeVersion: 3,
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
              leftValue: '={{ $json.mode === "tool_chain" && ($json.steps || []).length > 0 ? "yes" : "" }}',
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
    codeNode('Run Tool Chain', [1860, 560], runToolChain),
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
      `={{ JSON.stringify({ status: $json.status, reply: $json.reply, pendingApprovalId: $json.pendingApprovalId, toolName: $json.toolName, connectorKey: $json.connectorKey }) }}`,
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
    'Resume Prepare': { main: [[{ node: 'Resume MCP', type: 'main', index: 0 }]] },
    'Resume MCP': { main: [[{ node: 'Resume Callback', type: 'main', index: 0 }]] },
    'Load History': { main: [[{ node: 'Merge for Route', type: 'main', index: 0 }]] },
    'Load Installations': { main: [[{ node: 'Merge for Route', type: 'main', index: 1 }]] },
    'Load Knowledge': { main: [[{ node: 'Merge for Route', type: 'main', index: 2 }]] },
    'Merge for Route': { main: [[{ node: 'Prepare Route Body', type: 'main', index: 0 }]] },
    'Prepare Route Body': { main: [[{ node: 'LLM Route', type: 'main', index: 0 }]] },
    'LLM Route': { main: [[{ node: 'IF Tool Chain?', type: 'main', index: 0 }]] },
    'IF Tool Chain?': {
      main: [
        [{ node: 'Run Tool Chain', type: 'main', index: 0 }],
        [{ node: 'LLM Chat', type: 'main', index: 0 }],
      ],
    },
    'Run Tool Chain': { main: [[{ node: 'IF Completed In Step?', type: 'main', index: 0 }]] },
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

const outDir = path.join(__dirname, '..', 'workflows');
fs.writeFileSync(path.join(outDir, 'chat-orchestrator-v0.json'), JSON.stringify(orchestrator, null, 2));
fs.writeFileSync(path.join(outDir, 'chat-tool-step.json'), JSON.stringify(toolStep, null, 2));
console.log('Wrote orchestrator + tool-step workflows');
