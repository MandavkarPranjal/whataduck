import { bangs } from "./bang";

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
function searchBangs(query: string) {
    const identifierWeight = 2;

    const results = bangs.map((bang) => {
        const scoreT = computeNormalScore(query, bang.t);
        const scoreS = computeNormalScore(query, bang.s);
        const bonusT = computeExactBonus(query, bang.t);
        const bonusS = computeExactBonus(query, bang.s);
        const totalScore = identifierWeight * (scoreT + bonusT) + (scoreS + bonusS);
        return { bang, score: totalScore };
    });

    return results
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.bang);
}

/**
 * Creates and renders a hard string search page.
 * The search first gives priority to a result that exactly (case-sensitively)
 * matches the query (if any), with all other results following in decreasing order
 * based on a less case-sensitive (normal) search.
 */
function createHardSearchPage(): void {
    // Create container element.
    const container = document.createElement("div");
    container.style.maxWidth = "600px";
    container.style.margin = "50px auto";
    container.style.fontFamily = "sans-serif";

    // Create search input element.
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Search bangs ";
    input.style.width = "100%";
    input.style.padding = "10px";
    input.style.fontSize = "16px";
    input.style.boxSizing = "border-box";
    input.style.marginBottom = "20px";
    container.appendChild(input);

    // Create results container.
    const resultsContainer = document.createElement("div");
    container.appendChild(resultsContainer);

    /**
     * Renders the provided array of bang entries.
     *
     * @param results - An array of bang entries to display.
     */
    function displayResults(results: typeof bangs): void {
        resultsContainer.innerHTML = "";
        if (results.length === 0) {
            resultsContainer.textContent = "No results found.";
            return;
        }
        const list = document.createElement("ul");
        list.style.listStyle = "none";
        list.style.padding = "0";
        results.forEach(bang => {
            const listItem = document.createElement("li");
            listItem.style.padding = "8px";
            listItem.style.borderBottom = "1px solid #eee";
            // Display bang's name ("s") and identifier ("t") without a score.
            listItem.innerHTML = `<strong>${bang.s}</strong> - <em>!${bang.t}</em>`;
            list.appendChild(listItem);
        });
        resultsContainer.appendChild(list);
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

    // Append the container to the document body.
    document.body.appendChild(container);
}

// Initialize the search page after the DOM loads.
document.addEventListener("DOMContentLoaded", createHardSearchPage);
