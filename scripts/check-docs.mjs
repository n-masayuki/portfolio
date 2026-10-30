import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';

const root = fileURLToPath(new URL('../', import.meta.url));
const { scripts } = JSON.parse(
  await readFile(resolve(root, 'package.json'), 'utf8'),
);

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(path);
      return entry.name.endsWith('.md') ? [path] : [];
    }),
  );
  return files.flat();
}

const files = [
  resolve(root, 'README.md'),
  resolve(root, 'AGENTS.md'),
  resolve(root, '.github/copilot-instructions.md'),
  ...(await markdownFiles(resolve(root, 'docs'))),
];
const errors = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const location = (offset) =>
    `${relative(root, file)}:${source.slice(0, offset).split('\n').length}`;

  // Check inline Markdown links and reference definitions. Anchors and remote
  // URLs are deliberately outside this small, dependency-free check.
  const links = [
    ...source.matchAll(
      /\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+"[^"\n]*")?\s*\)/g,
    ),
    ...source.matchAll(/^\s*\[[^\]\n]+\]:\s*(<[^>\n]+>|[^\s]+)/gm),
  ];
  for (const match of links) {
    const target = match[1].replace(/^<|>$/g, '');
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target)) continue;
    const path = target.split(/[?#]/)[0];
    if (!path) continue;
    try {
      await stat(resolve(dirname(file), decodeURIComponent(path)));
    } catch {
      errors.push(
        `${location(match.index)}: リンク先が見つかりません: ${target}`,
      );
    }
  }

  for (const match of source.matchAll(/\bnpm run\s+([\w:.-]+)/g)) {
    if (!Object.hasOwn(scripts, match[1])) {
      errors.push(
        `${location(match.index)}: 未定義のnpmスクリプト: ${match[1]}`,
      );
    }
  }
}

if (errors.length) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `文書 ${files.length} 件のローカルリンクとnpmスクリプト参照を確認しました。\n`,
  );
}
