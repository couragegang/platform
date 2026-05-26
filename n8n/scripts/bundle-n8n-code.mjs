import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const n8nRoot = path.join(__dirname, '..');

/** Strip ESM exports so core modules can run inside n8n Code nodes. */
export function stripExports(source) {
  return source
    .replace(/^export function /gm, 'function ')
    .replace(/^export const /gm, 'const ')
    .replace(/^export default /gm, '')
    .replace(/^export \{[^}]+\};?\s*$/gm, '');
}

export function readN8nFile(relativePath) {
  return fs.readFileSync(path.join(n8nRoot, relativePath), 'utf8');
}

/** Concatenate core module(s) + runner into a single n8n jsCode string. */
export function bundleN8nCode(corePaths, runnerPath) {
  const parts = corePaths.map((p) => stripExports(readN8nFile(p)));
  parts.push(readN8nFile(runnerPath));
  return parts.join('\r\n\r\n');
}
