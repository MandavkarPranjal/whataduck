"use client";

export default function NotFoundPage() {
    return (
        <div className="flex min-h-screen flex-col justify-between p-8 font-[family-name:var(--font-geist-sans)] sm:p-20">
            <main className="flex flex-grow flex-col items-center justify-center text-center">
                <h1 className="text-3xl">
                    {"You're lost in the woods!"}
                </h1>
                {/* Add single horizontal line to the above heading */}
                <div className="mt-4 h-px w-96 bg-gray-700/70 rounded-full"></div>
                <div className="mt-4 text-xl text-gray-300">
                    Try{" "}
                    <a
                        href="https://whataduckk.netlify.app/bang?q=!gpt%20Quote%20to%20motivate%20me"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="italic underline text-gray-400 hover:text-gray-200"
                    >
                        "!gpt Quote to motivate me"
                    </a>
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
    );
}
