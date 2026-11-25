#!/usr/bin/env node
// Erzeugt die Artikeldaten der App aus dem Wiktextract-Rohexport des deutschen Wiktionary.
// Quelle: https://kaikki.org/dewiktionary/rawdata.html (CC BY-SA 4.0 / GFDL, Wiktionary-Autoren)
//
// Aufruf: node scripts/build-data.mjs <raw-wiktextract-data.jsonl.gz>
// Ausgabe:
//   src/data/nomen.txt          eine Zeile pro Wort: "<Wort>\t<Code>", Code aus m/f/n/p (p = nur Plural),
//                               Hauptartikel zuerst (Reihenfolge der Wiktionary-Einträge)
//   data/bedeutungen.json       Kurzdefinitionen je Wort und Genus (Vorbereitung Ausbaustufe 2)

import { createReadStream, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareEntries, normalize } from '../src/normalize.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_NOMEN = resolve(ROOT, 'src/data/nomen.txt');
const OUT_DEFS = resolve(ROOT, 'data/bedeutungen.json');

const input = process.argv[2];
if (!input) {
  console.error('Aufruf: node scripts/build-data.mjs <raw-wiktextract-data.jsonl.gz>');
  process.exit(2);
}
try {
  if (!statSync(input).isFile()) throw new Error('keine Datei');
} catch (e) {
  console.error(`Eingabedatei nicht lesbar: ${input} (${e.message})`);
  process.exit(2);
}

// Gültige Substantive: Großbuchstabe oder Ziffer am Anfang, danach Buchstaben, Ziffern, Bindestrich, Apostroph, Punkt.
// Keine Leerzeichen (Mehrwortausdrücke bleiben draußen), keine Affixe ("-heit").
const WORD_RE = /^[\p{Lu}\d][\p{L}\d'’.-]*$/u;
const GENDER_TAG = { masculine: 'm', feminine: 'f', neuter: 'n' };
const ARTICLE_GENDER = { der: 'm', die: 'f', das: 'n' };
const ORDER = 'mfnp';

/** @type {Map<string, Set<string>>} */
const genders = new Map();
/** @type {Map<string, Array<[string, string[]]>>} */
const defs = new Map();
const stats = { lines: 0, deNouns: 0, formOf: 0, invalidWord: 0, noGender: 0, posTitles: new Map() };

// Liefert die Genera eines Eintrags in Wiktionary-Reihenfolge (Hauptform zuerst):
// zuerst die Artikel der Nominativ-Singular-Formen (Tabellenreihenfolge), dann übrige Genus-Tags.
function genderOf(entry) {
  const g = new Set();
  const forms = entry.forms ?? [];
  for (const f of forms) {
    const tags = f.tags ?? [];
    if (tags.includes('nominative') && tags.includes('singular') && ARTICLE_GENDER[f.article]) {
      g.add(ARTICLE_GENDER[f.article]);
    }
  }
  for (const t of entry.tags ?? []) if (GENDER_TAG[t]) g.add(GENDER_TAG[t]);
  if (g.size) return g;
  // Pluraletantum: nur Nominativ-Plural-Formen, kein Singular
  const nom = forms.filter((f) => (f.tags ?? []).includes('nominative'));
  if (nom.length && nom.every((f) => (f.tags ?? []).includes('plural'))) g.add('p');
  return g;
}

function cleanGloss(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

const rl = createInterface({
  input: createReadStream(input).pipe(createGunzip()),
  crlfDelay: Infinity,
});

const PRE_LANG = /"lang_code":\s*"de"/;
const PRE_POS = /"pos":\s*"noun"/;

for await (const line of rl) {
  stats.lines++;
  if (stats.lines % 500000 === 0) process.stderr.write(`  ${stats.lines} Zeilen …\n`);
  if (!PRE_LANG.test(line) || !PRE_POS.test(line)) continue;
  let e;
  try {
    e = JSON.parse(line);
  } catch {
    continue;
  }
  if (e.lang_code !== 'de' || e.pos !== 'noun') continue;
  stats.deNouns++;
  stats.posTitles.set(e.pos_title, (stats.posTitles.get(e.pos_title) ?? 0) + 1);
  if ((e.tags ?? []).includes('form-of')) {
    stats.formOf++;
    continue;
  }
  const word = typeof e.word === 'string' ? e.word.trim() : '';
  if (!word || word.length > 60 || !WORD_RE.test(word)) {
    stats.invalidWord++;
    continue;
  }
  const g = genderOf(e);
  if (!g.size) {
    stats.noGender++;
    continue;
  }
  if (!genders.has(word)) genders.set(word, new Set());
  for (const x of g) genders.get(word).add(x);

  const glosses = (e.senses ?? [])
    .flatMap((s) => s.glosses ?? [])
    .map(cleanGloss)
    .filter(Boolean);
  if (glosses.length) {
    const code = [...g].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join('');
    if (!defs.has(word)) defs.set(word, []);
    defs.get(word).push([code, glosses]);
  }
}

// Sortierung nach Suchschlüssel wie in der App, damit dort kein Sortieren nötig ist.
const words = [...genders.keys()]
  .map((w) => [normalize(w), w])
  .sort((a, b) => compareEntries(a[0], a[1], b[0], b[1]))
  .map(([, w]) => w);
const lines = words.map((w) => {
  // Reihenfolge des ersten Auftretens = Hauptartikel zuerst; "p" (nur Plural) immer am Ende
  const g = [...genders.get(w)];
  const code = [...g.filter((x) => x !== 'p'), ...g.filter((x) => x === 'p')].join('');
  return `${w}\t${code}`;
});

mkdirSync(dirname(OUT_NOMEN), { recursive: true });
mkdirSync(dirname(OUT_DEFS), { recursive: true });
writeFileSync(OUT_NOMEN, lines.join('\n') + '\n', 'utf8');
writeFileSync(OUT_DEFS, JSON.stringify(Object.fromEntries([...defs].sort(([a], [b]) => (a < b ? -1 : 1)))), 'utf8');

const multi = lines.filter((l) => l.split('\t')[1].replace('p', '').length > 1).length;
console.log(`Zeilen gelesen:          ${stats.lines}`);
console.log(`dt. Substantiv-Einträge: ${stats.deNouns}`);
console.log(`  davon Flexionsformen:  ${stats.formOf}`);
console.log(`  ungültige Wortform:    ${stats.invalidWord}`);
console.log(`  ohne Genus:            ${stats.noGender}`);
console.log(`Wörter in nomen.txt:     ${words.length} (mehrere Genera: ${multi})`);
console.log(`nomen.txt:               ${(statSync(OUT_NOMEN).size / 1024).toFixed(0)} KB`);
console.log(`bedeutungen.json:        ${(statSync(OUT_DEFS).size / 1048576).toFixed(1)} MB`);
console.log('pos_title-Verteilung:', Object.fromEntries([...stats.posTitles].sort((a, b) => b[1] - a[1]).slice(0, 12)));
