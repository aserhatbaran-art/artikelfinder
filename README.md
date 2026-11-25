# Artikelfinder

Offline-PWA: Substantiv eintippen, Artikel (der/die/das) erscheint bei jedem Tastendruck. Bei mehreren gültigen Artikeln (der/die See) werden alle angezeigt; unbekannte Komposita bekommen den Artikel ihres Grundworts („abgeleitet von …“).

- Keine Laufzeit-Abhängigkeiten, kein Server, kein Tracking
- Nach dem ersten Laden komplett offline (Service Worker)
- Suche: Binärsuche über vorsortierte Schlüssel, Komposita über Suffix-Abgleich

## Entwicklung

```powershell
npm install
npm run dev      # Entwicklungsserver
npm test         # Tests (Logik + Stichproben gegen die echte Wortliste)
npm run build    # Produktions-Build nach dist/
npm run preview  # Build lokal ansehen (mit Service Worker)
```

## Wortdaten aktualisieren

1. Rohdaten des deutschen Wiktionary laden (ca. 300 MB, wöchentlich aktualisiert):
   <https://kaikki.org/dewiktionary/rawdata.html> → `raw-wiktextract-data.jsonl.gz` nach `data/raw/`
2. `npm run data` – erzeugt `src/data/nomen.txt` (App) und `data/bedeutungen.json` (Vorbereitung Ausbaustufe 2: Bedeutungen)
3. `npm test`, dann committen. Der Service Worker bekommt beim Build automatisch eine neue Version.

`data/raw/` ist von Git ausgeschlossen.

## Deployment (GitHub Pages)

1. Repository auf GitHub anlegen und pushen (Branch `main`).
2. Repository → Settings → Pages → Source: **GitHub Actions**.
3. Jeder Push auf `main` testet, baut und veröffentlicht (`.github/workflows/deploy.yml`).

Die App nutzt relative Pfade und läuft daher sowohl unter `https://<name>.github.io/<repo>/` als auch auf einer eigenen Domain.

## Lizenzen

- Code: MIT, siehe `LICENSE`.
- Wortdaten (`src/data/nomen.txt`, `data/bedeutungen.json`): abgeleitet aus dem [deutschen Wiktionary](https://de.wiktionary.org/), aufbereitet mit [Wiktextract](https://github.com/tatuylonen/wiktextract) / [kaikki.org](https://kaikki.org/dewiktionary/). Lizenz: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de). Weitergabe nur unter derselben Lizenz mit Namensnennung.
