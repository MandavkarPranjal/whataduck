import './global.css';
import Fuse from 'fuse.js';

import type { Bang as BangType } from './bang';
type Bang = BangType & { c?: string; sc?: string };
interface ModesMap { [tag: string]: { root?: boolean; search?: boolean }; }

const LEGACY_KEY = 'whataduck:blocked-bangs:v1'; // represents Both (root+search)
const MODES_KEY = 'whataduck:blocked-bangs-modes:v1'; // partial modes for tags not in legacy

function esc(s: string): string {
    return s.replace(/[&<>"'`]/g, (ch) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' } as const)[ch]!
    );
}

function loadLegacy(): Set<string> {
    try { const raw = localStorage.getItem(LEGACY_KEY); if (!raw) return new Set(); const arr = JSON.parse(raw); if (Array.isArray(arr)) return new Set(arr.map(s => String(s).toLowerCase())); } catch { }; return new Set();
}
function saveLegacy(set: Set<string>) { localStorage.setItem(LEGACY_KEY, JSON.stringify([...set])); }
function loadModes(): ModesMap { try { const raw = localStorage.getItem(MODES_KEY); if (!raw) return {}; const obj = JSON.parse(raw); if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj; } catch { }; return {}; }
function saveModes(m: ModesMap) { localStorage.setItem(MODES_KEY, JSON.stringify(m)); }

// State
const legacy = loadLegacy();
const modes: ModesMap = loadModes();

// DOM refs
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

let loadingPromise: Promise<void> | null = null;

function ensureLoaded(): Promise<void> {
    if (allBangs) return Promise.resolve();
    if (loadingPromise) return loadingPromise;
    resultsDiv.innerHTML = '<div style="padding:16px; text-align:center; font-size:14px;">Loading bang list…</div>';
    loadingPromise = import('./bang')
        .then(mod => {
            allBangs = mod.bangs.map(b => ({ ...b, c: (b as any).c ?? '', sc: (b as any).sc ?? '' }));
            fuse = new Fuse(allBangs, { keys: [{ name: 't', weight: 0.7 }, { name: 's', weight: 0.3 }], threshold: 0.4 });
            totalCountSpan.textContent = String(allBangs.length);
            filterInput.placeholder = 'Search bangs to block';
            current = allBangs.slice();
            renderTable();
        })
        .finally(() => { loadingPromise = null; });
    return loadingPromise;
}

// Helpers for mode
function getMode(tag: string): 'none' | 'both' | 'root' | 'search' {
    tag = tag.toLowerCase();
    if (legacy.has(tag)) return 'both';
    const m = modes[tag];
    if (m?.root && m?.search) return 'both'; // collapse to legacy conceptually
    if (m?.root) return 'root';
    if (m?.search) return 'search';
    return 'none';
}
function setMode(tag: string, mode: 'none' | 'both' | 'root' | 'search') {
    tag = tag.toLowerCase();
    if (mode === 'both') { legacy.add(tag); delete modes[tag]; }
    else if (mode === 'none') { legacy.delete(tag); delete modes[tag]; }
    else { legacy.delete(tag); modes[tag] = { root: mode === 'root', search: mode === 'search' }; }
    saveLegacy(legacy); saveModes(modes);
}
function cycleMode(current: 'none' | 'both' | 'root' | 'search'): 'both' | 'root' | 'search' | 'none' {
    if (current === 'none') return 'both';
    if (current === 'both') return 'root';
    if (current === 'root') return 'search';
    return 'none';
}

function modeLabel(mode: string): string {
    if (mode === 'none') return 'Block';
    if (mode === 'both') return 'Both';
    if (mode === 'root') return 'Root';
    if (mode === 'search') return 'Search';
    return 'Block';
}
function modeSuffix(mode: string): string {
    if (mode === 'both') return ' (Both)';
    if (mode === 'root') return ' (Root)';
    if (mode === 'search') return ' (Search)';
    return '';
}

// aria-live region for status updates
let live = document.getElementById('live-region');
if (!live) {
    live = document.createElement('div');
    live.id = 'live-region';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    live.style.position = 'absolute';
    live.style.width = '1px';
    live.style.height = '1px';
    live.style.margin = '-1px';
    live.style.border = '0';
    live.style.padding = '0';
    live.style.clip = 'rect(0 0 0 0)';
    live.style.overflow = 'hidden';
    document.body.appendChild(live);
}
function announce(msg: string) { if (live) live.textContent = msg; }

function announcedSetMode(tag: string, mode: 'none' | 'both' | 'root' | 'search') {
    setMode(tag, mode);
    const human = mode === 'none' ? 'unblocked' : (mode === 'both' ? 'blocked for root and search' : mode === 'root' ? 'blocked for root only' : 'blocked for search only');
    announce(`Bang !${tag} ${human}.`);
}

function renderBlocked() {
    const entries: { tag: string; mode: 'both' | 'root' | 'search' }[] = [];
    // legacy implies both
    legacy.forEach(t => entries.push({ tag: t, mode: 'both' }));
    for (const k in modes) {
        const m = modes[k];
        if (legacy.has(k)) continue; // legacy wins
        if (m.root && m.search) { // normalize to both -> move into legacy for cleanliness
            legacy.add(k); delete modes[k]; entries.push({ tag: k, mode: 'both' }); continue;
        }
        if (m.root) entries.push({ tag: k, mode: 'root' });
        else if (m.search) entries.push({ tag: k, mode: 'search' });
    }
    // Single write after potential normalizations
    saveLegacy(legacy); saveModes(modes);
    if (entries.length === 0) {
        blockedChips.innerHTML = '';
        blockedEmpty.style.display = 'block';
        blockedEmpty.textContent = 'No blocked bangs yet';
        return;
    }
    blockedEmpty.style.display = 'none';
    blockedChips.innerHTML = entries.sort((a, b) => a.tag.localeCompare(b.tag)).map(e => {
        const tag = esc(e.tag);
        const suffix = esc(modeSuffix(e.mode).trim());
        return `<span class="chip" data-chip="${tag}"><code>!${tag}</code><span style="font-size:11px;">${suffix}</span><button aria-label="Unblock ${tag}" data-remove="${tag}">×</button></span>`;
    }).join('');
    blockedChips.querySelectorAll('button[data-remove]').forEach(btn => {
        btn.addEventListener('click', ev => {
            ev.stopPropagation();
            const t = (ev.currentTarget as HTMLElement).getAttribute('data-remove')!;
            announcedSetMode(t, 'none');
            renderBlocked();
            const row = resultsDiv.querySelector(`tr[data-tag="${t}"]`);
            if (row) updateRow(row as HTMLTableRowElement);
        });
    });
}

// Legacy full-row template retained (unused after diff impl)

const rowMap: Map<string, HTMLTableRowElement> = new Map();
let table: HTMLTableElement | null = null;
let tbodyEl: HTMLTableSectionElement | null = null;

function ensureTable() {
    if (!table) {
        resultsDiv.innerHTML = '';
        table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontSize = '14px';
        table.style.tableLayout = 'fixed';
        tbodyEl = document.createElement('tbody');
        table.appendChild(tbodyEl);
        resultsDiv.appendChild(table);
    }
}

function renderTable() {
    if (!allBangs) return;
    ensureTable();
    const tbody = tbodyEl!;
    const nextKeys: string[] = [];

    // Build set of current keys for removal detection
    for (const b of current) {
        nextKeys.push(b.t);
    }

    // Remove rows no longer present
    for (const [key, tr] of rowMap) {
        if (!nextKeys.includes(key)) {
            tr.remove();
            rowMap.delete(key);
        }
    }

    // Iterate desired order, append / move / update
    // diffing loop
    for (let i = 0; i < current.length; i++) {
        const b = current[i];
        const key = b.t;
        let tr = rowMap.get(key);
        const mode = getMode(b.t);
        const label = modeLabel(mode);
        if (!tr) {
            tr = document.createElement('tr');
            tr.setAttribute('data-tag', b.t);
            tr.className = `row-mode-${mode}`;
            tr.setAttribute('aria-label', `Bang !${b.t} (${modeLabel(mode)})`);
            const tdTag = document.createElement('td');
            tdTag.style.width = '20%';
            const spanTag = document.createElement('span');
            spanTag.className = 'tag';
            spanTag.textContent = '!' + b.t;
            tdTag.appendChild(spanTag);

            const tdDesc = document.createElement('td');
            tdDesc.textContent = b.s;
            tdDesc.style.wordWrap = 'break-word';
            tdDesc.style.wordBreak = 'break-word';
            tdDesc.style.maxWidth = '200px';
            tdDesc.style.whiteSpace = 'normal';

            const tdAction = document.createElement('td');
            tdAction.style.width = '40%';
            tdAction.style.minWidth = '80px';
            tdAction.style.textAlign = 'right';
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline mode-cycle';
            btn.dataset.action = 'cycle';
            btn.dataset.mode = mode;
            btn.setAttribute('aria-pressed', String(mode !== 'none'));
            btn.textContent = label;
            tdAction.appendChild(btn);

            tr.appendChild(tdTag);
            tr.appendChild(tdDesc);
            tr.appendChild(tdAction);
            rowMap.set(key, tr);
            attachRow(tr);
        } else {
            // Update existing row if needed
            updateRow(tr);
        }

        // Maintain order: if tr not at correct position, insert before the node that should follow
        const expectedNext = tbody.children[i];
        if (expectedNext !== tr) {
            tbody.insertBefore(tr, expectedNext || null);
        }
    }
}

function updateRow(tr: HTMLTableRowElement) {
    const tag = tr.getAttribute('data-tag')!;
    const mode = getMode(tag);
    const btn = tr.querySelector('button.mode-cycle') as HTMLButtonElement | null;
    if (btn) { btn.textContent = modeLabel(mode); btn.dataset.mode = mode; btn.setAttribute('aria-pressed', String(mode !== 'none')); }
    tr.className = `row-mode-${mode}`;
}

function attachRow(tr: HTMLTableRowElement) {
    const btn = tr.querySelector('button.mode-cycle') as HTMLButtonElement;
    btn.addEventListener('click', e => {
        e.stopPropagation();
        const tag = tr.getAttribute('data-tag')!;
        const currentMode = getMode(tag);
        const next = cycleMode(currentMode);
        announcedSetMode(tag, next);
        updateRow(tr);
        renderBlocked();
    });
}

function applyFilter() {
    if (!allBangs) return;
    const term = filterInput.value.trim();
    current = term ? fuse!.search(term).map(r => r.item) : allBangs.slice();
    renderTable();
}

// Clear custom validity when user edits the field (only register once)
let _bangValidityInit = false;
function ensureBangValidityHandler() {
    if (_bangValidityInit) return;
    _bangValidityInit = true;
    bangInput.addEventListener('input', () => { bangInput.setCustomValidity(''); });
}
ensureBangValidityHandler();

addForm.addEventListener('submit', async e => {
    e.preventDefault();
    const tag = bangInput.value.trim().replace(/^!/, '').toLowerCase();
    if (!tag) return;
    await ensureLoaded();
    if (!allBangs!.some(b => b.t.toLowerCase() === tag)) { bangInput.setCustomValidity('Unknown bang tag'); bangInput.reportValidity(); return; }
    announcedSetMode(tag, 'both');
    bangInput.value = '';
    renderBlocked();
    const row = resultsDiv.querySelector(`tr[data-tag="${tag}"]`); if (row) updateRow(row as HTMLTableRowElement);
});

// Add focus handler for bang input like search page
bangInput.addEventListener('focus', () => {
    bangInput.select(); // Select all text when input is focused
});

let filterDebounce: ReturnType<typeof setTimeout>;
filterInput.addEventListener('input', () => {
    clearTimeout(filterDebounce);
    filterDebounce = setTimeout(() => applyFilter(), 50);
});

// Simple focus handler without any DOM manipulation
filterInput.addEventListener('focus', () => {
    filterInput.select(); // Select all text when input is focused
});

renderBlocked();

// Legend popup logic (deferred until after initial render)
const legendBtn = document.getElementById('legend-btn');
const legendPop = document.getElementById('legend-pop');
const legendClose = document.getElementById('legend-close');
if (legendBtn && legendPop) {
    let lastFocus: HTMLElement | null = null;
    const hide = () => { legendPop!.style.display = 'none'; legendBtn!.setAttribute('aria-expanded', 'false'); (lastFocus ?? legendBtn as HTMLElement).focus(); };
    const show = () => { legendPop!.style.display = 'block'; legendBtn!.setAttribute('aria-expanded', 'true'); position(); lastFocus = document.activeElement as HTMLElement; (legendPop as HTMLElement).focus(); };
    const toggle = () => { legendPop!.style.display === 'none' ? show() : hide(); };
    const position = () => {
        const rect = legendBtn!.getBoundingClientRect();
        legendPop!.style.top = (window.scrollY + rect.bottom + 4) + 'px';
        legendPop!.style.left = (window.scrollX + rect.left) + 'px';
    };
    legendBtn.addEventListener('click', e => { e.stopPropagation(); toggle(); });
    legendClose?.addEventListener('click', () => hide());
    legendPop!.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Escape') { e.stopPropagation(); hide(); } });
    document.addEventListener('click', (e) => { 
        const target = e.target as Node;
        // Don't hide if clicking on legend popup, legend button, or input fields
        if (!legendPop!.contains(target) && target !== legendBtn && target !== bangInput && target !== filterInput) {
            hide(); 
        }
    });
    window.addEventListener('resize', () => { if (legendPop!.style.display !== 'none') position(); });
    window.addEventListener('scroll', () => { if (legendPop!.style.display !== 'none') position(); });
}

(function scheduleAutoLoad() {
    const start = () => { if (!allBangs) ensureLoaded(); };
    if ('requestIdleCallback' in window) { (window as any).requestIdleCallback(start, { timeout: 1500 }); } else { setTimeout(start, 150); }
})();

// DEBUG instrumentation - simplified
console.log('[blocklist] script loaded');
window.addEventListener('error', e => console.error('[blocklist] window error', e.error || e.message));
window.addEventListener('unhandledrejection', e => console.error('[blocklist] unhandled rejection', e.reason));
