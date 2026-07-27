// lib/appbuilder/remote-templates.ts — public template APIs (no keys required for GitHub/Netlify)
export type RemoteTemplate = {
  id: string;
  name: string;
  description: string;
  source: "local" | "vercel-github" | "netlify" | "envato" | "free-html";
  framework: string;
  url: string;
  install?: string;
  stars?: number;
  category: string;
};

const GH_HEADERS = (): HeadersInit => ({
  Accept: "application/vnd.github+json",
  "User-Agent": "AppBuilder-AI",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
});

/** Popular Next.js examples used if live GitHub call fails. */
const VERCEL_FALLBACK: RemoteTemplate[] = [
  "blog",
  "with-tailwindcss",
  "with-mdx",
  "with-stripe",
  "with-supabase",
  "with-prisma",
  "with-mongodb",
  "with-firebase",
  "with-auth0",
  "with-clerk",
  "with-openai",
  "with-zones",
  "with-docker",
  "with-jest",
  "with-playwright",
  "with-turbopack",
  "app-dir-i18n-routing",
  "reproduction-template",
  "cms-contentful",
  "cms-sanity",
].map((name) => ({
  id: `vercel-gh-${name}`,
  name: titleCase(name),
  description: `Official Next.js example from Vercel (${name}).`,
  source: "vercel-github" as const,
  framework: "Next.js",
  url: `https://github.com/vercel/next.js/tree/canary/examples/${name}`,
  install: `npx create-next-app --example ${name}`,
  category: "Vercel / Next.js",
}));

/** Official path: GitHub Contents API — public, no token required. */
export async function fetchVercelNextExamples(limit = 36): Promise<RemoteTemplate[]> {
  try {
    const res = await fetch(
      "https://api.github.com/repos/vercel/next.js/contents/examples?ref=canary",
      { headers: GH_HEADERS(), next: { revalidate: 3600 } }
    );
    if (!res.ok) {
      console.warn("GitHub examples API", res.status, await res.text().catch(() => ""));
      return VERCEL_FALLBACK.slice(0, limit);
    }
    const data = (await res.json()) as Array<{
      name: string;
      type: string;
      html_url: string;
    }>;
    if (!Array.isArray(data)) return VERCEL_FALLBACK.slice(0, limit);
    return data
      .filter((d) => d.type === "dir")
      .slice(0, limit)
      .map((d) => ({
        id: `vercel-gh-${d.name}`,
        name: titleCase(d.name),
        description: `Official Next.js example from Vercel’s GitHub monorepo (${d.name}).`,
        source: "vercel-github" as const,
        framework: "Next.js",
        url: d.html_url,
        install: `npx create-next-app --example ${d.name}`,
        category: "Vercel / Next.js",
      }));
  } catch (err) {
    console.warn("fetchVercelNextExamples failed", err);
    return VERCEL_FALLBACK.slice(0, limit);
  }
}

