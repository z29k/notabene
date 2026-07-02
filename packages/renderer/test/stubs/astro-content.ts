// Stub for the `astro:content` virtual module (only real in an Astro build). nav.ts
// imports getCollection at module load; the pure helpers under test never call it.
export function getCollection(): unknown[] {
  return [];
}
export function defineCollection<T>(x: T): T {
  return x;
}
