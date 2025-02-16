"use client";

import { useEffect } from 'react';
import { bangs } from './bang'; // Adjust this path if needed

export default function Home() {
    useEffect(() => {
        // Ensure this code runs only on the client.
        if (typeof window === 'undefined') return;

        // Retrieve the default bang from localStorage, falling back to "ddg" for DuckDuckGo.
        const LS_DEFAULT_BANG = localStorage.getItem('default-bang') ?? 'ddg';
        const defaultBang = bangs.find(
            (b) => b.t.toLowerCase() === LS_DEFAULT_BANG.toLowerCase()
        );

        function noSearchDefaultPageRender() {
            console.debug('No search query provided.');
            // Optionally, you could render a default view or show a message here.
        }

        function getBangredirectUrl() {
            const url = new URL(window.location.href);
            const query = url.searchParams.get('q')?.trim() ?? '';
            if (!query) {
                noSearchDefaultPageRender();
                return null;
            }

            // Look for a bang command (e.g., !01net or !ddg) in the query.
            const match = query.match(/!(\S+)/i);
            const bangCandidate = match?.[1]?.toLowerCase();
            const selectedBang =
                bangs.find((b) => b.t.toLowerCase() === bangCandidate) ?? defaultBang;

            // Remove the bang command from the query.
            const cleanQuery = query.replace(/!\S+\s*/i, '').trim();

            if (!selectedBang?.u) return null;

            // Replace the placeholder in the URL with the URL-encoded query.
            const searchUrl = selectedBang.u.replace(
                '{{{s}}}',
                encodeURIComponent(cleanQuery).replace(/%2F/g, '/')
            );

            return searchUrl;
        }

        function doRedirect() {
            const searchUrl = getBangredirectUrl();
            if (!searchUrl) return;
            // Redirect the user to the computed search URL.
            window.location.replace(searchUrl);
        }

        doRedirect();
    }, []);

    return (
        <div className="flex min-h-screen flex-col justify-between p-8 font-[family-name:var(--font-geist-sans)] sm:p-20">
            <main className="flex flex-grow flex-col items-center justify-center text-center">
                <div className="text-7xl font-bold">What a Duck!</div>
                <div className="mt-4"></div>
            </main>
            <footer className="mt-8 text-center text-sm text-gray-500">
                <a
                    href="https://github.com/MandavkarPranjal/whataduck"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                >
                    View on GitHub
                </a>
            </footer>
        </div>
    );
}
