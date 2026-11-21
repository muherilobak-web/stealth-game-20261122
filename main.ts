// The Gloaming Archive — a stealth game about Wren, a thief slipping
// through a candlelit archive to steal the pages of the Starless Atlas.
// This program copies the finished game and its screenshots into the
// output directory and writes the dossier that describes the entry.
// It only uses the Node standard library, plus the vendored dossier
// builder, and it produces the same bytes on every run.
import { buildDossier } from './vendor/makefun-game.ts';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const limits = {
  text_max_bytes: 163840,
  maxScreenshots: 4,
  maxScreenshotBytes: 262144,
  maxGameFiles: 993,
  maxGameBytes: 50331648,
  maxGamePathBytes: 1000,
};

await mkdir(outDir, { recursive: true });
await cp(join(here, 'game'), join(outDir, 'game'), { recursive: true });
await cp(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
const dossier = await buildDossier(outDir, limits);
await writeFile(join(outDir, 'dossier.json'), dossier);
