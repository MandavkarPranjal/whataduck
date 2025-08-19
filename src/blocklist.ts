import './global.css';
import Fuse from 'fuse.js';

interface Bang { t: string; s: string; d: string; r: number; u: string; c?: string; sc?: string; }
interface ModesMap { [tag: string]: { root?: boolean; search?: boolean }; }

const LEGACY_KEY = 'blocked-bangs'; // represents Both (root+search)
const MODES_KEY = 'blocked-bangs-modes'; // partial modes for tags not in legacy

function loadLegacy(): Set<string> {
  try { const raw = localStorage.getItem(LEGACY_KEY); if(!raw) return new Set(); const arr = JSON.parse(raw); if(Array.isArray(arr)) return new Set(arr.map(s=>String(s).toLowerCase())); } catch{}; return new Set(); }
function saveLegacy(set: Set<string>){ localStorage.setItem(LEGACY_KEY, JSON.stringify([...set])); }
function loadModes(): ModesMap { try { const raw = localStorage.getItem(MODES_KEY); if(!raw) return {}; const obj = JSON.parse(raw); if(obj && typeof obj==='object' && !Array.isArray(obj)) return obj; } catch{}; return {}; }
function saveModes(m: ModesMap){ localStorage.setItem(MODES_KEY, JSON.stringify(m)); }

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
let loading = false;

function ensureLoaded(): Promise<void> {
  if (allBangs) return Promise.resolve();
  if (loading) return new Promise(res=>{ const iv=setInterval(()=>{ if(!loading){ clearInterval(iv); res(); } },30); });
  loading = true;
  resultsDiv.innerHTML = '<div style="padding:16px; text-align:center; font-size:14px;">Loading bang list…</div>';
  return import('./bang').then(mod => {
    allBangs = mod.bangs.map(b=>({...b,c:(b as any).c??'',sc:(b as any).sc??''}));
    fuse = new Fuse(allBangs, { keys:[{name:'t',weight:0.7},{name:'s',weight:0.3}], threshold:0.4 });
    totalCountSpan.textContent = String(allBangs.length);
    filterInput.disabled = false;
    filterInput.placeholder = 'Search bangs to block';
    current = allBangs.slice();
    renderTable();
  }).finally(()=>{ loading=false; });
}

// Helpers for mode
function getMode(tag: string): 'none'|'both'|'root'|'search' {
  tag = tag.toLowerCase();
  if (legacy.has(tag)) return 'both';
  const m = modes[tag];
  if (m?.root && m?.search) return 'both'; // collapse to legacy conceptually
  if (m?.root) return 'root';
  if (m?.search) return 'search';
  return 'none';
}
function setMode(tag: string, mode: 'none'|'both'|'root'|'search') {
  tag = tag.toLowerCase();
  if (mode === 'both') { legacy.add(tag); delete modes[tag]; }
  else if (mode === 'none') { legacy.delete(tag); delete modes[tag]; }
  else { legacy.delete(tag); modes[tag] = { root: mode==='root', search: mode==='search' }; }
  saveLegacy(legacy); saveModes(modes);
}
function cycleMode(current: 'none'|'both'|'root'|'search'): 'both'|'root'|'search'|'none' {
  if (current==='none') return 'both';
  if (current==='both') return 'root';
  if (current==='root') return 'search';
  return 'none';
}

function modeLabel(mode: string): string {
  if (mode==='none') return 'Block';
  if (mode==='both') return 'Both';
  if (mode==='root') return 'Root';
  if (mode==='search') return 'Search';
  return 'Block';
}
function modeSuffix(mode: string): string {
  if (mode==='both') return ' (Both)';
  if (mode==='root') return ' (Root)';
  if (mode==='search') return ' (Search)';
  return '';
}

// aria-live region for status updates
let live = document.getElementById('live-region');
if(!live){
  live = document.createElement('div');
  live.id='live-region';
  live.setAttribute('aria-live','polite');
  live.setAttribute('aria-atomic','true');
  live.style.position='absolute';
  live.style.width='1px';
  live.style.height='1px';
  live.style.margin='-1px';
  live.style.border='0';
  live.style.padding='0';
  live.style.clip='rect(0 0 0 0)';
  live.style.overflow='hidden';
  document.body.appendChild(live);
}
function announce(msg:string){ if(live) live.textContent = msg; }

function announcedSetMode(tag:string, mode: 'none'|'both'|'root'|'search'){
  setMode(tag, mode);
  const human = mode==='none'? 'unblocked' : (mode==='both'?'blocked for root and search': mode==='root'?'blocked for root only':'blocked for search only');
  announce(`Bang !${tag} ${human}.`);
}

