import fs from 'fs';
import path from 'path';
import vm from 'node:vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const n8nRoot = path.join(__dirname, '..');
const workflowsDir = path.join(n8nRoot, 'workflows');

const WORKFLOW_SPECS = [
  {
    file: 'chat-orchestrator-v0.json',
    id: 'cgChatOrchestr01',
    webhookPath: 'chat-orchestrator',
    requiredNodes: [
      'Merge for Route',
      'IF HITL Resume?',
      'Prepare Route Body',
      'Plan Gate',
      'IF Needs Plan Approval?',
    ],
  },
  {
    file: 'chat-tool-step.json',
    id: 'cgChatToolStp01',
    webhookPath: 'chat-tool-step',
    requiredNodes: ['IF Valid Step?', 'Policy Evaluate'],
  },
  {
    file: 'chat-connector-notion.json',
    id: 'cgChatConnNot01',
    webhookPath: 'chat-connector-notion',
    requiredNodes: ['Parse Connector Task', 'Run Internal Tools'],
  },
  {
    file: 'chat-connector-trello.json',
    id: 'cgChatConnTrello01',
    webhookPath: 'chat-connector-trello',
    requiredNodes: ['Parse Connector Task', 'Run Internal Tools'],
  },
];

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

function validateMergeNode(node) {
  const issues = [];
  const { parameters = {}, typeVersion = 0 } = node;
  const mode = parameters.mode;

  if (mode === 'append') {
    const inputs = parameters.numberInputs;
    if (typeof inputs !== 'number' || inputs < 2) {
      issues.push(`Merge "${node.name}": append mode requires numberInputs >= 2`);
    }
    return issues;
  }

  if (mode === 'combine') {
    const combineBy = parameters.combineBy ?? parameters.combinationMode;
    if (!combineBy || combineBy === 'combineByFields' || combineBy === 'mergeByFields') {
      const fields = parameters.fieldsToMatchString ?? parameters.mergeByFields;
      if (!fields || (Array.isArray(fields) && fields.length === 0)) {
        issues.push(
          `Merge "${node.name}": combineByFields without fieldsToMatch (use append or explicit combineBy)`,
        );
      }
    }
    if (combineBy === 'multiplex' || combineBy === 'combineAll') {
      // allowed when explicitly set on v3+
    }
    if (parameters.combinationMode === 'multiplex' && !parameters.combineBy) {
      issues.push(`Merge "${node.name}": legacy combinationMode multiplex without combineBy (n8n 1.121 breaks)`);
    }
    return issues;
  }

  if (parameters.combinationMode) {
    issues.push(`Merge "${node.name}": legacy combinationMode on typeVersion ${typeVersion}`);
  }

  return issues;
}

/** Static checks for n8n Code node jsCode (no ESM; must parse like n8n VM). */
export function validateCodeJs(nodeName, jsCode) {
  const issues = [];
  if (typeof jsCode !== 'string' || !jsCode.trim()) {
    return issues;
  }

  if (/\bimport\s/.test(jsCode)) {
    issues.push(`Code node "${nodeName}": jsCode contains ESM import (re-run build-workflows)`);
  }
  if (/\bexport\s/.test(jsCode)) {
    issues.push(`Code node "${nodeName}": jsCode contains ESM export (re-run build-workflows)`);
  }

  try {
    // n8n wraps Code node js in an async function; top-level return/await is valid there.
    new vm.Script(`async function __n8nCodeNode() {\n${jsCode}\n}`);
  } catch (err) {
    issues.push(`Code node "${nodeName}": jsCode syntax error (${err.message})`);
  }

  return issues;
}

export function validateWorkflowJson(workflow, spec) {
  const issues = [];

  if (workflow.id !== spec.id) {
    issues.push(`expected id ${spec.id}, got ${workflow.id ?? '(missing)'}`);
  }

  const webhook = (workflow.nodes || []).find((n) => n.type === 'n8n-nodes-base.webhook');
  if (!webhook || webhook.parameters?.path !== spec.webhookPath) {
    issues.push(`webhook path must be ${spec.webhookPath}`);
  }

  const nodeNames = new Set((workflow.nodes || []).map((n) => n.name));
  for (const name of spec.requiredNodes) {
    if (!nodeNames.has(name)) issues.push(`missing required node: ${name}`);
  }

  for (const node of workflow.nodes || []) {
    if (node.type === 'n8n-nodes-base.merge') {
      issues.push(...validateMergeNode(node));
    }
    if (node.type === 'n8n-nodes-base.code') {
      issues.push(...validateCodeJs(node.name, node.parameters?.jsCode));
    }
  }

  const connections = workflow.connections || {};
  for (const [from, conn] of Object.entries(connections)) {
    if (!nodeNames.has(from)) issues.push(`connection from unknown node: ${from}`);
    for (const outputs of conn.main || []) {
      for (const edge of outputs) {
        if (!nodeNames.has(edge.node)) {
          issues.push(`connection ${from} -> unknown node ${edge.node}`);
        }
      }
    }
  }

  const strings = collectStrings(workflow);
  if (strings.some((s) => s.includes('={{ ={{'))) {
    issues.push('invalid nested n8n expression: ={{ ={{');
  }
  if (strings.some((s) => /:\s*=\{\{/.test(s))) {
    issues.push('invalid expression prefix ": ={{" inside JSON.stringify or similar');
  }

  return issues;
}

export function validateAllWorkflows(dir = workflowsDir) {
  const all = [];
  for (const spec of WORKFLOW_SPECS) {
    const filePath = path.join(dir, spec.file);
    if (!fs.existsSync(filePath)) {
      all.push({ file: spec.file, issues: [`file not found: ${filePath}`] });
      continue;
    }
    const workflow = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    all.push({ file: spec.file, issues: validateWorkflowJson(workflow, spec) });
  }
  return all;
}

export function formatValidationReport(results) {
  const lines = [];
  let failed = false;
  for (const { file, issues } of results) {
    if (issues.length === 0) lines.push(`OK ${file}`);
    else {
      failed = true;
      lines.push(`FAIL ${file}`);
      for (const issue of issues) lines.push(`  - ${issue}`);
    }
  }
  return { failed, text: lines.join('\n') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { failed, text } = formatValidationReport(validateAllWorkflows());
  console.log(text);
  process.exit(failed ? 1 : 0);
}
