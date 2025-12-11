import { bangs } from "./bang";
import "./global.css";

function noSearchDefaultPageRender() {
    const app = document.querySelector<HTMLDivElement>("#app")!;

    // Get current default bang from localStorage
    const storedDefault = localStorage.getItem("default-bang");
    const defaultBangFromStorage = bangs.some(b => b.t === storedDefault) ? (storedDefault as string) : "ddg";
    const defaultUrl = `${window.location.origin}?d=${defaultBangFromStorage}&q=%s`;

    app.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;">
      <div class="content-container">
        <h1>What a Duck!</h1>
        <p>DuckDuckGo's bang redirects can be slow and don't support AI chat bots. For the best experience, add the following URL as a custom search engine in your browser to enable <a href="/search" target="_blank">all of these bangs</a>.</p>

        <div class="url-container">
          <input
            type="text"
            class="url-input"
            value="${defaultUrl}"
            readonly
          />
          <button class="copy-button">
            <img src="/clipboard.svg" alt="Copy" />
          </button>
        </div>

        <div style="margin-top: 20px;">
          <label for="default-bang-select" style="display: block; margin-bottom: 8px; font-weight: 500;">Choose your default search engine:</label>
          <select id="default-bang-select" style="padding: 8px; margin-bottom: 12px; border-radius: 4px; border: 1px solid #ccc; min-width: 200px;">
          </select>
        </div>
      <div style="margin-top:12px;font-size:14px;"><a href="/blocklist" style="text-decoration:none;color:#555;">Manage blocked bangs</a></div>

        <div class="suggestions-container">
          <p style="font-size: 14px; color: #999; margin-bottom: 12px;">For autocomplete suggestions, add this URL:</p>
          <div class="url-container">
            <input
              type="text"
              class="url-input suggestions-input"
              value="https://www.google.com/complete/search?client=chrome&q=%s"
              readonly
            />
            <button class="copy-button suggestions-copy">
              <img src="/clipboard.svg" alt="Copy" />
            </button>
          </div>
          <div style="margin-top: 8px;">
            <select id="suggestions-select" style="padding: 6px; border-radius: 4px; border: 1px solid #3d3d3d; background-color: #191919; color: #fff; font-size: 14px;">
              <option value="chrome">Chrome (recommended)</option>
              <option value="firefox">Firefox</option>
            </select>
          </div>
        </div>
      </div>
      <footer class=\"footer\">
        <a href="https://x.com/pr5dev" target="_blank">pranjal</a>
        •
        <a href="https://github.com/MandavkarPranjal/whataduck" target="_blank">github</a>
      </footer>
    </div>
  `;

    const copyButton = app.querySelector<HTMLButtonElement>(".copy-button")!;
    const copyIcon = copyButton.querySelector("img")!;
    const urlInput = app.querySelector<HTMLInputElement>(".url-input")!;
    const defaultBangSelect = app.querySelector<HTMLSelectElement>("#default-bang-select")!;
    const suggestionsCopy = app.querySelector<HTMLButtonElement>(".suggestions-copy")!;
    const suggestionsIcon = suggestionsCopy.querySelector("img")!;
    const suggestionsInput = app.querySelector<HTMLInputElement>(".suggestions-input")!;
    const suggestionsSelect = app.querySelector<HTMLSelectElement>("#suggestions-select")!;

    // Populate the default bang selector
    const popularBangs = [
        { t: "gai", s: "Google" },
        { t: "ddg", s: "DuckDuckGo" },
        { t: "cgpt", s: "ChatGPT" },
        { t: "x", s: "x(formerly twitter)" },
        { t: "r", s: "reddit" },
        { t: "grok", s: "Grok" },
        { t: "yt", s: "YouTube" },
        { t: "gh", s: "GitHub" },
        { t: "y", s: "Yahoo" },
        { t: "b", s: "Bing" },
        { t: "w", s: "Wikipedia" },
        { t: "a", s: "Amazon" },
    ];

    // Add popular bangs first, then check if current default is in the list
    const currentSelectedBang = localStorage.getItem("default-bang") ?? "ddg";
    const currentBangObj = bangs.find(b => b.t === currentSelectedBang);

    let selectOptions = "";
    popularBangs.forEach(bang => {
        const bangDetails = bangs.find(b => b.t === bang.t);
        if (bangDetails) {
            const selected = bang.t === currentSelectedBang ? " selected" : "";
            selectOptions += `<option value="${bang.t}"${selected}>${bang.s} (!${bang.t})</option>`;
        }
    });

    // If current default is not in popular list, add it
    if (currentBangObj && !popularBangs.find(pb => pb.t === currentSelectedBang)) {
        selectOptions += `<option value="${currentSelectedBang}" selected>${currentBangObj.s} (!${currentSelectedBang})</option>`;
    }

    defaultBangSelect.innerHTML = selectOptions;

    // Update URL when selection changes
    defaultBangSelect.addEventListener("change", () => {
        const selectedBang = defaultBangSelect.value;
        localStorage.setItem("default-bang", selectedBang);
        urlInput.value = `https://whataduck.vercel.app?d=${selectedBang}&q=%s`;
    });

    copyButton.addEventListener("click", async () => {
        await navigator.clipboard.writeText(urlInput.value);
        copyIcon.src = "/clipboard-check.svg";

        setTimeout(() => {
            copyIcon.src = "/clipboard.svg";
        }, 2000);
    });

    // Update suggestions URL when selection changes
    suggestionsSelect.addEventListener("change", () => {
        const client = suggestionsSelect.value;
        suggestionsInput.value = `https://www.google.com/complete/search?client=${client}&q=%s`;
    });

    // Copy suggestions URL
    suggestionsCopy.addEventListener("click", async () => {
        await navigator.clipboard.writeText(suggestionsInput.value);
        suggestionsIcon.src = "/clipboard-check.svg";

        setTimeout(() => {
            suggestionsIcon.src = "/clipboard.svg";
        }, 2000);
    });
}

