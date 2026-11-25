// Suchschlüssel: Kleinschreibung, ß → ss, diakritische Zeichen entfernt (ä → a, é → e).
// Wird von der App und vom Datenskript gemeinsam genutzt, damit die Sortierung übereinstimmt.
const COMBINING = /[̀-ͯ]/g;

const NON_ASCII = /[^\x00-\x7f]/;

export function normalize(s: string): string {
  const t = s.trim();
  // Schneller Pfad: reines ASCII braucht keine Unicode-Normalisierung (Großteil der Wörter)
  if (!NON_ASCII.test(t)) return t.toLowerCase();
  return t
    .normalize('NFD')
    .replace(COMBINING, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/’/g, "'");
}

/** Codepunkt-Vergleich nach Schlüssel, bei Gleichstand nach Originalwort. */
export function compareEntries(aKey: string, aWord: string, bKey: string, bWord: string): number {
  if (aKey !== bKey) return aKey < bKey ? -1 : 1;
  if (aWord !== bWord) return aWord < bWord ? -1 : 1;
  return 0;
}
