type Subscriber = (event: { type: string; data: unknown }) => void;

const subs = new Set<Subscriber>();

export function subscribe(fn: Subscriber): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function publish(event: { type: string; data: unknown }): void {
  for (const fn of subs) {
    try {
      fn(event);
    } catch {
      // swallow
    }
  }
}
