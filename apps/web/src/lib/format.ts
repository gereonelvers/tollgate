export function formatSats(msats: number): string {
  const sats = msats / 1000;
  if (sats < 1) return `${msats.toLocaleString()} msat`;
  if (sats < 1000) return `${sats.toLocaleString(undefined, { maximumFractionDigits: 1 })} sat`;
  return `${(sats / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })}k sat`;
}

export function shortHash(s: string, n = 6): string {
  return s.length > n * 2 ? `${s.slice(0, n)}…${s.slice(-n)}` : s;
}