interface RedirectResult { url: string | null; blocked?: { tag: string; url: string | null; reason: string; mode: 'root' | 'search' }; }

// Legacy single list key - match blocklist.ts keys
function loadLegacyBlocked(): Set<string> { try { const raw = localStorage.getItem('whataduck:blocked-bangs:v1'); if (!raw) return new Set(); const arr = JSON.parse(raw); return new Set(Array.isArray(arr) ? arr.map((s: any) => String(s).toLowerCase()) : []); } catch { return new Set(); } }

interface BlockModes { [tag: string]: { root?: boolean; search?: boolean }; }
const MODES_KEY = 'whataduck:blocked-bangs-modes:v1';
function loadBlockModes(): BlockModes {
    try {
        const raw = localStorage.getItem(MODES_KEY);
        if (!raw) return {};
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj as BlockModes;
        return {};
    } catch { return {}; }
}

function computeBlockSets() {
    const legacy = loadLegacyBlocked();
    const modes = loadBlockModes();
    const root = new Set<string>();
    const search = new Set<string>();
    // Modes first
    for (const k in modes) {
        const low = k.toLowerCase();
        if (modes[k].root) root.add(low);
        if (modes[k].search) search.add(low);
    }
    // Legacy entries imply both if not already specified in modes
    legacy.forEach(tag => {
        if (!(tag in modes)) { root.add(tag); search.add(tag); }
    });
    return { root, search };
}

function getBangredirectUrl(): RedirectResult { // returns redirect info or blocked reason
    const url = new URL(window.location.href);
    const query = url.searchParams.get("q")?.trim() ?? "";
    const defaultBangParam = url.searchParams.get("d")?.trim();

    if (!query) { // no query => show landing
        noSearchDefaultPageRender();
        return { url: null };
    }

    // Use URL parameter for default bang if provided, otherwise fall back to localStorage
    let defaultBangTag = defaultBangParam || localStorage.getItem("default-bang") || "ddg";

    // Store the default bang in localStorage if it came from URL parameter
    if (
        defaultBangParam &&
        bangs.some(b => b.t === defaultBangParam) &&
        defaultBangParam !== localStorage.getItem("default-bang")
    ) {
        localStorage.setItem("default-bang", defaultBangParam);
    }

    const defaultBangObj = bangs.find((b) => b.t === defaultBangTag);

    // match both !bang and bang!
    const prefixMatch = query.match(/!(\S+)/i);
    const suffixMatch = query.match(/(\S+)!/);

    const bangCandidate = (prefixMatch?.[1] ?? suffixMatch?.[1])?.toLowerCase();
    const selectedBang = bangs.find((b) => b.t === bangCandidate) ?? defaultBangObj;

    // Remove the bang from either position
    const cleanQuery = query
        .replace(/!\S+\s*/i, "") // Remove prefix bang
        .replace(/\s*\S+!/, "") // Remove suffix bang
        .trim();

    // Load block sets once
    const { root: blockedRoot, search: blockedSearch } = computeBlockSets();

    // Detect single bang only (no trailing search terms after removing it)
    const isSingleBangOnly = !cleanQuery && (prefixMatch || suffixMatch);
    const override = url.searchParams.get('override') === '1';

    if (isSingleBangOnly && selectedBang) {
        const tag = selectedBang.t.toLowerCase();
        if (blockedRoot.has(tag) && !override) {
            return { url: null, blocked: { tag: selectedBang.t, url: null, reason: 'Root redirect blocked', mode: 'root' } };
        }
        // No search terms -> root redirect allowed
        return { url: selectedBang ? `https://${selectedBang.d}` : null };
    }

    // If we reach here we have search terms (or no bang found, fallback to default bang search)
    const searchUrl = selectedBang?.u.replace(
        "{{{s}}}",
        encodeURIComponent(cleanQuery).replace(/%2F/g, "/")
    );
    if (!searchUrl) return { url: null };

    if (selectedBang) {
        const tag = selectedBang.t.toLowerCase();
        if (blockedSearch.has(tag) && !override) {
            return { url: null, blocked: { tag: selectedBang.t, url: searchUrl, reason: 'Search redirect blocked', mode: 'search' } };
        }
    }

    return { url: searchUrl };
}

