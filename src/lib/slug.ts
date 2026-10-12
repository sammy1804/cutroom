export function slugify(input: string, maxLength = 48): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** Appends -2, -3… until `isTaken` returns false. */
export async function uniqueSlug(base: string, isTaken: (slug: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base) || "untitled";
  if (!(await isTaken(root))) return root;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${root}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${root}-${crypto.randomUUID().slice(0, 6)}`;
}

export const RESERVED_SLUGS = new Set(["new", "settings", "api", "admin", "onboarding", "invite"]);
