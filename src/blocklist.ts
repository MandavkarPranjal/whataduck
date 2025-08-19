import './global.css';
import Fuse from 'fuse.js';

interface Bang { t: string; s: string; d: string; r: number; u: string; c?: string; sc?: string; }
interface BlockState { legacy: Set<string>; modes: { [tag: string]: { root?: boolean; search?: boolean } }; rootSet: Set<string>; searchSet: Set<string>; }

const LEGACY_KEY = 'blocked-bangs';
const MODES_KEY = 'blocked-bangs-modes';

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

function loadModes(): { [tag: string]: { root?: boolean; search?: boolean } } {
  try {
    const raw = localStorage.getItem(MODES_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
    return {};
  } catch { return {}; }
}
function saveModes(m: { [tag: string]: { root?: boolean; search?: boolean } }) { localStorage.setItem(MODES_KEY, JSON.stringify(m)); }

function recomputeSets(state: BlockState) {
  const root = new Set<string>();
  const search = new Set<string>();
  for (const k in state.modes) {
    const low = k.toLowerCase();
    if (state.modes[k].root) root.add(low);
    if (state.modes[k].search) search.add(low);
  }
  state.legacy.forEach(tag => { if (!(tag in state.modes)) { root.add(tag); search.add(tag); } });
  state.rootSet = root; state.searchSet = search;
}

const state: BlockState = { legacy: loadLegacy(), modes: loadModes(), rootSet: new Set(), searchSet: new Set() };
recomputeSets(state);

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

function renderBlocked() { /* removed UI chips: just update counts / maybe future summary */
  blockedChips.innerHTML = '';
  blockedEmpty.style.display = 'none';
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
    if (visibleCount < targetPreloaded) {
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

function rowHtml(b: Bang): string { /* single button with dropdown */
  const tag = b.t.toLowerCase();
  const root = state.rootSet.has(tag);
  const search = state.searchSet.has(tag);
  const blocked = root || search;
  let label = 'Block';
  if (blocked) {
    if (root && search) label = 'Both';
    else if (root && !search) label = 'Root';
    else if (!root && search) label = 'Search';
  }
  return `<tr data-tag="${b.t}">
    <td style="width:20%;"><span class="tag">!${b.t}</span></td>
    <td>${b.s}</td>
    <td style="width:40%; text-align:right; position:relative;" class="actions">
      <button class="btn btn-outline mode-trigger" data-action="mode-trigger" aria-haspopup="true" aria-expanded="false" aria-pressed="${blocked}" data-blocked="${blocked}">${label}${blocked ? ' ▾' : ''}</button>
      <div class="mode-menu" role="menu" hidden>
        <button role="menuitemradio" class="mode-item" data-mode="both" aria-checked="${root && search}">Both</button>
        <button role="menuitemradio" class="mode-item" data-mode="root" aria-checked="${root && !search}">Root</button>
        <button role="menuitemradio" class="mode-item" data-mode="search" aria-checked="${!root && search}">Search</button>
        <div class="separator" role="separator"></div>
        <button role="menuitem" class="mode-item unblock" data-mode="unblock" ${blocked ? '' : 'disabled'}>Unblock</button>
      </div>
    </td>
  </tr>`;
}

const lastModeMemory: Record<string, 'both' | 'root' | 'search'> = {};

function attachRowHandlers(tr: HTMLTableRowElement) { /* handlers for dropdown */
  const tag = tr.getAttribute('data-tag')!.toLowerCase();
  const trigger = tr.querySelector('button.mode-trigger') as HTMLButtonElement;
  const menu = tr.querySelector('.mode-menu') as HTMLDivElement;

  function updateTrigger(blockRoot: boolean, blockSearch: boolean) {
    const blocked = blockRoot || blockSearch;
    trigger.dataset.blocked = String(blocked);
    trigger.setAttribute('aria-pressed', String(blocked));
    let label = 'Block';
    if (blocked) {
      if (blockRoot && blockSearch) label = 'Both';
      else if (blockRoot && !blockSearch) label = 'Root';
      else if (!blockRoot && blockSearch) label = 'Search';
      trigger.innerHTML = label + ' ▾';
    } else {
      trigger.textContent = 'Block';
    }
    menu.querySelectorAll('[data-mode]')
      .forEach(el => {
        const m = (el as HTMLElement).dataset.mode!;
        if (m === 'unblock') {
          (el as HTMLButtonElement).disabled = !blocked;
          return;
        }
        const checked = (m === 'both' && blockRoot && blockSearch) || (m === 'root' && blockRoot && !blockSearch) || (m === 'search' && !blockRoot && blockSearch);
        el.setAttribute('aria-checked', String(checked));
      });
  }

  function apply(blockRoot: boolean, blockSearch: boolean) {
    state.legacy.delete(tag);
    if (!blockRoot && !blockSearch) {
      delete state.modes[tag];
    } else if (blockRoot && blockSearch) {
      delete state.modes[tag];
      state.legacy.add(tag);
    } else {
      state.modes[tag] = { root: blockRoot, search: blockSearch };
    }
    if (!(blockRoot && blockSearch)) state.legacy.delete(tag);
    recomputeSets(state);
    saveModes(state.modes);
    saveLegacy(state.legacy);
    updateTrigger(blockRoot, blockSearch);
    renderBlocked();
  }

  function openMenu() {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    // focus first selected item or first item
    const selected = menu.querySelector('[aria-checked="true"]') as HTMLElement | null;
    const focusTarget = selected || menu.querySelector('[role=menuitemradio]') as HTMLElement | null;
    focusTarget?.focus();
  }
  function closeMenu(focusTrigger = false) {
    if (menu.hidden) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (focusTrigger) trigger.focus();
  }

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    const blocked = state.rootSet.has(tag) || state.searchSet.has(tag);
    if (!blocked) {
      // first click blocks using remembered or default both
      const remembered = lastModeMemory[tag];
      if (remembered === 'root') { state.modes[tag] = { root: true, search: false }; state.legacy.delete(tag); }
      else if (remembered === 'search') { state.modes[tag] = { root: false, search: true }; state.legacy.delete(tag); }
      else if (remembered === 'both') { delete state.modes[tag]; state.legacy.add(tag); }
      else { delete state.modes[tag]; state.legacy.add(tag); }
      recomputeSets(state); saveModes(state.modes); saveLegacy(state.legacy);
      updateTrigger(state.rootSet.has(tag), state.searchSet.has(tag));
      return; // do not open menu on initial block
    }
    // toggle menu
    if (menu.hidden) openMenu(); else closeMenu();
  });

  menu.addEventListener('click', ev => {
    const btn = (ev.target as HTMLElement).closest('button[data-mode]') as HTMLButtonElement | null;
    if (!btn) return;
    const mode = btn.dataset.mode!;
    if (mode === 'unblock') {
      // remember last mode
      const wasRoot = state.rootSet.has(tag);
      const wasSearch = state.searchSet.has(tag);
      if (wasRoot && wasSearch) lastModeMemory[tag] = 'both';
      else if (wasRoot && !wasSearch) lastModeMemory[tag] = 'root';
      else if (!wasRoot && wasSearch) lastModeMemory[tag] = 'search';
      delete state.modes[tag];
      state.legacy.delete(tag);
      recomputeSets(state); saveModes(state.modes); saveLegacy(state.legacy);
      apply(false,false);
      closeMenu(true);
      return;
    }
    if (mode === 'both') apply(true,true);
    else if (mode === 'root') apply(true,false);
    else if (mode === 'search') apply(false,true);
    closeMenu(true);
  });

  tr.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { closeMenu(true); }
  });
  trigger.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown' && menu.hidden) { ev.preventDefault(); openMenu(); }
  });
  menu.addEventListener('keydown', ev => {
    const focusables = Array.from(menu.querySelectorAll('button.mode-item:not([disabled])')) as HTMLButtonElement[];
    const idx = focusables.indexOf(document.activeElement as HTMLButtonElement);
    if (ev.key === 'ArrowDown') { ev.preventDefault(); focusables[(idx+1)%focusables.length].focus(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); focusables[(idx-1+focusables.length)%focusables.length].focus(); }
    else if (ev.key === 'Home') { ev.preventDefault(); focusables[0].focus(); }
    else if (ev.key === 'End') { ev.preventDefault(); focusables[focusables.length-1].focus(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); closeMenu(true); }
    else if (ev.key === 'Tab') { closeMenu(); }
    else if (ev.key === 'Enter' || ev.key === ' ') { (document.activeElement as HTMLButtonElement).click(); }
  });

  updateTrigger(state.rootSet.has(tag), state.searchSet.has(tag));
}


function updateRowsBlockedState() {
  // rows already reflect state via existing handlers; no incremental sync needed currently
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

// Legacy toggle removed (obsolete)

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
  delete state.modes[tag];
  state.legacy.add(tag);
  recomputeSets(state);
  saveLegacy(state.legacy);
  saveModes(state.modes);
  bangInput.value = '';
  renderBlocked();
  updateRowsBlockedState();
});

['focus','input','keydown','click'].forEach(ev => {
  filterInput.addEventListener(ev, async () => { if (!allBangs) { await ensureLoaded(); } });
});

let filterDebounce: ReturnType<typeof setTimeout>;
filterInput.addEventListener('input', () => {
  clearTimeout(filterDebounce);
  filterDebounce = setTimeout(() => applyFilter(), 150);
});
resultsDiv.addEventListener('scroll', maybeLoadMoreOnScroll);

renderBlocked();
(function scheduleAutoLoad(){
  const start = () => { if (!allBangs) ensureLoaded(); };
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(start, { timeout: 1500 });
  } else {
    setTimeout(start, 150);
  }
})();
