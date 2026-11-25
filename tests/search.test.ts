import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NounIndex, type Genus } from '../src/search';

describe('NounIndex (Logik, kleine Testdaten)', () => {
  const idx = new NounIndex(
    ['Haus\tn', 'Haustür\tf', 'Hausschlüssel\tm', 'Schlüssel\tm', 'Anhänger\tm', 'Maß\tn', 'Mass\tf', 'USt\tf', 'Leute\tp', 'Teil\tmn', 'Eltern\tmp'].join('\n'),
  );

  it('findet exakte Treffer unabhängig von Groß-/Kleinschreibung und Umlauten', () => {
    expect(idx.search('haus')[0]).toMatchObject({ word: 'Haus', genera: ['n'], kind: 'exact' });
    expect(idx.search('HAUSTUR')[0]).toMatchObject({ word: 'Haustür', kind: 'exact' });
  });

  it('bevorzugt die exakt getippte Schreibweise (Maß vor Mass)', () => {
    expect(idx.search('Maß').map((h) => h.word)).toEqual(['Maß', 'Mass']);
    expect(idx.search('Mass').map((h) => h.word)).toEqual(['Mass', 'Maß']);
  });

  it('listet Präfix-Treffer, kürzeste zuerst', () => {
    const r = idx.search('Haus');
    expect(r.map((h) => h.word)).toEqual(['Haus', 'Haustür', 'Hausschlüssel']);
    expect(r[1].kind).toBe('prefix');
  });

  it('leitet unbekannte Komposita vom längsten Grundwort ab', () => {
    const [h] = idx.search('Haustürschlüsselanhänger');
    expect(h).toMatchObject({ word: 'Haustürschlüsselanhänger', genera: ['m'], kind: 'derived', base: 'Anhänger' });
    expect(idx.search('gartenhausschlüssel')[0]).toMatchObject({ kind: 'derived', base: 'Hausschlüssel' });
  });

  it('behält die Ableitung, auch wenn Präfix-Treffer das Limit füllen', () => {
    const many = new NounIndex(
      ['Anhänger\tm', ...Array.from({ length: 20 }, (_, i) => `Kinderanhängerteil${String.fromCharCode(97 + i)}\tn`)].join('\n'),
    );
    const r = many.search('Kinderanhänger');
    expect(r).toHaveLength(15);
    expect(r.at(-1)).toMatchObject({ kind: 'derived', base: 'Anhänger', genera: ['m'] });
  });

  it('leitet nur Einzelwörter ab (keine Wortgruppen/Zahlen), Bindestrich-Komposita schon', () => {
    expect(idx.search('mein anhänger').some((h) => h.kind === 'derived')).toBe(false);
    expect(idx.search('12anhänger').some((h) => h.kind === 'derived')).toBe(false);
    expect(idx.search('Auto-Anhänger')[0]).toMatchObject({ kind: 'derived', base: 'Anhänger' });
  });

  it('nutzt keine Abkürzungen als Grundwort', () => {
    expect(idx.search('Haust').some((h) => h.base === 'USt')).toBe(false);
  });

  it('kennzeichnet Pluraletantum und blendet p aus, wenn ein Genus existiert', () => {
    expect(idx.search('Leute')[0].genera).toEqual(['p']);
    expect(idx.search('Eltern')[0].genera).toEqual(['m']);
    expect(idx.search('Teil')[0].genera).toEqual(['m', 'n']);
  });

  it('liefert nichts für leere Eingabe und begrenzt die Trefferzahl', () => {
    expect(idx.search('   ')).toEqual([]);
    expect(idx.search('h', 2)).toHaveLength(2);
  });
});

describe('Echte Wortliste', () => {
  const idx = new NounIndex(readFileSync(new URL('../src/data/nomen.txt', import.meta.url), 'utf8'));
  const ordered = (w: string): Genus[] => idx.search(w).find((x) => x.kind === 'exact' && x.word === w)?.genera ?? [];
  const genera = (w: string): Genus[] => [...ordered(w)].sort();

  it('enthält eine plausible Anzahl Substantive', () => {
    expect(idx.size).toBeGreaterThan(50_000);
  });

  const single: Record<string, Genus> = {
    Tisch: 'm', Lampe: 'f', Haus: 'n', Baum: 'm', Katze: 'f', Auto: 'n', Hund: 'm', Tür: 'f', Fenster: 'n',
    Löffel: 'm', Gabel: 'f', Messer: 'n', Käse: 'm', Butter: 'f', Brot: 'n', Apfel: 'm', Birne: 'f', Wasser: 'n',
    Tag: 'm', Nacht: 'f', Jahr: 'n', Mensch: 'm', Frau: 'f', Kind: 'n', Liebe: 'f', Mädchen: 'n', Hand: 'f',
    Fuß: 'm', Auge: 'n', Straße: 'f', Bett: 'n', Universität: 'f', Bundestag: 'm', Stadt: 'f', Fluss: 'm',
    Meer: 'n', Polizei: 'f', Banane: 'f', Problem: 'n', Lösung: 'f', Ergebnis: 'n', Schlüssel: 'm', Anhänger: 'm',
  };
  // Hauptartikel steht an erster Stelle. Einige Wörter haben laut Wiktionary weitere (seltene/regionale/
  // homonyme) Artikel, z. B. der Messer (Messender), das Mensch (abwertend), der/das Butter (regional).
  it.each(Object.entries(single))('%s: Hauptartikel %s steht zuerst', (word, g) => {
    expect(ordered(word)[0]).toBe(g);
  });

  const multi: Record<string, Genus[]> = {
    See: ['f', 'm'], Teil: ['m', 'n'], Band: ['f', 'm', 'n'], Kiefer: ['f', 'm', 'n'], Leiter: ['f', 'm'],
    Tor: ['m', 'n'], Steuer: ['f', 'n'], Gehalt: ['m', 'n'], Messer: ['m', 'n'], Mensch: ['m', 'n'],
  };
  it.each(Object.entries(multi))('%s hat mehrere Artikel %j', (word, g) => {
    expect(genera(word)).toEqual(g);
  });

  it('Joghurt: der und das sind enthalten', () => {
    expect(genera('Joghurt')).toEqual(expect.arrayContaining(['m', 'n']));
  });

  it.each(['Leute', 'Ferien', 'Eltern'])('%s ist Pluraletantum', (word) => {
    expect(genera(word)).toEqual(['p']);
  });

  it('findet Mädchen auch ohne Umlaut und Straße mit ss', () => {
    expect(idx.search('madchen')[0].word).toBe('Mädchen');
    expect(idx.search('strasse')[0].word).toBe('Straße');
  });

  it('leitet Haustürschlüsselanhänger als maskulin ab', () => {
    const [h] = idx.search('Haustürschlüsselanhänger');
    expect(h.kind).toBe('derived');
    expect(h.genera).toEqual(['m']);
  });

  it('sucht schnell genug für Live-Suche (< 1 ms je Tastendruck im Mittel)', () => {
    const words = ['h', 'ha', 'hau', 'haus', 'haust', 'haustür', 'k', 'ki', 'kin', 'kind', 's', 'sch', 'schl', 'xyzq', 'haustürschlüsselanhänger'];
    const t0 = performance.now();
    for (let r = 0; r < 100; r++) for (const w of words) idx.search(w);
    const avg = (performance.now() - t0) / (100 * words.length);
    console.log(`mittlere Suchzeit: ${avg.toFixed(3)} ms`);
    expect(avg).toBeLessThan(1);
  });
});
