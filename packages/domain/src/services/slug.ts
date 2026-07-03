/** URL-safe slug from a title (lowercase, hyphenated, alnum only). */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'untitled'
  );
}

/**
 * Given a desired base slug and a predicate that tells whether a candidate is
 * already taken, return the first free slug (`base`, `base-2`, `base-3`, …).
 */
export async function uniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base);
  if (!(await isTaken(root))) return root;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${root}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  // Extremely unlikely; fall back to a timestamped suffix provided by caller.
  return `${root}-${Date.now()}`;
}
