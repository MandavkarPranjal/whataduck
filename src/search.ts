import { bangs } from "./bang";
import "./global.css";

/**
 * Computes a normal match score for the given query against the provided text,
 * using a case-insensitive search. The score is based on the position where
 * the query appears in the text:
 * - Returns 0 if the query is not found.
 * - Returns 100 if the text starts with the query.
 * - Otherwise, returns a value based on 100 minus the index of the match.
 *
 * @param query - The search query.
 * @param text - The text to search in.
 * @returns A number representing how well the text matches the query.
 */
function computeNormalScore(query: string, text: string): number {
    const lowerQuery = query.toLowerCase();
    const lowerText = text.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) return 0;
    return idx === 0 ? 100 : Math.max(1, 100 - idx);
}

/**
 * Computes an extra bonus score for an exact, case-sensitive match.
 * If the text exactly equals the query (case-sensitive), returns 1000; otherwise, returns 0.
 *
 * @param query - The search query.
 * @param text - The text to check.
 * @returns 1000 if there's an exact match (case-sensitive), else 0.
 */
function computeExactBonus(query: string, text: string): number {
    return text === query ? 1000 : 0;
}

/**
 * Performs a hard string search for bangs.
 * It calculates scores for both the bang identifier ("t") and name ("s") using a normal,
 * case-insensitive search. Additionally, if either field exactly equals the query (case-sensitive),
 * a bonus is added to ensure that result appears first.
 * The bang identifier is given a higher weight.
 *
 * @param query - The search query input by the user.
 * @returns An array of bang entries sorted by relevance.
 */
const searchCache = new Map();

function searchBangs(query: string) {
    // Check cache first
    const cached = searchCache.get(query);
    if (cached) return cached;

    const identifierWeight = 2;
    const results = bangs.map((bang) => {
        const scoreT = computeNormalScore(query, bang.t);
        const scoreS = computeNormalScore(query, bang.s);
        const bonusT = computeExactBonus(query, bang.t);
        const bonusS = computeExactBonus(query, bang.s);
        const totalScore = identifierWeight * (scoreT + bonusT) + (scoreS + bonusS);
        return { bang, score: totalScore };
    });

    const filteredResults = results
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.bang);
    
    // Cache results
    searchCache.set(query, filteredResults);
    return filteredResults;
}

/**
 * Creates and renders a hard string search page.
 * The search first gives priority to a result that exactly (case-sensitively)
 * matches the query (if any), with all other results following in decreasing order
 * based on a less case-sensitive (normal) search.
 */
function createHardSearchPage(): void {
    // Set the innerHTML of the document body with a fixed header containing the search input,
    // a scrollable results container, and a footer with enhanced visibility.
    // The header now displays the total number of bangs with additional text.
    document.body.innerHTML = `
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

    const input = document.getElementById("search-input") as HTMLInputElement;
    const resultsContainer = document.getElementById("results-container") as HTMLDivElement;

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
    input.addEventListener("input", () => {
        const query = input.value.trim();
        if (query === "") {
            displayFullList();
        } else {
            const results = searchBangs(query);
            displayResults(results);
        }
    });

    // Initially show the full list.
    displayFullList();
}

// Initialize the search page after the DOM loads.
document.addEventListener("DOMContentLoaded", createHardSearchPage);
