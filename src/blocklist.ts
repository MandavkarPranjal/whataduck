import './global.css';
import Fuse from 'fuse.js';

interface Bang { t: string; s: string; d: string; r: number; u: string; c?: string; sc?: string; }
interface BlockState { blocked: Set<string>; }

const STORAGE_KEY = 'blocked-bangs';

function loadBlocked(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr.map(s => String(s).toLowerCase()));
    return new Set();
  } catch { return new Set(); }
}
function saveBlocked(blocked: Set<string>) { localStorage.setItem(STORAGE_KEY, JSON.stringify([...blocked])); }

const state: BlockState = { blocked: loadBlocked() };

const bangInput = document.getElementById('bang-input') as HTMLInputElement;
const addForm = document.getElementById('add-form') as HTMLFormElement;
const blockedChips = document.getElementById('blocked-chips')!;
const blockedEmpty = document.getElementById('blocked-empty')!;
const resultsDiv = document.getElementById('results')!;
const filterInput = document.getElementById('filter-input') as HTMLInputElement;
const totalCountSpan = document.getElementById('total-count')!;

// Lazy load data
let allBangs: Bang[] | null = null;
let fuse: Fuse<Bang> | null = null;
let visibleCount = 0; // number of rows currently rendered
const CHUNK = 25;
const PRELOAD = 50; // first two chunks preloaded
let currentFiltered: Bang[] = [];
let loading = false;

function ensureLoaded(): Promise<void> {
  if (allBangs) return Promise.resolve();
  if (loading) return new Promise(res => {
    const iv = setInterval(() => { if (!loading) { clearInterval(iv); res(); } }, 30); });
  loading = true;
  resultsDiv.innerHTML = '<div style="padding:16px; text-align:center; font-size:14px;">Loading bang list…</div>';
  return import('./bang').then(mod => {
    allBangs = mod.bangs.map(b => ({ ...b, c: (b as any).c ?? '', sc: (b as any).sc ?? '' }));
    fuse = new Fuse(allBangs, { keys: [{ name: 't', weight: 0.7 }, { name: 's', weight: 0.3 }], threshold: 0.4 });
    totalCountSpan.textContent = String(allBangs.length);
    filterInput.disabled = false;
    filterInput.placeholder = 'Search bangs to block';
    currentFiltered = allBangs.slice();
    visibleCount = 0;
    renderMore(true); // initial render
  }).finally(() => { loading = false; });
}

function renderBlocked() {
  blockedChips.innerHTML = '';
  if (state.blocked.size === 0) blockedEmpty.style.display = 'block'; else blockedEmpty.style.display = 'none';
  [...state.blocked].sort().forEach(tag => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `!${tag} <button aria-label="Unblock ${tag}">×</button>`;
    chip.querySelector('button')!.addEventListener('click', () => { state.blocked.delete(tag); saveBlocked(state.blocked); renderBlocked(); updateRowsBlockedState(); });
    blockedChips.appendChild(chip);
  });
}

function buildTableIfNeeded() {
  if (!resultsDiv.querySelector('table')) {
    resultsDiv.innerHTML = '<table><tbody></tbody></table>';
  }
}

function renderMore(initial = false) {
  if (!allBangs) return;
  buildTableIfNeeded();
  const tbody = resultsDiv.querySelector('tbody')!;
  const targetPreloaded = Math.min(PRELOAD, currentFiltered.length);
  let available = initial ? Math.min(CHUNK, currentFiltered.length) : 0;
  if (!initial) {
    // decide how many to append this call
    if (visibleCount < targetPreloaded) {
      // within preloaded window
      available = Math.min(CHUNK, targetPreloaded - visibleCount);
    } else {
      available = Math.min(CHUNK, currentFiltered.length - visibleCount);
    }
  }
  if (initial && visibleCount === 0) {
    available = Math.min(CHUNK, currentFiltered.length);
  }
  const slice = currentFiltered.slice(visibleCount, visibleCount + available);
  const rowsHtml = slice.map(b => rowHtml(b)).join('');
  const temp = document.createElement('tbody');
  temp.innerHTML = rowsHtml;
  [...temp.children].forEach(tr => attachRowHandlers(tr as HTMLTableRowElement));
  tbody.append(...temp.children);
  visibleCount += slice.length;
  if (visibleCount === 0 && !loading) {
    resultsDiv.innerHTML = '<div style="padding:16px; text-align:center; font-size:14px;">No results</div>';
  }
}

