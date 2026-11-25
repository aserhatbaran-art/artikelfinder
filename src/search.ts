import { compareEntries, normalize } from './normalize';

/** m/f/n = maskulin/feminin/neutrum, p = nur Plural */
export type Genus = 'm' | 'f' | 'n' | 'p';

export interface Hit {
  word: string;
  genera: Genus[];
  kind: 'exact' | 'prefix' | 'derived';
  /** Bei kind = 'derived': das Grundwort, von dem der Artikel stammt */
  base?: string;
}

const MIN_BASE = 3; // Mindestlänge des Grundworts bei Komposita
const MIN_HEAD = 2; // Mindestlänge des Bestimmungsworts

function parseCode(code: string): Genus[] {
  const g = [...code].filter((c): c is Genus => c === 'm' || c === 'f' || c === 'n' || c === 'p');
  // "nur Plural" nur anzeigen, wenn es keinen Singular-Genus gibt
  return g.some((x) => x !== 'p') ? g.filter((x) => x !== 'p') : g;
}

export class NounIndex {
  private words: string[] = [];
  private codes: string[] = [];
  private keys: string[] = [];

  /** @param data Zeilen "<Wort>\t<Code>", idealerweise bereits nach Suchschlüssel sortiert (spart das Sortieren) */
  constructor(data: string) {
    const { words, codes, keys } = this;
    for (const line of data.split('\n')) {
      const tab = line.indexOf('\t');
      if (tab <= 0) continue;
      const word = line.slice(0, tab);
      words.push(word);
      codes.push(line.slice(tab + 1).trim());
      keys.push(normalize(word));
    }
    for (let i = 1; i < keys.length; i++) {
      if (compareEntries(keys[i - 1], words[i - 1], keys[i], words[i]) > 0) {
        this.sortAll();
        break;
      }
    }
  }

  private sortAll(): void {
    const order = this.keys.map((_, i) => i);
    order.sort((a, b) => compareEntries(this.keys[a], this.words[a], this.keys[b], this.words[b]));
    this.words = order.map((i) => this.words[i]);
    this.codes = order.map((i) => this.codes[i]);
    this.keys = order.map((i) => this.keys[i]);
  }

  /** Indizes aller Einträge mit genau diesem Schlüssel (zusammenhängender Bereich der sortierten Liste) */
  private exact(key: string): number[] {
    const out: number[] = [];
    for (let i = this.lowerBound(key); i < this.keys.length && this.keys[i] === key; i++) out.push(i);
    return out;
  }

  get size(): number {
    return this.words.length;
  }

  search(input: string, limit = 15): Hit[] {
    const q = normalize(input);
    if (!q) return [];
    const typed = input.trim().toLowerCase();

    // 1. Exakte Treffer; die Schreibweise, die genau der Eingabe entspricht, zuerst (Maß vor Mass)
    const exactIdx = this.exact(q).sort(
      (a, b) => Number(this.words[b].toLowerCase() === typed) - Number(this.words[a].toLowerCase() === typed),
    );
    const hits: Hit[] = exactIdx.map((i) => this.hit(i, 'exact'));

    // 2. Präfix-Treffer: die kürzesten Wörter des zusammenhängenden Bereichs
    const need = limit - hits.length;
    if (need > 0) {
      const best: number[] = [];
      for (let i = this.lowerBound(q); i < this.keys.length && this.keys[i].startsWith(q); i++) {
        if (this.keys[i] === q) continue;
        const len = this.keys[i].length;
        if (best.length === need && len >= this.keys[best[need - 1]].length) continue;
        let pos = best.length;
        while (pos > 0 && this.keys[best[pos - 1]].length > len) pos--;
        best.splice(pos, 0, i);
        if (best.length > need) best.pop();
      }
      for (const i of best) hits.push(this.hit(i, 'prefix'));
    }

    // 3. Kein exakter Treffer: Artikel vom Grundwort ableiten (Kompositum)
    if (exactIdx.length === 0) {
      const derived = this.derive(input.trim(), q);
      // Mit Präfix-Treffern (Nutzer tippt evtl. noch) steht die Ableitung hinten, bekommt aber immer einen Platz
      if (derived.length) return [...hits.slice(0, Math.max(0, limit - derived.length)), ...derived];
    }
    return hits;
  }

  private derive(original: string, q: string): Hit[] {
    // Nur echte Einzelwörter (Buchstaben, ggf. mit Bindestrich: "Auto-Anhänger"), keine Wortgruppen oder Zahlen
    if (!/^\p{L}+(?:-\p{L}+)*$/u.test(original)) return [];
    for (let i = MIN_HEAD; i <= q.length - MIN_BASE; i++) {
      const idx = this.exact(q.slice(i));
      if (!idx.length) continue;
      // Abkürzungen (USt, PKW) taugen nicht als Grundwort
      const usable = idx.filter((j) => /^\p{Lu}\p{Ll}/u.test(this.words[j]));
      if (!usable.length) continue;
      const word = original.charAt(0).toUpperCase() + original.slice(1);
      return usable.map((j) => ({ ...this.hit(j, 'derived'), word, base: this.words[j] }));
    }
    return [];
  }

  private hit(i: number, kind: Hit['kind']): Hit {
    return { word: this.words[i], genera: parseCode(this.codes[i]), kind };
  }

  private lowerBound(q: string): number {
    let lo = 0;
    let hi = this.keys.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.keys[mid] < q) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
}
