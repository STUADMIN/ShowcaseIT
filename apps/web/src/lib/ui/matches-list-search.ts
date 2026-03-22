/**
 * Client-side list search: every whitespace-separated token must appear in the blob (all match, order-free).
 */
export function matchesListSearch(query: string, searchableBlob: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const blob = searchableBlob.toLowerCase();
  return q.split(/\s+/).every((token) => token.length > 0 && blob.includes(token));
}
