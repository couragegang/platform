import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const n8nRoot = path.join(__dirname, '..');

/** Strip ESM import/export so core modules can run inside n8n Code nodes. */
export function stripModuleSyntax(source) {
  let s = source;

  // import { … } from '…' (single- and multi-line)
  s = s.replace(
    /^import\s+(?:\{[\s\S]*?\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*\{[\s\S]*?\})?\s+from\s+['"][^'"]+['"];?\s*/gm,
    '',
  );
  // side-effect import '…'
  s = s.replace(/^import\s+['"][^'"]+['"];?\s*/gm, '');

  // re-exports
  s = s.replace(/^export\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];?\s*/gm, '');
  s = s.replace(/^export\s+\*\s+from\s+['"][^'"]+['"];?\s*/gm, '');

  s = s
    .replace(/^export\s+async\s+function\s+/gm, 'async function ')
    .replace(/^export\s+function\s+/gm, 'function ')
    .replace(/^export\s+const\s+/gm, 'const ')
    .replace(/^export\s+class\s+/gm, 'class ')
    .replace(/^export\s+default\s+/gm, '');

  // bare export { … };
  s = s.replace(/^export\s+\{[\s\S]*?\};?\s*$/gm, '');

  return s;
}

/** @deprecated use stripModuleSyntax */
export const stripExports = stripModuleSyntax;

export function readN8nFile(relativePath) {
  return fs.readFileSync(path.join(n8nRoot, relativePath), 'utf8');
}

/** Concatenate core module(s) + runner into a single n8n jsCode string. */
export function bundleN8nCode(corePaths, runnerPath) {
  const parts = corePaths.map((p) => stripModuleSyntax(readN8nFile(p)));
  parts.push(readN8nFile(runnerPath));
  return parts.join('\r\n\r\n');
}
