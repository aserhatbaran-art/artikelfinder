import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// Öffentliche Dateien, die nicht durch den Bundler laufen, aber offline verfügbar sein müssen
const PUBLIC_FILES = ['manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

/**
 * Schreibt dist/sw.js mit allen Build-Dateien als Precache-Liste und einer Inhalts-Version.
 * Läuft in writeBundle, weil index.html erst dann im Bundle steht – sonst würde eine reine
 * HTML-Änderung keine neue Version auslösen.
 */
function serviceWorker(): Plugin {
  return {
    name: 'artikelfinder-sw',
    apply: 'build',
    writeBundle(options, bundle) {
      const outDir = options.dir!;
      const names = Object.keys(bundle).filter((f) => !f.endsWith('.map')).sort();
      const precache = ['./', ...names.filter((f) => f !== 'index.html'), ...PUBLIC_FILES];
      const hash = createHash('sha256');
      for (const f of [...names, ...PUBLIC_FILES]) {
        hash.update(f);
        hash.update(readFileSync(join(outDir, f)));
      }
      const template = readFileSync(new URL('./src/sw.template.js', import.meta.url), 'utf8');
      hash.update(template);
      const version = hash.digest('hex').slice(0, 12);
      // Ersetzungen als Funktion, damit "$" in Dateinamen nicht als Muster interpretiert wird
      const source = template
        .replace('__VERSION__', () => version)
        .replace('__PRECACHE__', () => JSON.stringify(precache));
      writeFileSync(join(outDir, 'sw.js'), source, 'utf8');
    },
  };
}

export default defineConfig({
  base: './', // relative Pfade: läuft unter Domain-Wurzel und unter /<repo>/ auf GitHub Pages
  build: {
    target: 'es2022',
    assetsInlineLimit: 0, // Wortliste nie in JS einbetten
  },
  plugins: [serviceWorker()],
});
