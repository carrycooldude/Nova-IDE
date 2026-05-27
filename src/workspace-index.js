import { vfs } from './file-system.js';

const IGNORED_SEGMENTS = new Set([
  '.git',
  'node_modules',
  'dist',
  'release',
  'build',
  '.vite',
  '.cache',
]);

const BINARY_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'ico',
  'pdf',
  'zip',
  'gz',
  'wasm',
  'litertlm',
  'onnx',
  'bin',
  'exe',
  'dll',
]);

const MAX_INDEXED_CHARS = 12000;
const MAX_SNIPPET_CHARS = 600;

function extensionOf(path) {
  const name = path.split('/').pop() || '';
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function isIgnoredPath(path) {
  const parts = String(path || '').split('/').filter(Boolean);
  return parts.some(part => IGNORED_SEGMENTS.has(part)) || BINARY_EXTENSIONS.has(extensionOf(path));
}

function getImports(content) {
  const imports = [];
  const patterns = [
    /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /require\(['"]([^'"]+)['"]\)/g,
    /from\s+([a-zA-Z0-9_.]+)\s+import/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }

  return [...new Set(imports)].slice(0, 20);
}

function lineMatches(content, query, maxResults) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];

  const lines = content.split('\n');
  const matches = [];

  for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
    const lower = lines[i].toLowerCase();
    if (terms.every(term => lower.includes(term))) {
      matches.push({
        line: i + 1,
        text: lines[i].slice(0, MAX_SNIPPET_CHARS),
      });
    }
  }

  return matches;
}

export function buildWorkspaceIndex() {
  const files = [...vfs.files.values()]
    .filter(file => file && file.path && !isIgnoredPath(file.path))
    .map(file => {
      const content = String(file.content || '');
      return {
        path: file.path,
        name: file.name,
        language: file.language || 'text',
        size: content.length,
        snippet: content.slice(0, MAX_SNIPPET_CHARS),
        imports: getImports(content.slice(0, MAX_INDEXED_CHARS)),
      };
    });

  return {
    workspaceName: vfs.workspaceName,
    workspaceRoot: vfs.workspaceRoot,
    fileCount: files.length,
    files,
  };
}

export function searchWorkspace(query, maxResults = 8) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return [];

  const results = [];
  const terms = needle.split(/\s+/).filter(Boolean);

  for (const file of vfs.files.values()) {
    if (!file || !file.path || isIgnoredPath(file.path)) continue;

    const path = file.path.toLowerCase();
    const name = (file.name || '').toLowerCase();
    const content = String(file.content || '');
    const contentLower = content.toLowerCase();

    const pathScore = terms.filter(term => path.includes(term) || name.includes(term)).length * 8;
    const contentScore = terms.filter(term => contentLower.includes(term)).length * 3;
    const matches = lineMatches(content, needle, 3);

    if (pathScore || contentScore || matches.length) {
      results.push({
        path: file.path,
        name: file.name,
        language: file.language || 'text',
        score: pathScore + contentScore + matches.length,
        matches,
        snippet: matches[0]?.text || content.slice(0, MAX_SNIPPET_CHARS),
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, maxResults);
}

export function searchExactSymbol(symbol, maxResults = 20) {
  const needle = String(symbol || '').trim();
  if (!needle) return [];

  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const symbolRegex = new RegExp(`\\b${escaped}\\b`);
  const definitionRegex = new RegExp(`\\b(function|def|class|const|let|var)\\s+${escaped}\\b|\\b${escaped}\\s*[:=]\\s*(async\\s*)?(function|\\(|[^=])`);
  const results = [];

  for (const file of vfs.files.values()) {
    if (!file || !file.path || isIgnoredPath(file.path)) continue;
    const lines = String(file.content || '').split('\n');
    const matches = [];

    for (let i = 0; i < lines.length; i++) {
      if (!symbolRegex.test(lines[i])) continue;
      matches.push({
        line: i + 1,
        text: lines[i].slice(0, MAX_SNIPPET_CHARS),
        isDefinition: definitionRegex.test(lines[i]),
      });
    }

    if (matches.length) {
      results.push({
        path: file.path,
        name: file.name,
        language: file.language || 'text',
        matches,
        score: matches.some(match => match.isDefinition) ? 100 : 10,
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, maxResults);
}

export function getFunctionSnippet(path, symbol, contextLines = 30) {
  const file = vfs.readFile(path);
  if (!file) return null;

  const lines = String(file.content || '').split('\n');
  const escaped = String(symbol || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const definitionRegex = new RegExp(`\\b(function|def|class|const|let|var)\\s+${escaped}\\b|\\b${escaped}\\s*[:=]\\s*(async\\s*)?(function|\\()`);
  let start = lines.findIndex(line => definitionRegex.test(line));
  if (start === -1) start = lines.findIndex(line => new RegExp(`\\b${escaped}\\b`).test(line));
  if (start === -1) return null;

  const from = Math.max(0, start - 3);
  const to = Math.min(lines.length, start + contextLines);
  return {
    path,
    language: file.language || 'text',
    startLine: from + 1,
    endLine: to,
    content: lines.slice(from, to).join('\n'),
  };
}

export function getRelevantWorkspaceContext(userText, currentContext, maxResults = 6) {
  const queryParts = [
    userText,
    currentContext?.fileName,
    currentContext?.language,
    currentContext?.selection?.slice(0, 200),
  ].filter(Boolean);

  const results = searchWorkspace(queryParts.join(' '), maxResults);
  const currentPath = currentContext?.filePath;
  if (currentPath && !results.some(result => result.path === currentPath)) {
    const file = vfs.readFile(currentPath);
    if (file) {
      results.unshift({
        path: file.path,
        name: file.name,
        language: file.language || 'text',
        score: 100,
        matches: [],
        snippet: String(file.content || '').slice(0, MAX_SNIPPET_CHARS),
      });
    }
  }

  return results.slice(0, maxResults);
}

export function formatWorkspaceContext(results) {
  if (!results.length) return 'No additional workspace matches.';

  return results.map(result => {
    const matchText = result.matches?.length
      ? result.matches.map(match => `L${match.line}: ${match.text}`).join('\n')
      : result.snippet;
    return `File: ${result.path} (${result.language})\n${matchText}`;
  }).join('\n\n---\n\n');
}

export function formatWorkspaceSummary(maxFiles = 80) {
  const index = buildWorkspaceIndex();
  const files = index.files.slice(0, maxFiles).map(file => {
    const imports = file.imports.length ? ` imports: ${file.imports.join(', ')}` : '';
    return `- ${file.path} (${file.language}, ${file.size} chars)${imports}`;
  });

  return [
    `Workspace: ${index.workspaceName || 'Untitled'}`,
    `Files indexed: ${index.fileCount}`,
    files.join('\n'),
  ].filter(Boolean).join('\n');
}