/** Extra Vercel-tagged repos on GitHub (public search API). */
export async function fetchVercelTemplateRepos(limit = 12): Promise<RemoteTemplate[]> {
  try {
    const res = await fetch(
      "https://api.github.com/search/repositories?q=topic:vercel-template+OR+topic:nextjs-template&sort=stars&per_page=" +
        limit,
      { headers: GH_HEADERS(), next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: Array<{
        id: number;
        full_name: string;
        name: string;
        description: string | null;
        html_url: string;
        stargazers_count: number;
        language: string | null;
      }>;
    };
    return (data.items || []).map((r) => ({
      id: `vercel-repo-${r.id}`,
      name: r.name,
      description: r.description || `Community Vercel template: ${r.full_name}`,
      source: "vercel-github" as const,
      framework: r.language || "JavaScript",
      url: r.html_url,
      install: `npx create-next-app -e ${r.html_url}`,
      stars: r.stargazers_count,
      category: "Vercel community",
    }));
  } catch {
    return [];
  }
}

/** Netlify starters — GitHub search + curated list (no Netlify API key). */
export async function fetchNetlifyStarters(): Promise<RemoteTemplate[]> {
  const curated: RemoteTemplate[] = [
    {
      id: "netlify-next",
      name: "Next.js on Netlify",
      description: "Deploy Next.js with Netlify’s official runtime.",
      source: "netlify",
      framework: "Next.js",
      url: "https://github.com/netlify/next-runtime",
      install: "npx create-next-app@latest",
      category: "Netlify",
    },
    {
      id: "netlify-astro",
      name: "Astro Starter",
      description: "Content-focused Astro site ready for Netlify.",
      source: "netlify",
      framework: "Astro",
      url: "https://github.com/withastro/astro/tree/main/examples/basics",
      install: "npm create astro@latest",
      category: "Netlify",
    },
    {
      id: "netlify-eleventy",
      name: "Eleventy Blog",
      description: "Classic Jamstack blog template for Netlify.",
      source: "netlify",
      framework: "Eleventy",
      url: "https://github.com/11ty/eleventy-base-blog",
      category: "Netlify",
    },
    {
      id: "netlify-remix",
      name: "Remix on Netlify",
      description: "Remix template configured for Netlify Edge / Functions.",
      source: "netlify",
      framework: "Remix",
      url: "https://github.com/netlify/remix-template",
      category: "Netlify",
    },
  ];

  try {
    const res = await fetch(
      "https://api.github.com/search/repositories?q=netlify+template+in:name,description&sort=stars&per_page=8",
      { headers: GH_HEADERS(), next: { revalidate: 3600 } }
    );
    if (!res.ok) return curated;
    const data = (await res.json()) as {
      items?: Array<{
        id: number;
        name: string;
        description: string | null;
        html_url: string;
        stargazers_count: number;
        language: string | null;
      }>;
    };
    const live = (data.items || []).map((r) => ({
      id: `netlify-gh-${r.id}`,
      name: r.name,
      description: r.description || "Netlify-related starter on GitHub",
      source: "netlify" as const,
      framework: r.language || "Jamstack",
      url: r.html_url,
      stars: r.stargazers_count,
      category: "Netlify",
    }));
    const seen = new Set(curated.map((c) => c.url));
    return [...curated, ...live.filter((l) => !seen.has(l.url))];
  } catch {
    return curated;
  }
}

/** Free HTML / CSS templates from public GitHub (no Envato token needed). */
export async function fetchFreeHtmlTemplates(): Promise<RemoteTemplate[]> {
  const curated: RemoteTemplate[] = [
    {
      id: "html5up-aerial",
      name: "HTML5 UP — Aerial",
      description: "Free responsive HTML5 / CSS3 template (CC).",
      source: "free-html",
      framework: "HTML / CSS",
      url: "https://html5up.net/aerial",
      category: "Free HTML",
    },
    {
      id: "html5up-story",
      name: "HTML5 UP — Story",
      description: "Free storytelling landing template.",
      source: "free-html",
      framework: "HTML / CSS",
      url: "https://html5up.net/story",
      category: "Free HTML",
    },
    {
      id: "startbootstrap-agency",
      name: "Start Bootstrap — Agency",
      description: "Free Bootstrap business / agency theme.",
      source: "free-html",
      framework: "Bootstrap",
      url: "https://github.com/StartBootstrap/startbootstrap-agency",
      category: "Free HTML",
    },
    {
      id: "startbootstrap-landing",
      name: "Start Bootstrap — Landing Page",
      description: "Free Bootstrap marketing landing page.",
      source: "free-html",
      framework: "Bootstrap",
      url: "https://github.com/StartBootstrap/startbootstrap-landing-page",
      category: "Free HTML",
    },
    {
      id: "tailwind-landing",
      name: "Tailwind Landing Page",
      description: "Open-source Tailwind CSS landing starter.",
      source: "free-html",
      framework: "Tailwind CSS",
      url: "https://github.com/tailwindtoolbox/Landing-Page",
      category: "Free HTML",
    },
  ];

  try {
    const res = await fetch(
      "https://api.github.com/search/repositories?q=html+css+template+stars:%3E500&sort=stars&per_page=10",
      { headers: GH_HEADERS(), next: { revalidate: 3600 } }
    );
    if (!res.ok) return curated;
    const data = (await res.json()) as {
      items?: Array<{
        id: number;
        name: string;
        description: string | null;
        html_url: string;
        stargazers_count: number;
        language: string | null;
      }>;
    };
    const live = (data.items || []).map((r) => ({
      id: `free-html-${r.id}`,
      name: r.name,
      description: r.description || "Popular HTML/CSS template on GitHub",
      source: "free-html" as const,
      framework: r.language || "HTML",
      url: r.html_url,
      stars: r.stargazers_count,
      category: "Free HTML",
    }));
    return [...curated, ...live];
  } catch {
    return curated;
  }
}

/**
 * Envato ThemeForest — only works if ENVATO_PERSONAL_TOKEN is set.
 * Create free at https://build.envato.com/create-token/ (no app store review).
 */
export async function fetchEnvatoTemplates(query = "html template"): Promise<RemoteTemplate[]> {
  const token = process.env.ENVATO_PERSONAL_TOKEN;
  if (!token) return [];
  try {
    const url = new URL("https://api.envato.com/v1/discovery/search/search/item");
    url.searchParams.set("term", query);
    url.searchParams.set("site", "themeforest.net");
    url.searchParams.set("page", "1");
    url.searchParams.set("page_size", "12");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.warn("Envato API", res.status);
      return [];
    }
    const data = (await res.json()) as {
      matches?: Array<{
        id: number;
        name: string;
        description?: string;
        url: string;
        number_of_sales?: number;
      }>;
    };
    return (data.matches || []).map((m) => ({
      id: `envato-${m.id}`,
      name: m.name,
      description: m.description || "ThemeForest marketplace item",
      source: "envato" as const,
      framework: "HTML / Theme",
      url: m.url,
      stars: m.number_of_sales,
      category: "ThemeForest",
    }));
  } catch (err) {
    console.warn("Envato fetch failed", err);
    return [];
  }
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
