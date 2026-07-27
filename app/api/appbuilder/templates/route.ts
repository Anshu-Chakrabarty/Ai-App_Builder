// app/api/appbuilder/templates/route.ts — aggregate local + live public catalogs
import { NextResponse } from "next/server";
import { TEMPLATES } from "@/lib/appbuilder/catalog";
import {
  fetchEnvatoTemplates,
  fetchFreeHtmlTemplates,
  fetchNetlifyStarters,
  fetchVercelNextExamples,
  fetchVercelTemplateRepos,
  type RemoteTemplate,
} from "@/lib/appbuilder/remote-templates";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") || "all";
  const q = (searchParams.get("q") || "").toLowerCase().trim();

  const local: RemoteTemplate[] = TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    source: "local",
    framework: t.stack.join(" · "),
    url: `/wizard?template=${t.id}`,
    category: t.category,
  }));

  const want = (s: string) => source === "all" || source === s;

  const [vercelExamples, vercelRepos, netlify, freeHtml, envato] = await Promise.all([
    want("vercel") ? fetchVercelNextExamples(40) : Promise.resolve([]),
    want("vercel") ? fetchVercelTemplateRepos(12) : Promise.resolve([]),
    want("netlify") ? fetchNetlifyStarters() : Promise.resolve([]),
    want("free-html") || want("all") ? fetchFreeHtmlTemplates() : Promise.resolve([]),
    want("envato") ? fetchEnvatoTemplates(q || "website template") : Promise.resolve([]),
  ]);

  // When filtering "all", still load free-html; when source is local-only skip remotes
  const vercel = [...vercelExamples, ...vercelRepos];

  let items: RemoteTemplate[] = [];
  if (source === "local") items = local;
  else if (source === "vercel") items = vercel;
  else if (source === "netlify") items = netlify;
  else if (source === "envato") items = envato;
  else if (source === "free-html") items = freeHtml;
  else items = [...local, ...vercel, ...netlify, ...freeHtml, ...envato];

  if (q) {
    items = items.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.framework.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }

  return NextResponse.json({
    items,
    meta: {
      ready: true,
      authRequired: {
        github: false,
        netlify: false,
        freeHtml: false,
        envato: !process.env.ENVATO_PERSONAL_TOKEN,
      },
      counts: {
        local: local.length,
        vercel: vercel.length,
        netlify: netlify.length,
        "free-html": freeHtml.length,
        envato: envato.length,
      },
      notes: {
        vercel:
          "Live from GitHub API (no key). Official Vercel Templates gallery has no public API.",
        envato: process.env.ENVATO_PERSONAL_TOKEN
          ? "Envato token configured — ThemeForest results included."
          : "Optional: add ENVATO_PERSONAL_TOKEN for ThemeForest. Free HTML templates work without it.",
        github: process.env.GITHUB_TOKEN
          ? "GITHUB_TOKEN set (higher rate limits)."
          : "Using anonymous GitHub API (works; optional GITHUB_TOKEN for higher limits).",
      },
    },
  });
}
