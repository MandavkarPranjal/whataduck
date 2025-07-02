import { bangs } from "./bang";
import "./global.css";

function noSearchDefaultPageRender() {
    const app = document.querySelector<HTMLDivElement>("#app")!;
    app.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;">
      <div class="content-container">
        <h1>What a Duck!</h1>
        <p>DuckDuckGo's bang redirects can be slow and don't support AI chat bots. For the best experience, add the following URL as a custom search engine in your browser to enable <a href="/search" target="_blank">all of these bangs</a>.</p>
        <div class="url-container">
          <input
            type="text"
            class="url-input"
            value="https://whataduck.vercel.app?q=%s"
            readonly
          />
          <button class="copy-button">
            <img src="/clipboard.svg" alt="Copy" />
          </button>
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

    copyButton.addEventListener("click", async () => {
        await navigator.clipboard.writeText(urlInput.value);
        copyIcon.src = "/clipboard-check.svg";

        setTimeout(() => {
            copyIcon.src = "/clipboard.svg";
        }, 2000);
    });
}

const LS_DEFAULT_BANG = localStorage.getItem("default-bang") ?? "ddg";
const defaultBang = bangs.find((b) => b.t === LS_DEFAULT_BANG);

function getBangredirectUrl() {
    const url = new URL(window.location.href);
    const query = url.searchParams.get("q")?.trim() ?? "";
    if (!query) {
        noSearchDefaultPageRender();
        return null;
    }

    // match both !bang and bang!
    const prefixMatch = query.match(/!(\S+)/i);
    const suffixMatch = query.match(/(\S+)!/);

    const bangCandidate = (prefixMatch?.[1] ?? suffixMatch?.[1])?.toLowerCase();
    const selectedBang = bangs.find((b) => b.t === bangCandidate) ?? defaultBang;

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
