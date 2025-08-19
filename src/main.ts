import { bangs } from "./bang";
import "./global.css";

function noSearchDefaultPageRender() {
    const app = document.querySelector<HTMLDivElement>("#app")!;

    // Get current default bang from localStorage
    const defaultBangFromStorage = localStorage.getItem("default-bang") ?? "ddg";
    const defaultUrl = `https://whataduck.vercel.app?d=${defaultBangFromStorage}&q=%s`;

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
      </div>
      <div style="margin-top:12px;font-size:14px;"><a href="/blocklist" style="text-decoration:none;color:#555;">Manage blocked bangs</a></div>
      <footer class=\"footer\">
        <a href="https://x.com/__pr4njal" target="_blank">pranjal</a>
        •
        <a href="https://github.com/MandavkarPranjal/whataduck" target="_blank">github</a>
      </footer>
    </div>
  `;

    const copyButton = app.querySelector<HTMLButtonElement>(".copy-button")!;
    const copyIcon = copyButton.querySelector("img")!;
    const urlInput = app.querySelector<HTMLInputElement>(".url-input")!;
    const defaultBangSelect = app.querySelector<HTMLSelectElement>("#default-bang-select")!;

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
}

interface RedirectResult { url: string | null; blocked?: { tag: string; url: string | null; reason: string }; }

function loadBlockedBangTags(): Set<string> { try { const raw = localStorage.getItem('blocked-bangs'); if (!raw) return new Set(); const arr = JSON.parse(raw); return new Set(Array.isArray(arr) ? arr.map((s: any) => String(s).toLowerCase()) : []); } catch { return new Set(); } }

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
    if (defaultBangParam && defaultBangParam !== localStorage.getItem("default-bang")) {
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

    // Load blocked set once
    const blocked = loadBlockedBangTags();

    // Detect single bang only (no trailing search terms after removing it)
    const isSingleBangOnly = !cleanQuery && (prefixMatch || suffixMatch);
    const override = url.searchParams.get('override') === '1';

    if (isSingleBangOnly && selectedBang && blocked.has(selectedBang.t.toLowerCase()) && !override) {
        return { url: null, blocked: { tag: selectedBang.t, url: null, reason: 'Blocked by user' } };
    }

    // If the query is empty after removing bang, redirect to home page of selected engine
    if (cleanQuery === "") {
        return { url: selectedBang ? `https://${selectedBang.d}` : null };
    }

    // Format of the url is:
    // https://www.google.com/search?q={{{s}}}
    const searchUrl = selectedBang?.u.replace(
        "{{{s}}}",
        // Replace %2F with / to fix formats like "!ghr+mandavkarpranjal/whataduck"
        encodeURIComponent(cleanQuery).replace(/%2F/g, "/")
    );
    if (!searchUrl) return { url: null };

    if (selectedBang && blocked.has(selectedBang.t.toLowerCase()) && !override) {
        return { url: null, blocked: { tag: selectedBang.t, url: searchUrl, reason: 'Blocked by user' } };
    }

    return { url: searchUrl };
}

function showBlockedScreen(block: { tag: string; url: string | null; reason: string }) {
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
          <p id="blocked-desc" class="blocked-desc">Bang <code class="blocked-code">!${block.tag}</code> was prevented from redirecting.</p>
          <div class="blocked-actions">
            <button id="override-btn" class="blocked-btn blocked-btn-primary" data-target="${overrideTarget ?? ''}" ${overrideTarget ? '' : 'disabled aria-disabled="true"'}>Override once</button>
            <a href="/blocklist" class="blocked-btn blocked-btn-secondary" id="manage-blocklist-btn">Manage blocklist</a>
            <a href="/" class="blocked-home-link">← Home</a>
          </div>
        </div>
      </div>`;

    // Focus management
    const manageBtn = document.getElementById('manage-blocklist-btn') as HTMLAnchorElement | null;
    if (manageBtn) setTimeout(() => manageBtn.focus(), 0);

    const overrideBtn = document.getElementById('override-btn') as HTMLButtonElement | null;
    if (overrideBtn) {
        overrideBtn.addEventListener('click', () => {
            const target = overrideBtn.getAttribute('data-target');
            if (target) {
                const loc = new URL(window.location.href);
                loc.searchParams.set('override', '1');
                window.location.replace(target);
            }
        });
    }
}

function doRedirect() {
    const result = getBangredirectUrl();
    if (!result) return; // no query case already handled
    if (result.blocked) { showBlockedScreen(result.blocked); return; }
    if (result.url) window.location.replace(result.url);
}

doRedirect();
