/**
 * Generates platform/n8n/workflows/chat-orchestrator-v0.json (multi-node canvas).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routerCode = fs.readFileSync(path.join(__dirname, 'router-merge.js'), 'utf8');
const resumeCode = fs.readFileSync(path.join(__dirname, 'resume-prepare.js'), 'utf8');
const parseCode = fs.readFileSync(path.join(__dirname, 'parse-context.js'), 'utf8');

const nid = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function node(name, type, typeVersion, position, parameters, extra = {}) {
  return {
    parameters,
    id: nid(name),
    name,
    type,
    typeVersion,
    position,
    ...extra,
  };
}

function httpGet(name, pos, urlExpr, headers = [], query = []) {
  return node(name, 'n8n-nodes-base.httpRequest', 4.2, pos, {
    method: 'GET',
    url: urlExpr,
    sendHeaders: true,
    headerParameters: { parameters: headers },
    sendQuery: query.length > 0,
    queryParameters: { parameters: query },
    options: { response: { response: { neverError: true } } },
  });
}

function httpPost(name, pos, urlExpr, bodyExpr, headers = []) {
  return node(name, 'n8n-nodes-base.httpRequest', 4.2, pos, {
    method: 'POST',
    url: urlExpr,
    sendHeaders: true,
    headerParameters: { parameters: headers },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: bodyExpr,
    options: { response: { response: { neverError: true } } },
  });
}

function codeNode(name, pos, jsCode) {
  return node(name, 'n8n-nodes-base.code', 2, pos, {
    mode: 'runOnceForAllItems',
    jsCode,
  });
}

function sticky(name, pos, [w, h], content) {
  return node(name, 'n8n-nodes-base.stickyNote', 1, pos, {
    width: w,
    height: h,
    content,
  });
}

const ctx = "={{ $('Parse Context').first().json }}";
const aiKey = `={{ ${ctx}.aiKey }}`;
const aiBase = `={{ ${ctx}.aiBase }}`;
const mcpBase = `={{ ${ctx}.mcpBase }}`;
const policyBase = `={{ ${ctx}.policyBase }}`;
const knowledgeBase = `={{ ${ctx}.knowledgeBase }}`;
const policyKey = `={{ ${ctx}.policyKey }}`;
const mcpKey = `={{ ${ctx}.mcpKey }}`;
const runId = `={{ ${ctx}.runId }}`;
const conversationId = `={{ ${ctx}.conversationId }}`;
const workspaceId = `={{ ${ctx}.workspaceId }}`;
const orgId = `={{ ${ctx}.orgId }}`;
const userId = `={{ ${ctx}.userId }}`;
const message = `={{ ${ctx}.message }}`;

const workflow = {
  name: 'chat-orchestrator',
  nodes: [
    sticky('Note Overview', [-40, 80], [320, 140], '## Chat orchestrator\nWebhook → context → router → policy/MCP **или** LLM → callback ai-runtime'),
    node('Webhook', 'n8n-nodes-base.webhook', 2, [240, 320], {
      httpMethod: 'POST',
      path: 'chat-orchestrator',
      responseMode: 'onReceived',
      options: {},
    }, { webhookId: 'chat-orchestrator' }),

    codeNode('Parse Context', [440, 320], parseCode),

    node('IF HITL Resume?', 'n8n-nodes-base.if', 2.2, [640, 320], {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            id: 'resume-check',
            leftValue: `={{ ${ctx}.approvedPendingApprovalId }}`,
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    }),

    // --- HITL resume branch ---
    sticky('Note HITL', [760, 80], [280, 100], '### HITL resume\nПосле approve в UI'),
    httpGet(
      'Resume: History',
      [860, 200],
      `=${aiBase}/internal/conversations/${conversationId}/messages`,
      [{ name: 'X-Ai-Internal-Key', value: aiKey }],
      [{ name: 'limit', value: '30' }],
    ),
    node('Resume: Merge', 'n8n-nodes-base.merge', 3, [980, 260], {
      mode: 'combine',
      combinationMode: 'multiplex',
      options: {},
    }),
    httpGet(
      'Resume: Pending',
      [860, 320],
      `=${policyBase}/pending-approvals/{{ ${ctx}.approvedPendingApprovalId }}`,
      [],
    ),
    codeNode('Resume: Prepare', [1180, 260], resumeCode),
    node('IF Resume OK?', 'n8n-nodes-base.if', 2.2, [1380, 260], {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            id: 'ok',
            leftValue: '={{ $json.skipInvoke ? "" : "go" }}',
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    }),
    httpPost(
      'Resume: MCP Invoke',
      [1580, 220],
      `=${mcpBase}/internal/workspaces/${workspaceId}/tools/invoke`,
      `={{ JSON.stringify({ connectorKey: $json.connectorKey, toolName: $json.toolName, arguments: $json.toolArguments }) }}`,
      [
        { name: 'X-Mcp-Internal-Key', value: mcpKey },
        { name: 'Content-Type', value: 'application/json' },
      ],
    ),
    codeNode('Resume: Build Callback', [1780, 260], `const ctx = $('Parse Context').first().json;
const prep = $('Resume: Prepare').first().json;
let payload;
if (prep.skipInvoke) {
  payload = prep.payload;
} else {
  const inv = $('Resume: MCP Invoke').first().json;
  payload = {
    status: inv.ok ? 'completed' : 'error',
    reply: inv.ok ? (inv.summary || '') : ('Ошибка: ' + (inv.error || 'tool failed')),
    toolName: prep.toolName,
    connectorKey: prep.connectorKey,
  };
}
return [{ json: { ...payload, runId: ctx.runId, aiBase: ctx.aiBase, aiKey: ctx.aiKey } }];`),

    // --- Main branch: parallel context ---
    sticky('Note Context', [760, 480], [300, 100], '### Контекст\nhistory + MCP + knowledge'),
    httpGet(
      'Load History',
      [860, 480],
      `=${aiBase}/internal/conversations/${conversationId}/messages`,
      [{ name: 'X-Ai-Internal-Key', value: aiKey }],
      [{ name: 'limit', value: '30' }],
    ),
    httpGet(
      'Load Installations',
      [860, 600],
      `=${mcpBase}/workspaces/${workspaceId}/installations`,
      [],
    ),
    httpPost(
      'Load Knowledge',
      [860, 720],
      `=${knowledgeBase}/search`,
      `={{ JSON.stringify({ orgId: ${orgId}, workspaceId: ${workspaceId}, query: ${message}, connectorKeys: null, sourceIds: null }) }}`,
      [{ name: 'Content-Type', value: 'application/json' }],
    ),
    node('Merge Context', 'n8n-nodes-base.merge', 3, [1080, 600], {
      mode: 'combine',
      combinationMode: 'multiplex',
      options: {},
    }),
    codeNode('Router', [1300, 600], routerCode),

    node('IF Tool Path?', 'n8n-nodes-base.if', 2.2, [1520, 600], {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            id: 'has-tool',
            leftValue: '={{ $json.resolvedTool ? "yes" : "" }}',
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    }),

    // Tool branch
    sticky('Note Policy', [1520, 760], [280, 90], '### Policy + MCP'),
    httpPost(
      'Policy Evaluate',
      [1740, 720],
      `=${policyBase}/internal/evaluate`,
      `={{ JSON.stringify({
        orgId: $json.orgId,
        workspaceId: $json.workspaceId,
        connectorKey: $json.resolvedTool.connectorKey,
        toolName: $json.resolvedTool.toolName,
        toolArguments: {},
        userId: $json.userId || undefined
      }) }}`,
      [
        { name: 'X-Policy-Internal-Key', value: policyKey },
        { name: 'Content-Type', value: 'application/json' },
      ],
    ),
    codeNode('Policy Route', [1960, 720], `const router = $('Router').first().json;
const policy = $input.first().json;
const decision = policy.decision || 'allow';
let payload;
if (decision === 'require_approval') {
  payload = {
    status: 'awaiting_approval',
    reply: 'Для выполнения действия требуется подтверждение: ' + router.resolvedTool.toolName,
    pendingApprovalId: policy.pendingApprovalId,
    toolName: router.resolvedTool.toolName,
    connectorKey: router.resolvedTool.connectorKey,
  };
} else if (decision === 'deny') {
  payload = {
    status: 'denied',
    reply: 'Действие запрещено политикой: ' + router.resolvedTool.toolName,
    toolName: router.resolvedTool.toolName,
    connectorKey: router.resolvedTool.connectorKey,
  };
} else {
  payload = { status: '_invoke', router, toolArguments: router.toolArguments };
}
return [{ json: { ...router, policy, payload } }];`),

    node('IF Policy Invoke?', 'n8n-nodes-base.if', 2.2, [2180, 720], {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            id: 'invoke',
            leftValue: '={{ $json.payload.status }}',
            rightValue: '_invoke',
            operator: { type: 'string', operation: 'equals' },
          },
        ],
        combinator: 'and',
      },
      options: {},
    }),

    httpPost(
      'MCP Invoke',
      [2400, 680],
      `=${mcpBase}/internal/workspaces/${workspaceId}/tools/invoke`,
      `={{ JSON.stringify({
        connectorKey: $json.resolvedTool.connectorKey,
        toolName: $json.resolvedTool.toolName,
        arguments: $json.toolArguments
      }) }}`,
      [
        { name: 'X-Mcp-Internal-Key', value: mcpKey },
        { name: 'Content-Type', value: 'application/json' },
      ],
    ),
    codeNode('Tool: Build Callback', [2620, 720], `const router = $('Router').first().json;
const row = $input.first().json;
let payload = row.payload;
if (payload && payload.status === '_invoke') {
  const inv = $('MCP Invoke').first().json;
  payload = {
    status: inv.ok ? 'completed' : 'error',
    reply: inv.ok ? (inv.summary || '') : ('Ошибка инструмента: ' + (inv.error || 'failed')),
    toolName: router.resolvedTool.toolName,
    connectorKey: router.resolvedTool.connectorKey,
  };
}
return [{ json: { ...router, payload } }];`),

    // LLM branch
    sticky('Note LLM', [1740, 920], [240, 80], '### LLM\nчерез ai-runtime'),
    httpPost(
      'LLM Complete',
      [1740, 960],
      `=${aiBase}/internal/llm/complete`,
      `={{ JSON.stringify({
        messages: $json.history,
        mcpContext: ($json.mcpContextPrompt || '') + ($json.knowledgeContext ? '\\n\\nРелевантные документы:\\n' + $json.knowledgeContext : ''),
        workspaceId: String($json.workspaceId)
      }) }}`,
      [
        { name: 'X-Ai-Internal-Key', value: aiKey },
        { name: 'Content-Type', value: 'application/json' },
      ],
    ),
    codeNode('LLM: Build Callback', [1960, 960], `const llm = $input.first().json;
return [{ json: { payload: { status: llm.status || 'completed', reply: llm.reply || '' } } }];`),

    // Final callback (all branches)
    codeNode('Normalize Callback', [2840, 600], `const row = $input.first().json;
if (row.runId && row.aiBase) {
  return [{ json: row }];
}
const ctx = $('Parse Context').first().json;
let payload = row.payload || {
  status: row.status || 'error',
  reply: row.reply || 'empty',
  pendingApprovalId: row.pendingApprovalId,
  toolName: row.toolName,
  connectorKey: row.connectorKey,
};
return [{ json: { ...payload, runId: ctx.runId, aiBase: ctx.aiBase, aiKey: ctx.aiKey } }];`),

    httpPost(
      'Callback ai-runtime',
      [3060, 600],
      `={{ $json.aiBase + '/internal/runs/' + $json.runId + '/complete' }}`,
      `={{ JSON.stringify({
        status: $json.status,
        reply: $json.reply,
        pendingApprovalId: $json.pendingApprovalId || undefined,
        toolName: $json.toolName || undefined,
        connectorKey: $json.connectorKey || undefined
      }) }}`,
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
          { node: 'Resume: History', type: 'main', index: 0 },
          { node: 'Resume: Pending', type: 'main', index: 0 },
        ],
        [
          { node: 'Load History', type: 'main', index: 0 },
          { node: 'Load Installations', type: 'main', index: 0 },
          { node: 'Load Knowledge', type: 'main', index: 0 },
        ],
      ],
    },
    'Resume: History': { main: [[{ node: 'Resume: Merge', type: 'main', index: 0 }]] },
    'Resume: Pending': { main: [[{ node: 'Resume: Merge', type: 'main', index: 1 }]] },
    'Resume: Merge': { main: [[{ node: 'Resume: Prepare', type: 'main', index: 0 }]] },
    'Resume: Prepare': { main: [[{ node: 'IF Resume OK?', type: 'main', index: 0 }]] },
    'IF Resume OK?': {
      main: [
        [{ node: 'Resume: MCP Invoke', type: 'main', index: 0 }],
        [{ node: 'Resume: Build Callback', type: 'main', index: 0 }],
      ],
    },
    'Resume: MCP Invoke': { main: [[{ node: 'Resume: Build Callback', type: 'main', index: 0 }]] },
    'Resume: Build Callback': { main: [[{ node: 'Callback ai-runtime', type: 'main', index: 0 }]] },
    'Load History': { main: [[{ node: 'Merge Context', type: 'main', index: 0 }]] },
    'Load Installations': { main: [[{ node: 'Merge Context', type: 'main', index: 1 }]] },
    'Load Knowledge': { main: [[{ node: 'Merge Context', type: 'main', index: 2 }]] },
    'Merge Context': { main: [[{ node: 'Router', type: 'main', index: 0 }]] },
    Router: { main: [[{ node: 'IF Tool Path?', type: 'main', index: 0 }]] },
    'IF Tool Path?': {
      main: [
        [{ node: 'Policy Evaluate', type: 'main', index: 0 }],
        [{ node: 'LLM Complete', type: 'main', index: 0 }],
      ],
    },
    'Policy Evaluate': { main: [[{ node: 'Policy Route', type: 'main', index: 0 }]] },
    'Policy Route': { main: [[{ node: 'IF Policy Invoke?', type: 'main', index: 0 }]] },
    'IF Policy Invoke?': {
      main: [
        [{ node: 'MCP Invoke', type: 'main', index: 0 }],
        [{ node: 'Tool: Build Callback', type: 'main', index: 0 }],
      ],
    },
    'MCP Invoke': { main: [[{ node: 'Tool: Build Callback', type: 'main', index: 0 }]] },
    'Tool: Build Callback': { main: [[{ node: 'Normalize Callback', type: 'main', index: 0 }]] },
    'LLM Complete': { main: [[{ node: 'LLM: Build Callback', type: 'main', index: 0 }]] },
    'LLM: Build Callback': { main: [[{ node: 'Normalize Callback', type: 'main', index: 0 }]] },
    'Normalize Callback': { main: [[{ node: 'Callback ai-runtime', type: 'main', index: 0 }]] },
  },
  active: false,
  settings: { executionOrder: 'v1' },
  versionId: 'chat-orchestrator-v2-visual',
  meta: { templateCredsSetupCompleted: true },
  tags: [],
};

const out = path.join(__dirname, '..', 'workflows', 'chat-orchestrator-v0.json');
fs.writeFileSync(out, JSON.stringify(workflow, null, 2));
console.log('Wrote', out, 'nodes:', workflow.nodes.length);
