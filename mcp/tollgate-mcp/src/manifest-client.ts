export type ManifestAction = {
  id: string;
  type: string;
  title: string;
  description: string;
  endpoint: string;
  method: "POST";
  price_msats: number;
  input_schema?: Record<string, unknown>;
  risk?: "low" | "medium" | "high";
};

export type Manifest = {
  version: string;
  service: {
    name: string;
    description: string;
    homepage: string;
    lightning_address?: string;
  };
  actions: ManifestAction[];
  receipts: { pubkey_hex: string; algorithm: string };
};

export function manifestUrlFor(input: string): string {
  // Accept either a domain root, a manifest URL, or any URL on the site.
  const u = new URL(/^https?:\/\//.test(input) ? input : `https://${input}`);
  return `${u.protocol}//${u.host}/.well-known/tollgate.json`;
}

export function domainOf(input: string): string {
  return new URL(/^https?:\/\//.test(input) ? input : `https://${input}`).host;
}

export async function fetchManifest(url: string, timeoutMs = 5000): Promise<Manifest | null> {
  const target = manifestUrlFor(url);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(target, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const m = (await res.json()) as Manifest;
    if (!m?.version || !Array.isArray(m?.actions)) return null;
    return m;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