function showBlockedScreen(block: { tag: string; url: string | null; reason: string; mode: 'root' | 'search' }) {
    const app = document.querySelector<HTMLDivElement>('#app');
    if (!app) return;

    // Determine override target: if block.url present use it; else derive engine root
    let overrideTarget: string | null = block.url;
    if (!overrideTarget) {
        const engine = bangs.find(b => b.t.toLowerCase() === block.tag.toLowerCase());
        if (engine) {
            // Derive root: prefer domain field 'd' if present else parse from 'u'
            if (engine.d) overrideTarget = `https://${engine.d}`; else if (engine.u) {
                try {
                    const m = engine.u.match(/https?:\/\/[^/]+/);
                    if (m) overrideTarget = m[0];
                } catch { /* noop */ }
            }
        }
    }

    app.innerHTML = `
      <div class="blocked-shell">
        <div class="blocked-card" role="alert" aria-labelledby="blocked-title" aria-describedby="blocked-desc">
          <div class="blocked-icon" aria-hidden="true">⛔</div>
          <h1 id="blocked-title" class="blocked-title">This bang is blocked</h1>
          <p id="blocked-desc" class="blocked-desc">
            Bang <code class="blocked-code" id="blocked-tag"></code> <span id="blocked-mode"></span> was prevented.
          </p>
          <div class="blocked-actions">
            <button id="override-btn" class="blocked-btn blocked-btn-primary" disabled aria-disabled="true">Override once</button>
            <a href="/blocklist" class="blocked-btn blocked-btn-secondary" id="manage-blocklist-btn">Manage blocklist</a>
            <a href="/" class="blocked-home-link">← Home</a>
          </div>
        </div>
      </div>`;

    // Focus management
    const manageBtn = document.getElementById('manage-blocklist-btn') as HTMLAnchorElement | null;
    if (manageBtn) setTimeout(() => manageBtn.focus(), 0);

    // Populate dynamic text safely
    const tagCode = document.getElementById('blocked-tag');
    if (tagCode) tagCode.textContent = `!${block.tag}`;
    const modeSpan = document.getElementById('blocked-mode');
    if (modeSpan) modeSpan.textContent = block.mode === 'root' ? 'root redirect' : 'search redirect';

    // Wire override once
    const overrideBtn = document.getElementById('override-btn') as HTMLButtonElement | null;
    if (overrideBtn) {
        const safeTarget = overrideTarget && /^https?:\/\//i.test(overrideTarget) ? overrideTarget : null;
        if (safeTarget) {
            overrideBtn.removeAttribute('disabled');
            overrideBtn.setAttribute('aria-disabled', 'false');
            overrideBtn.dataset.target = safeTarget;
        }
        overrideBtn.addEventListener('click', () => {
            const target = overrideBtn.dataset.target;
            if (target) window.location.replace(target);
        });
    }
}

function doRedirect() {
    const result = getBangredirectUrl();
    if (result.blocked) { showBlockedScreen(result.blocked); return; }
    if (result.url) window.location.replace(result.url);
}

doRedirect();
