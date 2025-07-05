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
    // a scrollable results container, pagination controls, and a footer with enhanced visibility.
    app.innerHTML = `
    <div style="display: flex; flex-direction: column; min-height: 100vh; margin: 0; font-family: sans-serif; align-items: center; justify-content: space-between;">
      <div style="text-align: center; width: 100%; max-width: 600px; padding: 20px 0; display: flex; flex-direction: column; justify-content: center; flex-grow: 1;">
        <h2 style="margin-bottom: 20px;">${bangs.length} bangs and counting</h2>
        <input id="search-input" type="text" placeholder="Search bangs"
          style="width:100%; padding:10px; font-size:16px; box-sizing:border-box; margin-bottom:20px;" />
        <div id="results-container" style="width: 100%; flex: 1; overflow-y: auto; padding: 0 20px; box-sizing: border-box;">
        </div>
        <div id="pagination-controls" style="margin-top: 20px; margin-bottom: 50px; display: flex; justify-content: center; gap: 10px; width: 100%;">
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
    const paginationControls = app.querySelector<HTMLDivElement>("#pagination-controls")!;

    // Define pagination state variables
    const itemsPerPage = 20;
    let allResults: typeof bangs = [];
    // Removed standalone currentPage variable - only using the parameter in displayResults

    /**
     * Renders the provided array of bang entries with pagination.
     *
     * @param results - An array of bang entries to display.
     * @param page - The current page number (default: 1)
     */
     function displayResults(results: typeof bangs, page: number = 1): void {
        // Store all results for pagination
        allResults = results;
        // Removed assignment to currentPage variable
        
        if (results.length === 0) {            resultsContainer.innerHTML = "No results found.";
            paginationControls.innerHTML = "";
            return;
        }

        // Calculate pagination
        const totalPages = Math.ceil(results.length / itemsPerPage);
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, results.length);
        const currentPageResults = results.slice(startIndex, endIndex);

        // Display current page results
        let listHtml = '<ul style="list-style:none;padding:0;margin:0;width:100%;">';
        currentPageResults.forEach(bang => {
            listHtml += `<li style="padding:8px;border-bottom:1px solid #eee; text-align: center">` +
                `<strong>${bang.s}</strong> - <em>!${bang.t}</em></li>`;
        });
        listHtml += "</ul>";
        resultsContainer.innerHTML = listHtml;

        // Update pagination controls
        updatePaginationControls(page, totalPages);
    }

    /**
     * Updates the pagination controls based on current page and total pages.
     *
     * @param currentPage - The current page number
     * @param totalPages - The total number of pages
     */
    function updatePaginationControls(currentPage: number, totalPages: number): void {
        // Always show pagination controls, even for single pages

        let controlsHtml = '';

        // Define common button styles with dark mode compatibility
        const buttonStyles = `
            padding: 8px 14px;
            cursor: pointer;
            border: none;
            border-radius: 20px;
            font-weight: 500;
            transition: all 0.2s ease;
            margin: 0 4px;
            background-color: #f0f0f0;
            color: #333;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        `;

        const disabledStyles = `
            opacity: 0.5;
            cursor: not-allowed;
            box-shadow: none;
        `;

        // Define page indicator styles
        const pageIndicatorStyles = `
            padding: 8px 14px;
            border-radius: 20px;
            background-color: #e0e0e0;
            color: #333;
            font-weight: 500;
            box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
        `;

        // Previous button
        controlsHtml += `<button ${currentPage === 1 ? 'disabled' : ''} id="prev-page"
            class="pagination-button prev-button"
            style="${buttonStyles} ${currentPage === 1 ? disabledStyles : ''}">
            ← Prev
        </button>`;

        // Page indicator
        controlsHtml += `<span class="pagination-indicator"
            style="${pageIndicatorStyles}">
            ${currentPage} / ${totalPages}
        </span>`;

        // Next button
        controlsHtml += `<button ${currentPage === totalPages ? 'disabled' : ''} id="next-page"
            class="pagination-button next-button"
            style="${buttonStyles} ${currentPage === totalPages ? disabledStyles : ''}">
            Next →
        </button>`;

        paginationControls.innerHTML = controlsHtml;

        // Add dark mode styles
        const styleTag = document.createElement('style');
        styleTag.textContent = `
            @media (prefers-color-scheme: dark) {
                .pagination-button {
                    background-color: #222 !important;
                    color: #ddd !important;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) !important;
                }

                .pagination-button:hover:not(:disabled) {
                    background-color: #333 !important;
                }

                .pagination-indicator {
                    background-color: #2a2a2a !important;
                    color: #ddd !important;
                    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3) !important;
                }
            }

            .pagination-button:hover:not(:disabled) {
                background-color: #e0e0e0;
                transform: translateY(-1px);
                box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
            }

            .pagination-button:active:not(:disabled) {
                transform: translateY(0);
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            }
        `;
        document.head.appendChild(styleTag);

        // Add event listeners to pagination controls
        const prevButton = paginationControls.querySelector<HTMLButtonElement>("#prev-page");
        const nextButton = paginationControls.querySelector<HTMLButtonElement>("#next-page");

        if (prevButton) {
            prevButton.addEventListener("click", () => {
                if (currentPage > 1) {
                    displayResults(allResults, currentPage - 1);
                }
            });
        }
        
        if (nextButton) {
            nextButton.addEventListener("click", () => {
                if (currentPage < totalPages) {
                    displayResults(allResults, currentPage + 1);
                }
            });
        }
        
        // Save the current page as a data attribute on the container for state persistence
        paginationControls.dataset.currentPage = currentPage.toString();    }

    /**
     * Displays the full list of bangs with pagination.
     * @param page - The page to display (default: 1)
     */
    function displayFullList(page: number = 1): void {
        // Make sure we're using the full array of bangs
        allResults = bangs;
        displayResults(bangs, page);
    }

    // Listen for input changes to update the search results.
    // Use debouncing to prevent lag during typing
    let debounceTimer: ReturnType<typeof setTimeout>;
    input.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = input.value.trim();
            // Reset to first page on new search
            if (query === "") {
                displayFullList(1);
            } else {
                const results = searchBangs(query);
                displayResults(results, 1);
            }
        }, 150); // 150ms delay to debounce input
    });

    // Initially show the full list.
    // Add a focus event to the input element for better UX
    input.addEventListener("focus", () => {
        input.select(); // Select all text when input is focused
    });

    // Initialize with the full list and ensure pagination is set up
    allResults = bangs;
    displayFullList(1);
}

// Initialize the search page after the DOM loads.
document.addEventListener("DOMContentLoaded", createHardSearchPage);
