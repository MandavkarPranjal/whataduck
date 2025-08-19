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

function renderBlocked() {
  blockedChips.innerHTML = '';
  const active = new Set<string>();
  state.rootSet.forEach(t => active.add(t));
  state.searchSet.forEach(t => active.add(t));
  if (active.size === 0) blockedEmpty.style.display = 'block'; else blockedEmpty.style.display = 'none';
  [...active].sort().forEach(tag => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    const root = state.rootSet.has(tag);
    const search = state.searchSet.has(tag);
    const labelParts = [] as string[];
    if (root) labelParts.push('root');
    if (search) labelParts.push('search');
    let suffix = '';
    if (root && !search) suffix = ' (R)';
    else if (!root && search) suffix = ' (S)';
    chip.innerHTML = `!${tag}<span style="font-size:11px;color:#666;">${suffix}</span> <button aria-label="Unblock ${tag}">×</button>`;
    chip.querySelector('button')!.addEventListener('click', () => {
      // Unblock both modes: remove from modes & legacy if exists
      delete state.modes[tag];
      state.legacy.delete(tag);
      recomputeSets(state);
      saveModes(state.modes);
      saveLegacy(state.legacy);
      renderBlocked();
      updateRowsBlockedState();
    });
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

function rowHtml(b: Bang): string { /* updated for popover modes */
  const tag = b.t.toLowerCase();
  const root = state.rootSet.has(tag);
  const search = state.searchSet.has(tag);
  const blocked = root || search;
  let modeSuffix = '';
  if (blocked) {
    if (root && !search) modeSuffix = ' (R)';
    else if (!root && search) modeSuffix = ' (S)';
  }
  return `<tr data-tag="${b.t}">
    <td style="width:20%;"><span class="tag">!${b.t}</span></td>
    <td>${b.s}</td>
    <td style="width:40%; text-align:right; position:relative;" class="actions">
      <button class="small" data-action="toggle-main" aria-pressed="${blocked}" title="${blocked ? 'Unblock' : 'Block'} this bang">${blocked ? 'Unblock' : 'Block'}</button>
      <button class="small modes-trigger" data-action="modes" style="margin-left:4px;${blocked ? '' : 'display:none;'}" aria-haspopup="true" aria-expanded="false" title="Adjust block modes">⋯</button>
      <div class="modes-popover" role="dialog" aria-label="Block modes" style="display:none;">
        <form data-action="modes-form">
          <label><input type="radio" name="mode-${b.t}" value="both" ${(root&&search)?'checked':''}/> Both</label>
          <label><input type="radio" name="mode-${b.t}" value="root" ${(root&&!search)?'checked':''}/> Root only</label>
            <label><input type="radio" name="mode-${b.t}" value="search" ${(!root&&search)?'checked':''}/> Search only</label>
          <div style="text-align:right;margin-top:6px;">
            <button type="button" data-action="close-pop" class="small">Close</button>
          </div>
        </form>
      </div>
      <span class="mode-suffix" style="font-size:11px;color:#666;margin-left:6px;">${modeSuffix}</span>
    </td>
  </tr>`;
}

function attachRowHandlers(tr: HTMLTableRowElement) { /* updated handlers for popover */
  const tag = tr.getAttribute('data-tag')!.toLowerCase();
  const toggleBtn = tr.querySelector('button[data-action=toggle-main]') as HTMLButtonElement;
  const modesBtn = tr.querySelector('button[data-action=modes]') as HTMLButtonElement;
  const pop = tr.querySelector('.modes-popover') as HTMLDivElement;
  const form = pop.querySelector('form[data-action=modes-form]') as HTMLFormElement;
  const closeBtn = pop.querySelector('button[data-action=close-pop]') as HTMLButtonElement;
  const suffixSpan = tr.querySelector('.mode-suffix') as HTMLSpanElement;

  function apply(blockRoot: boolean, blockSearch: boolean) {
    // remove legacy if modifying
    state.legacy.delete(tag);
    if (!blockRoot && !blockSearch) {
      delete state.modes[tag];
    } else {
      state.modes[tag] = { root: blockRoot, search: blockSearch };
    }
    recomputeSets(state);
    saveModes(state.modes);
    saveLegacy(state.legacy);
    // update UI bits inline (avoid full rerender of table chunk)
    const blocked = blockRoot || blockSearch;
    toggleBtn.textContent = blocked ? 'Unblock' : 'Block';
    toggleBtn.setAttribute('aria-pressed', String(blocked));
    modesBtn.style.display = blocked ? '' : 'none';
    let modeSuffix = '';
    if (blocked) {
      if (blockRoot && !blockSearch) modeSuffix = ' (R)';
      else if (!blockRoot && blockSearch) modeSuffix = ' (S)';
    }
    suffixSpan.textContent = modeSuffix;
    renderBlocked();
  }

  toggleBtn.addEventListener('click', e => {
    e.stopPropagation();
    const currentlyBlocked = state.rootSet.has(tag) || state.searchSet.has(tag);
    if (currentlyBlocked) {
      // unblock all
      delete state.modes[tag];
      state.legacy.delete(tag);
      recomputeSets(state);
      saveModes(state.modes); saveLegacy(state.legacy);
      toggleBtn.textContent = 'Block';
      toggleBtn.setAttribute('aria-pressed', 'false');
      modesBtn.style.display = 'none';
      suffixSpan.textContent = '';
      renderBlocked();
    } else {
      // block both
      delete state.modes[tag]; // ensure not duplicating legacy
      state.legacy.add(tag); // treat as both (legacy semantics)
      recomputeSets(state);
      saveLegacy(state.legacy); saveModes(state.modes);
      toggleBtn.textContent = 'Unblock';
      toggleBtn.setAttribute('aria-pressed', 'true');
      modesBtn.style.display = '';
      suffixSpan.textContent = '';
      renderBlocked();
    }
  });

  function openPop() {
    if (pop.style.display === 'block') return;
    // sync radios with current state
    const root = state.rootSet.has(tag);
    const search = state.searchSet.has(tag);
    (form.querySelector(`input[value="both"]`) as HTMLInputElement).checked = root && search;
    (form.querySelector(`input[value="root"]`) as HTMLInputElement).checked = root && !search;
    (form.querySelector(`input[value="search"]`) as HTMLInputElement).checked = !root && search;
    pop.style.display = 'block';
    modesBtn.setAttribute('aria-expanded', 'true');
    const firstRadio = form.querySelector('input[type=radio]:checked') as HTMLInputElement || form.querySelector('input[type=radio]') as HTMLInputElement;
    firstRadio?.focus();
    document.addEventListener('mousedown', outsideHandler);
    document.addEventListener('keydown', escHandler);
  }
  function closePop() {
    if (pop.style.display === 'none') return;
    pop.style.display = 'none';
    modesBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', outsideHandler);
    document.removeEventListener('keydown', escHandler);
    modesBtn.focus();
  }
  function outsideHandler(ev: MouseEvent) {
    if (!pop.contains(ev.target as Node) && ev.target !== modesBtn) closePop();
  }
  function escHandler(ev: KeyboardEvent) { if (ev.key === 'Escape') { closePop(); } }

  modesBtn.addEventListener('click', e => { e.stopPropagation(); if (pop.style.display === 'block') closePop(); else openPop(); });
  closeBtn.addEventListener('click', e => { e.stopPropagation(); closePop(); });

  form.addEventListener('change', () => {
    const val = (form.querySelector('input[type=radio]:checked') as HTMLInputElement)?.value;
    if (val === 'both') apply(true, true);
    else if (val === 'root') apply(true, false);
    else if (val === 'search') apply(false, true);
  });
}

function updateRowsBlockedState() {
  resultsDiv.querySelectorAll('tr').forEach(tr => {
    const tag = tr.getAttribute('data-tag')!.toLowerCase();
    const rootCb = tr.querySelector('input[data-mode=root]') as HTMLInputElement | null;
    const searchCb = tr.querySelector('input[data-mode=search]') as HTMLInputElement | null;
    const clearBtn = tr.querySelector('button[data-action=clear]') as HTMLButtonElement | null;
    if (rootCb) rootCb.checked = state.rootSet.has(tag);
    if (searchCb) searchCb.checked = state.searchSet.has(tag);
    if (clearBtn) clearBtn.style.visibility = (state.rootSet.has(tag) || state.searchSet.has(tag)) ? 'visible' : 'hidden';
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
  // Add as both root + search blocked (maintain legacy semantics for manual add)
  delete state.modes[tag]; // ensure legacy style not duplicated
  state.legacy.add(tag);
  recomputeSets(state);
  saveLegacy(state.legacy);
  saveModes(state.modes);
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
