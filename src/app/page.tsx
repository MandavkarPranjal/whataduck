"use client"

import { useState } from "react"

export default function Home() {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        const textToCopy = "https://whataduckk.netlify.app/bang?q=%s"
        try {
            await navigator.clipboard.writeText(textToCopy)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error("Failed to copy text: ", err)
        }
    }

    return (
        <div className="flex min-h-screen flex-col justify-between p-8 font-[var(--font-geist-sans)] sm:p-20">
            <main className="flex flex-grow flex-col items-center justify-center text-center">
                <h1 className="text-5xl sm:text-7xl font-bold mb-2">What a Duck!</h1>
                <p className="text-gray-400 text-center max-w-xl mb-8">
                    DuckDuckGo's bang redirects are too slow & no redirects to any AI-chat app. Add the following URL as a custom search engine to your browser.
                </p>
                <div className="flex flex-row items-center gap-4 w-full max-w-2xl">
                    <input
                        type="text"
                        className="p-2 rounded w-full bg-transparent/5 border border-gray-700/70 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                        value="https://whataduckk.netlify.app/bang?q=%s"
                        readOnly
                    />
                    <button
                        className="p-2 text-white rounded transition-all hover:bg-black-800 active:bg-black-700 flex items-center justify-center"
                        onClick={handleCopy}
                    >
                        {copied ? (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-6 w-6 mr-2"
                            >
                                <path d="M20 6L9 17l-5-5"></path>
                            </svg>
                        ) : (
                            <>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-6 w-6 mr-2"
                                >
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </>
                        )}
                    </button>
                </div>
            </main>
            <footer className="flext flex-row mt-8 text-center text-gray-400">
                <a
                    href="https://github.com/MandavkarPranjal/whataduck"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-gray-200"
                >
                    GitHub
                </a>
                {" "} {" | "} {" "}
                <a
                    href="https://x.com/__pr4njal"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-gray-200"
                >
                    Twitter (X)
                </a>
            </footer>
        </div>
    )
}
