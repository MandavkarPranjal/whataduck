// Lazy full-bang loader for /search and /blocklist only.
// The redirect path (main.ts) never touches this module — it uses the
// codegen'd redirectMap (tag -> url template) synchronously.
//
// Full list (~1.6MB JSON) is versioned separately from the JS bundle:
//   data/bangs-version.json  -> { version, count, dataUrl } (tiny, precached)
//   data/bangs.min.json      -> full entries (SW CacheFirst + IndexedDB)
// Deploys only cache-bust the version file; clients fetch the big JSON
// only when the version actually changes, via differential patch if the
// server publishes one, else a full fetch.

export interface BangEntry {
    t: string;
    s: string;
    d: string;
    u: string;
}

interface VersionMeta {
    version: string;
    count: number;
    dataUrl: string;
}

interface BangPatch {
    base: string;
    version: string;
    upsert: BangEntry[];
    delete: string[];
}

const DB_NAME = "whataduck";
const STORE = "kv";
const KEY_DATA = "bangs-data";
const KEY_VERSION = "bangs-version";

function base(): string {
    return import.meta.env.BASE_URL || "/";
}

function joinUrl(path: string): string {
    const b = base();
    return (b.endsWith("/") ? b : b + "/") + path.replace(/^\//, "");
}

function openDb(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
        try {
            if (!("indexedDB" in window)) return resolve(null);
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                req.result.createObjectStore(STORE);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
    if (!dbPromise) dbPromise = openDb();
    return dbPromise;
}

async function idbGet<T>(key: string): Promise<T | null> {
    try {
        const d = await db();
        if (!d) return null;
        return await new Promise((resolve) => {
            try {
                const tx = d.transaction(STORE, "readonly");
                const req = tx.objectStore(STORE).get(key);
                req.onsuccess = () => resolve((req.result as T) ?? null);
                req.onerror = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    } catch {
        return null;
    }
}

async function idbSet(key: string, value: unknown): Promise<void> {
    try {
        const d = await db();
        if (!d) return;
        await new Promise<void>((resolve) => {
            try {
                const tx = d.transaction(STORE, "readwrite");
                tx.objectStore(STORE).put(value, key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            } catch {
                resolve();
            }
        });
    } catch {
        /* private mode etc. — fetch will just re-run next time */
    }
}

function applyPatch(data: BangEntry[], patch: BangPatch): BangEntry[] {
    const del = new Set(patch.delete.map((t) => t.toLowerCase()));
    const up = new Map(patch.upsert.map((e) => [e.t.toLowerCase(), e] as const));
    const out: BangEntry[] = [];
    for (const e of data) {
        const key = e.t.toLowerCase();
        if (del.has(key)) continue;
        const replacement = up.get(key);
        if (replacement) {
            out.push(replacement);
            up.delete(key);
        } else {
            out.push(e);
        }
    }
    for (const e of up.values()) out.push(e);
    out.sort((a, b) => a.t.toLowerCase().localeCompare(b.t.toLowerCase()));
    return out;
}

/**
 * Load the full bang list, using IndexedDB + versioned JSON so the 1.6MB
 * payload is fetched at most once per data version (not per deploy).
 */
export async function loadFullBangs(): Promise<BangEntry[]> {
    const [cachedVersion, cached] = await Promise.all([
        idbGet<string>(KEY_VERSION),
        idbGet<BangEntry[]>(KEY_DATA),
    ]);

    let meta: VersionMeta | null = null;
    try {
        const res = await fetch(joinUrl("data/bangs-version.json"), { cache: "force-cache" });
        if (res.ok) meta = (await res.json()) as VersionMeta;
    } catch {
        meta = null;
    }

    // Cache hit: same data version still current.
    if (cached && cached.length > 0 && meta && cachedVersion === meta.version) {
        return cached;
    }
    // Offline with stale cache and no version info: serve what we have.
    if (cached && cached.length > 0 && !meta) {
        return cached;
    }

    // Differential update: base version -> current version patch.
    if (cached && cached.length > 0 && cachedVersion && meta && cachedVersion !== meta.version) {
        try {
            const patchRes = await fetch(
                joinUrl(`data/bangs-patch-${cachedVersion}-to-${meta.version}.json`),
                { cache: "force-cache" },
            );
            if (patchRes.ok) {
                const patch = (await patchRes.json()) as BangPatch;
                if (patch.base === cachedVersion && patch.version === meta.version) {
                    const merged = applyPatch(cached, patch);
                    await Promise.all([idbSet(KEY_DATA, merged), idbSet(KEY_VERSION, meta.version)]);
                    return merged;
                }
            }
        } catch {
            /* patch absent — fall through to full fetch */
        }
    }

    const dataUrl = joinUrl(meta?.dataUrl ?? "data/bangs.min.json");
    const res = await fetch(dataUrl, { cache: "force-cache" });
    if (!res.ok) {
        if (cached && cached.length > 0) return cached;
        throw new Error(`failed to load bang list: ${res.status}`);
    }
    const fresh = (await res.json()) as BangEntry[];
    await Promise.all([
        idbSet(KEY_DATA, fresh),
        idbSet(KEY_VERSION, meta?.version ?? "unknown"),
    ]);
    return fresh;
}
