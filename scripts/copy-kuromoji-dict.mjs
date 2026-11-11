// Copies the Kuromoji dictionary (~17 MB) into public/dict so Vite serves it at /dict/ and
// Tauri bundles it with the frontend. public/dict is git-ignored and recreated on install.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', '@sglkc', 'kuromoji', 'dict');
const target = join(root, 'public', 'dict');

if (!existsSync(source)) {
  console.warn('[furigana] Kuromoji dictionary not found at', source, '- skipping copy.');
  process.exit(0);
}

mkdirSync(target, { recursive: true });
const expected = readdirSync(source).length;
if (readdirSync(target).length >= expected) {
  process.exit(0); // already copied, keep dev/build start-up fast
}
cpSync(source, target, { recursive: true });
console.log(`[furigana] Copied ${readdirSync(target).length} dictionary files to public/dict`);
