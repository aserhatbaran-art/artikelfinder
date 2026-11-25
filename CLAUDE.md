# Artikelfinder
Zweck: Offline-PWA, die per Live-Suche den Artikel (der/die/das, auch mehrere) deutscher Substantive anzeigt; Ausbaustufe 2: Bedeutungen offline.

## Befehle
- Installieren: `npm install`
- Daten erzeugen: `npm run data` (braucht `data/raw/raw-wiktextract-data.jsonl.gz` von kaikki.org/dewiktionary/rawdata.html; ~15 s)
- Icons erzeugen: `node scripts/make-icons.mjs`
- Entwickeln: `npm run dev` (ungeprüft)
- Testen: `npm test`
- Build: `npm run build` → `dist/`
- Build ansehen inkl. Service Worker: `npm run preview` (Port 4173; `.claude/launch.json` „preview“)

## Struktur
- `src/search.ts`: NounIndex – Präfixsuche (Binärsuche), exakte Treffer, Komposita-Ableitung vom Grundwort
- `src/normalize.ts`: Suchschlüssel (klein, ß→ss, ohne Diakritika); gemeinsam von App und Datenskript genutzt
- `src/main.ts`, `index.html`, `src/style.css`: Oberfläche ohne Framework
- `src/data/nomen.txt`: generierte Wortliste `Wort\tCode` (m/f/n, p = nur Plural), nach Suchschlüssel sortiert
- `src/sw.template.js` + Plugin in `vite.config.ts`: erzeugt `dist/sw.js` mit Precache-Liste und Inhalts-Version
- `scripts/build-data.mjs`: Pipeline Wiktextract → nomen.txt + `data/bedeutungen.json`
- `tests/search.test.ts`: Logiktests + Stichproben gegen echte Wortliste + Performance
- `.github/workflows/deploy.yml`: Test, Build, Deploy auf GitHub Pages (Actions auf SHA gepinnt)

## Konventionen
- TypeScript strict, Vite, keine Laufzeit-Abhängigkeiten; devDependencies mit festen Versionen
- Node 26 (Datenskript importiert `.ts` per Type-Stripping)
- `base: './'` – relative Pfade, läuft unter Domain-Wurzel und /<repo>/
- UI-Texte und Kommentare auf Deutsch

## Achtung
- `src/data/nomen.txt` und `data/bedeutungen.json` sind generiert und CC BY-SA 4.0 (Wiktionary) – nicht von Hand ändern, Quellenangabe im Info-Dialog beibehalten
- `data/raw/` (≈300 MB) ist gitignored
- Sortierung in nomen.txt muss zu `compareEntries` passen, sonst sortiert die App beim Start neu (langsam)
- Neue Dateien in `public/` in `PUBLIC_FILES` (vite.config.ts) eintragen, sonst nicht offline verfügbar
