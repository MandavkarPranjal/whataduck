import { redirect } from 'next/navigation';
import { bangs } from '../bang'; // Adjust this path if needed

interface HomeProps {
    searchParams: { [key: string]: string | string[] | undefined };
}

export default function BangRedirect({ searchParams }: HomeProps) {
    // Without localStorage, fallback to default bang "ddg".
    const LS_DEFAULT_BANG = 'ddg';
    const defaultBang = bangs.find(
        (b) => b.t.toLowerCase() === LS_DEFAULT_BANG.toLowerCase()
    );

    // Render fallback UI if no search query is provided.
    const noSearchDefaultPageRender = () => {
        return (
            <div className="flex min-h-screen flex-col justify-center items-center">
                <h1 className="text-4xl">Not searching for anything?</h1>
                <p className="text-xl p-2">Try <span className="italic semibold">"!gpt what is the meaning of life?"</span></p>
            </div>
        );
    };

    // Retrieve the query parameter from the URL.
    const rawQuery =
        typeof searchParams.q === 'string'
            ? searchParams.q.trim()
            : Array.isArray(searchParams.q)
                ? searchParams.q[0].trim()
                : '';

    // If the query is empty, render the default page.
    if (!rawQuery) {
        return noSearchDefaultPageRender();
    }

    // Look for a bang command (e.g., !01net or !ddg) in the query.
    const match = rawQuery.match(/!(\S+)/i);
    const bangCandidate = match?.[1]?.toLowerCase();
    const selectedBang = bangs.find((b) => b.t.toLowerCase() === bangCandidate) || defaultBang;

    // Remove the bang command from the query.
    const cleanQuery = rawQuery.replace(/!\S+\s*/i, '').trim();

    // If the selected bang does not have a URL, render the default page.
    if (!selectedBang?.u) {
        return noSearchDefaultPageRender();
    }

    // Replace the placeholder in the URL with the URL-encoded query.
    const searchUrl = selectedBang.u.replace(
        '{{{s}}}',
        encodeURIComponent(cleanQuery).replace(/%2F/g, '/')
    );

    // Server-side redirect to the computed search URL.
    redirect(searchUrl);

    // This return will never be reached since redirect() throws.
    return null;
}
