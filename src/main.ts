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
      <footer class="footer">
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

function getBangredirectUrl() {
    const url = new URL(window.location.href);
    const query = url.searchParams.get("q")?.trim() ?? "";
    const defaultBangParam = url.searchParams.get("d")?.trim();

    if (!query) {
        noSearchDefaultPageRender();
        return null;
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

    // If the query is empty bang, redirect to home page instead of search page
    if (cleanQuery === "")
        return selectedBang ? `https://${selectedBang.d}` : null;

    // Format of the url is:
    // https://www.google.com/search?q={{{s}}}
    const searchUrl = selectedBang?.u.replace(
        "{{{s}}}",
        // Replace %2F with / to fix formats like "!ghr+mandavkarpranjal/whataduck"
        encodeURIComponent(cleanQuery).replace(/%2F/g, "/")
    );
    if (!searchUrl) return null;

    return searchUrl;
}

function doRedirect() {
    const searchUrl = getBangredirectUrl();
    if (!searchUrl) return;
    window.location.replace(searchUrl);
}

doRedirect();
