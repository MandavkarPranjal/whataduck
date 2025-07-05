import { bangs, Bang } from "./bang";
import "./global.css";
import Fuse from "fuse.js";

// Initialize Fuse.js for fuzzy searching
const normalizedBangs: Bang[] = bangs.map(bang => ({
  c: (bang as any).c ?? "",
  d: bang.d,
  r: bang.r,
  s: bang.s,
  sc: (bang as any).sc ?? "",
  t: bang.t,
  u: bang.u
}));

const fuse = new Fuse<Bang>(normalizedBangs, {
  keys: [
    { name: 't', weight: 0.7 },
    { name: 's', weight: 0.3 }
  ],
  threshold: 0.4
});
/**
 * Uses Fuse.js to perform fuzzy search on bangs.
 * @param query - The search query input by the user.
 * @returns An array of bang entries sorted by relevance.
 */
function searchBangs(query: string): Bang[] {
    if (!query) {
        // Ensure all objects have required properties with default values
        return bangs.map(bang => ({
            c: (bang as any).c ?? "",
            d: bang.d,
            r: bang.r,
            s: bang.s,
            sc: (bang as any).sc ?? "",
            t: bang.t,
            u: bang.u
        }));
    }
    const results = fuse.search(query);
    return results.map(result => result.item);
}
    // Return full list when query is empty

/**
 * Creates and renders a hard string search page.
 * The search first gives priority to a result that exactly (case-sensitively)
 * matches the query (if any), with all other results following in decreasing order
 * based on a less case-sensitive (normal) search.
 */
function createHardSearchPage(): void {
    // Render the search UI inside the #app container to leverage global styles
    const app = document.querySelector<HTMLDivElement>("#app")!;
    // Set the innerHTML of the app container with a fixed header containing the search input,
    // a scrollable results container, and a footer with enhanced visibility.
    app.innerHTML = `
    <div style="display: flex; flex-direction: column; min-height: 100vh; margin: 0; font-family: sans-serif; align-items: center; justify-content: space-between;">
      <div style="text-align: center; width: 100%; max-width: 600px; padding: 20px 0; display: flex; flex-direction: column; justify-content: center; flex-grow: 1;">
        <h2 style="margin-bottom: 20px;">${bangs.length} bangs and counting</h2>
        <input id="search-input" type="text" placeholder="Search bangs"
          style="width:100%; padding:10px; font-size:16px; box-sizing:border-box; margin-bottom:20px;" />
        <div id="results-container" style="width: 100%; flex: 1; overflow-y: auto; padding: 0 20px; box-sizing: border-box;">
        </div>
      </div>
      <footer class="footer">
        <a href="https://x.com/__pr4njal" target="_blank">pranjal</a>
        •
        <a href="https://github.com/MandavkarPranjal/whataduck" target="_blank">github</a>
      </footer>
    </div>
  `;

    // Scope element queries within the app container
    const input = app.querySelector<HTMLInputElement>("#search-input")!;
    const resultsContainer = app.querySelector<HTMLDivElement>("#results-container")!;

    /**
     * Renders the provided array of bang entries.
     *
     * @param results - An array of bang entries to display.
     */
    function displayResults(results: typeof bangs): void {
        if (results.length === 0) {
            resultsContainer.innerHTML = "No results found.";
            return;
        }
        // Removed text-align from the ul to allow li items to span full width.
        let listHtml = '<ul style="list-style:none;padding:0;margin:0;width:100%;">';
        results.forEach(bang => {
            listHtml += `<li style="padding:8px;border-bottom:1px solid #eee; text-align: center">` +
                `<strong>${bang.s}</strong> - <em>!${bang.t}</em></li>`;
        });
        listHtml += "</ul>";
        resultsContainer.innerHTML = listHtml;
    }

    /**
     * Displays the full list of bangs.
     */
    function displayFullList(): void {
        displayResults(bangs);
    }

    // Listen for input changes to update the search results.
    // Use debouncing to prevent lag during typing
    let debounceTimer: number;
    input.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = input.value.trim();
            if (query === "") {
                displayFullList();
            } else {
                const results = searchBangs(query);
                displayResults(results);
            }
        }, 150); // 150ms delay to debounce input
    });

    // Initially show the full list.
    // Add a focus event to the input element for better UX
    input.addEventListener("focus", () => {
        input.select(); // Select all text when input is focused
    });
    
    displayFullList();
}

// Initialize the search page after the DOM loads.
document.addEventListener("DOMContentLoaded", createHardSearchPage);