function renderBlocked(){
  const entries: { tag:string; mode:'both'|'root'|'search' }[] = [];
  // legacy implies both
  legacy.forEach(t => entries.push({ tag:t, mode:'both'}));
  for (const k in modes) {
    const m = modes[k];
    if (legacy.has(k)) continue; // legacy wins
    if (m.root && m.search) { // normalize to both -> move into legacy for cleanliness
      legacy.add(k); delete modes[k]; saveLegacy(legacy); saveModes(modes); entries.push({ tag:k, mode:'both'}); continue;
    }
    if (m.root) entries.push({ tag:k, mode:'root'});
    else if (m.search) entries.push({ tag:k, mode:'search'});
  }
  if (entries.length===0){
    blockedChips.innerHTML='';
    blockedEmpty.style.display='block';
    blockedEmpty.textContent='No blocked bangs yet';
    return;
  }
  blockedEmpty.style.display='none';
  blockedChips.innerHTML = entries.sort((a,b)=>a.tag.localeCompare(b.tag)).map(e =>
    `<span class="chip" data-chip="${e.tag}"><code>!${e.tag}</code><span style="font-size:11px;color:#666;">${modeSuffix(e.mode).trim()}</span><button aria-label="Unblock ${e.tag}" data-remove="${e.tag}">×</button></span>`
  ).join('');
  blockedChips.querySelectorAll('button[data-remove]').forEach(btn => {
    btn.addEventListener('click', ev => {
      ev.stopPropagation();
      const t = (ev.currentTarget as HTMLElement).getAttribute('data-remove')!;
       announcedSetMode(t,'none');
       renderBlocked();
       const row = resultsDiv.querySelector(`tr[data-tag="${t}"]`);
       if (row) updateRow(row as HTMLTableRowElement);
    });
  });
}

function rowHtml(b: Bang): string {
  const mode = getMode(b.t);
  const label = modeLabel(mode);
  return `<tr data-tag="${b.t}" class="row-mode-${mode}" aria-label="Bang !${b.t} (${modeLabel(mode)})">
    <td style="width:20%;"><span class="tag">!${b.t}</span></td>
    <td>${b.s}</td>
    <td style="width:40%; text-align:right;">
      <button class="btn btn-outline mode-cycle" data-action="cycle" aria-pressed="${mode!=='none'}" data-mode="${mode}">${label}</button>
    </td>
  </tr>`;
}

function renderTable(){
  if(!allBangs) return;
  resultsDiv.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:14px;"><tbody></tbody></table>';
  const tbody = resultsDiv.querySelector('tbody')!;
  tbody.innerHTML = current.map(b=>rowHtml(b)).join('');
  tbody.querySelectorAll('tr').forEach(tr => attachRow(tr as HTMLTableRowElement));
}

function updateRow(tr: HTMLTableRowElement){
  const tag = tr.getAttribute('data-tag')!;
  const mode = getMode(tag);
  const btn = tr.querySelector('button.mode-cycle') as HTMLButtonElement | null;
  if (btn){ btn.textContent = modeLabel(mode); btn.dataset.mode = mode; btn.setAttribute('aria-pressed', String(mode!=='none')); }
  tr.className = `row-mode-${mode}`;
}

function attachRow(tr: HTMLTableRowElement){
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

function applyFilter(){
  if(!allBangs) return;
  const term = filterInput.value.trim();
  current = term ? fuse!.search(term).map(r=>r.item) : allBangs.slice();
  renderTable();
}

addForm.addEventListener('submit', async e => {
  e.preventDefault();
  const tag = bangInput.value.trim().replace(/^!/, '').toLowerCase();
  if(!tag) return;
  await ensureLoaded();
  if(!allBangs!.some(b=>b.t.toLowerCase()===tag)) { bangInput.setCustomValidity('Unknown bang tag'); bangInput.reportValidity(); setTimeout(()=>bangInput.setCustomValidity(''),1500); return; }
  announcedSetMode(tag,'both');
  bangInput.value='';
  renderBlocked();
  const row = resultsDiv.querySelector(`tr[data-tag="${tag}"]`); if (row) updateRow(row as HTMLTableRowElement);
});

filterInput.addEventListener('input', applyFilter);
['focus','keydown','click'].forEach(ev => { filterInput.addEventListener(ev, async ()=>{ if(!allBangs) await ensureLoaded(); }); });

renderBlocked();

// Legend popup logic (deferred until after initial render)
const legendBtn = document.getElementById('legend-btn');
const legendPop = document.getElementById('legend-pop');
const legendClose = document.getElementById('legend-close');
if(legendBtn && legendPop){
  const hide = () => { legendPop!.style.display='none'; legendBtn!.setAttribute('aria-expanded','false'); };
  const show = () => { legendPop!.style.display='block'; legendBtn!.setAttribute('aria-expanded','true'); position(); };
  const toggle = () => { legendPop!.style.display==='none'?show():hide(); };
  const position = () => {
    const rect = legendBtn!.getBoundingClientRect();
    legendPop!.style.top = (window.scrollY + rect.bottom + 4) + 'px';
    legendPop!.style.left = (window.scrollX + rect.left) + 'px';
  };
  legendBtn.addEventListener('click', e => { e.stopPropagation(); toggle(); });
  legendClose?.addEventListener('click', () => hide());
  document.addEventListener('click', (e) => { if(!legendPop!.contains(e.target as Node) && e.target!==legendBtn) hide(); });
  window.addEventListener('resize', () => { if(legendPop!.style.display!=='none') position(); });
  window.addEventListener('scroll', () => { if(legendPop!.style.display!=='none') position(); });
}

(function scheduleAutoLoad(){
  const start = () => { if(!allBangs) ensureLoaded(); };
  if('requestIdleCallback' in window){ (window as any).requestIdleCallback(start,{ timeout:1500 }); } else { setTimeout(start,150); }
})();