function rowHtml(b: Bang): string {
  const blocked = state.blocked.has(b.t.toLowerCase());
  return `<tr data-tag="${b.t}">
    <td style="width:30%;"><span class="tag">!${b.t}</span></td>
    <td>${b.s}</td>
    <td style="width:20%; text-align:right;" class="actions">
      <button class="small ${blocked ? 'remove' : ''}" data-action="toggle">${blocked ? 'Unblock' : 'Block'}</button>
    </td>
  </tr>`;
}

function attachRowHandlers(tr: HTMLTableRowElement) {
  const tag = tr.getAttribute('data-tag')!.toLowerCase();
  tr.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return; // button handles itself
    toggle(tag);
  });
  const button = tr.querySelector('button[data-action=toggle]')!;
  button.addEventListener('click', (e) => { e.stopPropagation(); toggle(tag); });
}

function updateRowsBlockedState() {
  resultsDiv.querySelectorAll('tr').forEach(tr => {
    const tag = tr.getAttribute('data-tag')!.toLowerCase();
    const blocked = state.blocked.has(tag);
    const btn = tr.querySelector('button[data-action=toggle]') as HTMLButtonElement;
    btn.textContent = blocked ? 'Unblock' : 'Block';
    btn.classList.toggle('remove', blocked);
  });
}

function searchBangs(term: string): Bang[] {
  if (!term) {
    return allBangs ? allBangs.map(b => ({ ...b })) : [];
  }
  if (fuse) return fuse.search(term).map(r => r.item);
  return [];
}

function applyFilter() {
  if (!allBangs) return;
  const term = filterInput.value.trim();
  currentFiltered = searchBangs(term);
  visibleCount = 0;
  resultsDiv.innerHTML = '';
  renderMore(true);
}

function maybeLoadMoreOnScroll() {
  if (!allBangs) return;
  if (resultsDiv.scrollTop + resultsDiv.clientHeight >= resultsDiv.scrollHeight - 8) {
    if (visibleCount < currentFiltered.length) {
      renderMore();
    }
  }
}

function toggle(tag: string) {
  tag = tag.toLowerCase();
  if (state.blocked.has(tag)) state.blocked.delete(tag); else state.blocked.add(tag);
  saveBlocked(state.blocked);
  renderBlocked();
  updateRowsBlockedState();
}

addForm.addEventListener('submit', async e => {
  e.preventDefault();
  const tag = bangInput.value.trim().replace(/^!/, '').toLowerCase();
  if (!tag) return;
  await ensureLoaded();
  if (!allBangs!.some(b => b.t.toLowerCase() === tag)) {
    bangInput.setCustomValidity('Unknown bang tag');
    bangInput.reportValidity();
    setTimeout(() => bangInput.setCustomValidity(''), 1500);
    return;
  }
  state.blocked.add(tag);
  saveBlocked(state.blocked);
  bangInput.value = '';
  renderBlocked();
  updateRowsBlockedState();
});

// Retain interaction-based fallback (if auto-load was delayed for any reason)
['focus','input','keydown','click'].forEach(ev => {
  filterInput.addEventListener(ev, async () => { if (!allBangs) { await ensureLoaded(); } });
});

// Debounced filter input matching search page behavior
let filterDebounce: ReturnType<typeof setTimeout>;
filterInput.addEventListener('input', () => {
  clearTimeout(filterDebounce);
  filterDebounce = setTimeout(() => applyFilter(), 150);
});
resultsDiv.addEventListener('scroll', maybeLoadMoreOnScroll);

renderBlocked();
// Auto-load bangs shortly after page load (preferred UX)
(function scheduleAutoLoad(){
  const start = () => { if (!allBangs) ensureLoaded(); };
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(start, { timeout: 1500 });
  } else {
    setTimeout(start, 150);
  }
})();
