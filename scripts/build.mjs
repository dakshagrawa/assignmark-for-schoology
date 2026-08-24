import { build } from 'esbuild';
import { ZipArchive } from 'archiver';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { validateReleaseManifest } from './manifest-validation.mjs';
const { resolve } = path;

const root = path.resolve(import.meta.dirname, '..');
const release = path.join(root, 'dist', 'release');
const unpacked = path.join(root, 'load-unpacked');
await rm(path.join(root, 'dist'), { recursive: true, force: true });
await rm(unpacked, { recursive: true, force: true });
await mkdir(release, { recursive: true });

await build({
  entryPoints: {
    content: resolve(root, 'src/content.js'),
    background: resolve(root, 'src/background.js'),
    popup: resolve(root, 'src/popup.js')
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120', 'edge120', 'firefox121'],
  minify: false,
  legalComments: 'none',
  entryNames: '[name]',
  outbase: path.join(root, 'src'),
  outdir: path.join(release, 'dist')
});

await cp(path.join(root, 'manifest.json'), path.join(release, 'manifest.json'));
await mkdir(path.join(release, 'src'), { recursive: true });
await cp(path.join(root, 'src', 'content.css'), path.join(release, 'src', 'content.css'));
await cp(path.join(root, 'src', 'popup.html'), path.join(release, 'src', 'popup.html'));
await cp(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(release, 'THIRD_PARTY_NOTICES.md'));
await cp(path.join(root, 'LICENSE'), path.join(release, 'LICENSE'));
await cp(path.join(root, 'icons'), path.join(release, 'icons'), { recursive: true });
await cp(release, unpacked, { recursive: true });

const manifest = JSON.parse(await readFile(path.join(release, 'manifest.json'), 'utf8'));
validateReleaseManifest(manifest);

const zipPath = path.join(root, `assignmark-for-schoology-${manifest.version}.zip`);
await rm(zipPath, { force: true });
await new Promise((resolve, reject) => {
  const output = createWriteStream(zipPath);
  const archive = new ZipArchive({ zlib: { level: 9 } });
  output.on('close', resolve);
  output.on('error', reject);
  archive.on('warning', reject);
  archive.on('error', reject);
  archive.pipe(output);
  archive.directory(release, false);
  archive.finalize();
});
console.log(`Built unpacked extension: ${release}`);
console.log(`Built store package: ${zipPath}`);
