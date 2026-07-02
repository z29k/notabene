import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { roots } from "../config.mjs";

/** Markdown → texte brut approximatif (pour l'index de recherche). */
function strip(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[#>|]+/gm, " ")
    .replace(/[*_~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const GET: APIRoute = async () => {
  const out: {
    space: string;
    href: string;
    title: string;
    headings: string[];
    text: string;
  }[] = [];

  for (const root of roots) {
    const space = root.key;
    const entries = await getCollection(space as never);
    for (const entry of entries) {
      const body = entry.body ?? "";
      const titleMatch = body.match(/^#\s+(.+?)\s*$/m);
      const headings = [...body.matchAll(/^#{2,4}\s+(.+?)\s*$/gm)].map((m) =>
        m[1].replace(/[*_`]/g, "").trim(),
      );
      out.push({
        space,
        href: `/${space}/${entry.id}`,
        title: titleMatch ? titleMatch[1].replace(/[*_`]/g, "").trim() : entry.id,
        headings,
        text: strip(body).slice(0, 1500),
      });
    }
  }

  return new Response(JSON.stringify(out), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
