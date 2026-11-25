import dataUrl from './data/nomen.txt?url';
import { NounIndex, type Genus, type Hit } from './search';

const ARTICLE: Record<Genus, string> = { m: 'der', f: 'die', n: 'das', p: 'die' };

const input = document.getElementById('q') as HTMLInputElement;
const form = document.getElementById('form') as HTMLFormElement;
const list = document.getElementById('results') as HTMLUListElement;
const status = document.getElementById('status') as HTMLParagraphElement;
const info = document.getElementById('info') as HTMLDialogElement;

let index: NounIndex | null = null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderHit(h: Hit): HTMLLIElement {
  const li = el('li', `hit hit-${h.kind}`);
  const arts = el('span', 'arts');
  h.genera.forEach((g, i) => {
    if (i > 0) arts.append(el('span', 'sep', '/'));
    arts.append(el('span', `art art-${g}`, ARTICLE[g]));
  });
  li.append(arts, el('span', 'word', h.word));
  const notes: string[] = [];
  if (h.genera.length === 1 && h.genera[0] === 'p') notes.push('nur Plural');
  if (h.kind === 'derived' && h.base) notes.push(`abgeleitet von ${h.base}`);
  if (notes.length) li.append(el('span', 'note', notes.join(' · ')));
  return li;
}

function run(): void {
  const q = input.value;
  if (!index) return;
  const hits = q.trim() ? index.search(q) : [];
  const frag = document.createDocumentFragment();
  for (const h of hits) frag.append(renderHit(h));
  list.replaceChildren(frag);
  if (!q.trim()) status.textContent = '';
  else if (!hits.length) status.textContent = 'Kein Eintrag gefunden.';
  else status.textContent = hits.length === 1 ? '1 Treffer' : `${hits.length} Treffer`;
}

let urlTimer = 0;
input.addEventListener('input', () => {
  run();
  clearTimeout(urlTimer);
  urlTimer = window.setTimeout(() => {
    const url = new URL(location.href);
    if (input.value.trim()) url.searchParams.set('q', input.value.trim());
    else url.searchParams.delete('q');
    history.replaceState(null, '', url);
  }, 400);
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    input.value = '';
    input.dispatchEvent(new Event('input'));
  }
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  input.blur(); // Tastatur auf dem Handy schließen
});

document.getElementById('info-open')!.addEventListener('click', () => info.showModal());

const initial = new URLSearchParams(location.search).get('q');
if (initial) input.value = Array.from(initial).slice(0, 100).join('');

async function load(): Promise<void> {
  try {
    const res = await fetch(dataUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const t0 = performance.now();
    index = new NounIndex(text);
    const ms = performance.now() - t0;
    status.textContent = '';
    document.getElementById('data-info')!.textContent =
      `${index.size.toLocaleString('de-DE')} Substantive · Index in ${ms.toFixed(0)} ms aufgebaut`;
    run();
  } catch (err) {
    console.error(err);
    status.textContent = 'Wörterbuch konnte nicht geladen werden. Bitte Verbindung prüfen und neu laden.';
  }
}
void load();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((e) => console.error('SW', e));
  });
}
