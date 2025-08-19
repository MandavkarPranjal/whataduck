import './global.css';
import Fuse from 'fuse.js';

interface Bang { t: string; s: string; d: string; r: number; u: string; c?: string; sc?: string; }

const LEGACY_KEY = 'blocked-bangs';
const MODES_KEY = 'blocked-bangs-modes'; // will be read once then ignored

function loadLegacy(): Set<string> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr.map(s => String(s).toLowerCase()));
    return new Set();
  } catch { return new Set(); }
}
function saveLegacy(set: Set<string>) { localStorage.setItem(LEGACY_KEY, JSON.stringify([...set])); }

// One-time merge of existing per-mode structure (we treat any partial block as full block for simplicity)
function mergeModesIntoLegacy(legacy: Set<string>) {
  try {
    const raw = localStorage.getItem(MODES_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') {
      for (const k in obj) {
        legacy.add(k.toLowerCase());
      }
      saveLegacy(legacy);
    }
  } catch { /* ignore */ }
}

const legacy = loadLegacy();
mergeModesIntoLegacy(legacy); // idempotent

const bangInput = document.getElementById('bang-input') as HTMLInputElement;
const addForm = document.getElementById('add-form') as HTMLFormElement;
const blockedChips = document.getElementById('blocked-chips')!;
const blockedEmpty = document.getElementById('blocked-empty')!;
const resultsDiv = document.getElementById('results')!;
const filterInput = document.getElementById('filter-input') as HTMLInputElement;
const totalCountSpan = document.getElementById('total-count')!;

let allBangs: Bang[] | null = null;
let fuse: Fuse<Bang> | null = null;
let current: Bang[] = [];
let loading = false;

function ensureLoaded(): Promise<void> {
  if (allBangs) return Promise.resolve();
  if (loading) return new Promise(res => { const iv = setInterval(()=>{ if(!loading){ clearInterval(iv); res(); } }, 30); });
  loading = true;
  resultsDiv.innerHTML = '<div style="padding:16px; text-align:center; font-size:14px;">Loading bang list…</div>';
  return import('./bang').then(mod => {
    allBangs = mod.bangs.map(b => ({ ...b, c: (b as any).c ?? '', sc: (b as any).sc ?? '' }));
    fuse = new Fuse(allBangs, { keys:[{name:'t',weight:0.7},{name:'s',weight:0.3}], threshold:0.4 });
    totalCountSpan.textContent = String(allBangs.length);
    filterInput.disabled = false;
    filterInput.placeholder = 'Search bangs to block';
    current = allBangs.slice();
    renderTable();
  }).finally(()=>{ loading = false; });
}

function renderBlocked() {
  if (legacy.size === 0) {
    blockedChips.innerHTML = '';
    blockedEmpty.style.display = 'block';
    blockedEmpty.textContent = 'No blocked bangs yet';
    return;
  }
  blockedEmpty.style.display = 'none';
  blockedChips.innerHTML = [...legacy].sort().map(tag => (
    `<span class="chip" data-chip="${tag}"><code>!${tag}</code><button aria-label="Unblock ${tag}" data-remove="${tag}">×</button></span>`
  )).join('');
  blockedChips.querySelectorAll('button[data-remove]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const t = (e.currentTarget as HTMLElement).getAttribute('data-remove')!;
      legacy.delete(t);
      saveLegacy(legacy);
      renderBlocked();
      // update table row state if visible
      const row = resultsDiv.querySelector(`tr[data-tag="${t}"]`);
      if (row) updateRowBlocked(row as HTMLTableRowElement);
    });
  });
}

function rowHtml(b: Bang): string {
  const blocked = legacy.has(b.t.toLowerCase());
  return `<tr data-tag="${b.t}" class="${blocked?'is-blocked':''}">
    <td style="width:20%;"><span class="tag">!${b.t}</span></td>
    <td>${b.s}</td>
    <td style="width:40%; text-align:right; font-size:12px; color:${blocked?'#c62828':'#666'};">${blocked?'Blocked':'Click to block'}</td>
  </tr>`;
}

function renderTable() {
  if (!allBangs) return;
  resultsDiv.innerHTML = '<table style="width:100%; border-collapse:collapse; font-size:14px;"><tbody></tbody></table>';
  const tbody = resultsDiv.querySelector('tbody')!;
  tbody.innerHTML = current.map(b => rowHtml(b)).join('');
  tbody.querySelectorAll('tr').forEach(tr => attachRow(tr as HTMLTableRowElement));
}

function updateRowBlocked(tr: HTMLTableRowElement) {
  const tag = tr.getAttribute('data-tag')!;
  const blocked = legacy.has(tag.toLowerCase());
  tr.classList.toggle('is-blocked', blocked);
  const statusCell = tr.children[2] as HTMLElement;
  statusCell.style.color = blocked ? '#c62828' : '#666';
  statusCell.textContent = blocked ? 'Blocked' : 'Click to block';
}

function attachRow(tr: HTMLTableRowElement) {
  tr.addEventListener('click', () => {
    const tag = tr.getAttribute('data-tag')!.toLowerCase();
    if (legacy.has(tag)) legacy.delete(tag); else legacy.add(tag);
    saveLegacy(legacy);
    updateRowBlocked(tr);
    renderBlocked();
  });
}

function applyFilter() {
  if (!allBangs) return;
  const term = filterInput.value.trim();
  if (!term) current = allBangs.slice();
  else current = fuse!.search(term).map(r => r.item);
  renderTable();
}

addForm.addEventListener('submit', async e => {
  e.preventDefault();
  const tagRaw = bangInput.value.trim().replace(/^!/, '').toLowerCase();
  if (!tagRaw) return;
  await ensureLoaded();
  if (!allBangs!.some(b => b.t.toLowerCase() === tagRaw)) {
    bangInput.setCustomValidity('Unknown bang tag');
    bangInput.reportValidity();
    setTimeout(()=> bangInput.setCustomValidity(''), 1500);
    return;
  }
  legacy.add(tagRaw);
  saveLegacy(legacy);
  bangInput.value='';
  renderBlocked();
  // Update visible row if present
  const row = resultsDiv.querySelector(`tr[data-tag="${tagRaw}"]`);
  if (row) updateRowBlocked(row as HTMLTableRowElement);
});

filterInput.addEventListener('input', () => { applyFilter(); });
['focus','keydown','click'].forEach(ev => { filterInput.addEventListener(ev, async ()=>{ if(!allBangs) await ensureLoaded(); }); });

renderBlocked();
(function scheduleAutoLoad(){
  const start = () => { if (!allBangs) ensureLoaded(); };
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(start, { timeout: 1500 });
  } else {
    setTimeout(start, 150);
  }
})();
