// app/api/appbuilder/modify-site/route.ts — AI Website Agent on manifest/config architecture
import { NextResponse } from "next/server";
import {
  getPageDesign,
  isCatalogDesignId,
  isLayoutDesignId,
  slugForPage,
} from "@/lib/page-designs";
import {
  optionsForMissingPage,
  schemaForCustomDesign,
} from "@/lib/custom-designs";
import {
  customPageFallback,
  generatePageCopy,
} from "@/lib/generate-page-copy";
import { parseAddPageRequests, resolvePageToDelete } from "@/lib/page-request";
import { pickSiteTemplate } from "@/lib/appbuilder/pick-template";
import { isInlinePageEdit } from "@/lib/site-widgets";
import { inferMediaDomain, resolveMediaTheme, isBrokenMediaUrl, ensureGalleryUrls } from "@/lib/site-media";
import type { PageDef } from "@/lib/types";
import {
  analyzeTemplate,
  applyUpdatesToConfig,
  configToCopy,
  materializeNewPages,
  renderSiteFromConfig,
  runWebsiteAgent,
  type SiteConfig,
  type TemplateKnowledge,
  type TemplateManifest,
} from "@/lib/template-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

type PendingPage = { label: string; key: string };

function keyFromLabel(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "page"
  );
}

function pageExists(pages: PageDef[], key: string, label: string): boolean {
  const lc = label.toLowerCase();
  return pages.some((p) => p.key === key || p.label.toLowerCase() === lc);
}

function mediaForIdea(
  template: ReturnType<typeof pickSiteTemplate>,
  ideaHint: string,
  existing?: SiteConfig["media"]
): SiteConfig["media"] {
  const want = inferMediaDomain(ideaHint, template.category, template.id);
  const have = existing?.category;
  const hasDead =
    !!existing &&
    (isBrokenMediaUrl(existing.hero) ||
      isBrokenMediaUrl(existing.split) ||
      isBrokenMediaUrl(existing.banner) ||
      (existing.gallery || []).some((u) => isBrokenMediaUrl(u)));
  const mismatch =
    want !== "default" &&
    have &&
    have !== want &&
    !(want === "food" && have === "ecommerce") &&
    !(want === "ecommerce" && have === "food");
  if (existing && !mismatch && !hasDead) return existing;
  if (existing && hasDead && !mismatch) {
    const category = existing.category || want;
    const gallery = ensureGalleryUrls(existing.gallery, category, 6);
    return {
      hero: isBrokenMediaUrl(existing.hero) ? gallery[0] : existing.hero,
      gallery,
      category,
      split: isBrokenMediaUrl(existing.split) ? gallery[1] : existing.split || gallery[1],
      banner: isBrokenMediaUrl(existing.banner) ? gallery[2] : existing.banner || gallery[2],
    };
  }
  const fresh = resolveMediaTheme(
    template.category,
    template.id,
    template.previewImage,
    ideaHint
  );
  return {
    hero: fresh.hero,
    gallery: [...fresh.gallery],
    category: fresh.category,
    split: fresh.split,
    banner: fresh.banner,
  };
}

function ensureAiReady(args: {
  template: ReturnType<typeof pickSiteTemplate>;
  copy: Record<string, any>;
  pages: PageDef[];
  brandName: string;
  accent: string;
  idea?: string;
  manifest?: TemplateManifest;
  config?: SiteConfig;
  knowledge?: TemplateKnowledge;
  /** Force re-resolve stock media from idea (heal wrong-domain galleries) */
  refreshMedia?: boolean;
}) {
  const ideaHint = [args.idea, args.brandName].filter(Boolean).join(" ");
  const pageKeysMatch =
    !!args.config &&
    args.pages.length === args.config.pages.length &&
    args.pages.every((p) => args.config!.pages.some((c) => c.key === p.key));

  // Reuse live package only when the page set is unchanged (and not a forced media/section refresh)
  if (args.manifest && args.config && args.knowledge && pageKeysMatch && !args.refreshMedia) {
    const media = args.refreshMedia
      ? mediaForIdea(args.template, ideaHint, undefined)
      : mediaForIdea(args.template, ideaHint, args.config.media);
    return {
      manifest: args.manifest,
      config: {
        ...args.config,
        content: args.copy && Object.keys(args.copy).length ? args.copy : args.config.content,
        pages: args.pages,
        brandName: args.brandName,
        accent: args.accent,
        media,
        layout: args.config.layout,
        theme: args.config.theme,
        sectionState: args.config.sectionState,
      },
      knowledge: args.knowledge,
    };
  }

  // Pages added/removed → re-analyze for fresh editable IDs, then merge customizations
  const fresh = analyzeTemplate({
    template: args.template,
    pages: args.pages,
    content: args.copy || {},
    brandName: args.brandName,
    accent: args.accent,
    idea: args.idea,
  });

  if (args.config) {
    const prev = args.copy || args.config.content || {};
    fresh.config = {
      ...fresh.config,
      media: args.refreshMedia
        ? mediaForIdea(args.template, ideaHint, undefined)
        : mediaForIdea(args.template, ideaHint, args.config.media),
      layout: args.config.layout ?? fresh.config.layout,
      theme: { ...(fresh.config.theme || {}), ...(args.config.theme || {}) },
      sectionState: { ...(fresh.config.sectionState || {}), ...(args.config.sectionState || {}) },
      content: {
        ...fresh.config.content,
        ...prev,
        visual: prev.visual || args.config.content?.visual || fresh.config.content?.visual,
        __htmlBlocks: prev.__htmlBlocks || args.config.content?.__htmlBlocks,
        __widgets: prev.__widgets || args.config.content?.__widgets,
      },
      pages: args.pages,
      brandName: args.brandName,
      accent: args.accent,
    };
  }

  return fresh;
}

async function addCatalogPage(args: {
  design: NonNullable<ReturnType<typeof getPageDesign>>;
  pageKey: string;
  pageLabel: string;
  details: any;
  template: { name: string; category: string };
  copy: Record<string, any>;
  pages: PageDef[];
}): Promise<{ copy: Record<string, any>; pages: PageDef[]; pageKey: string }> {
  const pageCopy = await generatePageCopy({
    schema: args.design.schema,
    details: args.details,
    pageLabel: args.pageLabel,
    pageKey: args.pageKey,
    template: args.template,
    copy: args.copy,
    fallback: args.design.fallback,
  });

  return {
    copy: { ...args.copy, [args.pageKey]: pageCopy },
    pages: [
      ...args.pages,
      {
        key: args.pageKey,
        label: args.pageLabel,
        slug: slugForPage(args.pageKey),
        designId: args.design.id,
      },
    ],
    pageKey: args.pageKey,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      idea,
      siteTemplateId,
      brandName,
      accent,
      copy,
      pages,
      pageKey,
      instruction,
      selectedDesignId,
      pendingPage,
      pendingQueue,
      manifest: incomingManifest,
      config: incomingConfig,
      knowledge: incomingKnowledge,
      boundPages: incomingBoundPages,
      assets: incomingAssets,
      history: incomingHistory,
      workLog: incomingWorkLog,
      target: incomingTarget,
      images: incomingImages,
      restoreSnapshot,
      rerenderOnly,
    } = body as {
      idea: string;
      siteTemplateId: string;
      brandName: string;
      accent: string;
      copy: Record<string, any>;
      pages: PageDef[];
      pageKey: string;
      instruction: string;
      selectedDesignId?: string;
      pendingPage?: PendingPage;
      pendingQueue?: PendingPage[];
      manifest?: TemplateManifest;
      config?: SiteConfig;
      knowledge?: TemplateKnowledge;
      boundPages?: Record<string, string>;
      assets?: Record<string, string>;
      history?: { role: "user" | "assistant"; text: string }[];
      workLog?: { at: number; prompt: string; summary: string; ops?: string[] }[];
      target?: { id: string; kind?: string; label?: string } | null;
      images?: string[];
      /** Re-render from a stored config snapshot (Undo) without running the agent */
      restoreSnapshot?: boolean;
      /** Re-render current config/HTML without AI (heal broken previews) */
      rerenderOnly?: boolean;
    };

    if (
      !instruction?.trim() &&
      !selectedDesignId &&
      !(incomingImages && incomingImages.length) &&
      !restoreSnapshot &&
      !rerenderOnly
    ) {
      return NextResponse.json({ error: "Describe the change." }, { status: 400 });
    }

    const template = pickSiteTemplate(idea || "", siteTemplateId);
    let currentPages: PageDef[] = Array.isArray(pages) ? [...pages] : [...template.pages];
    let nextCopy = { ...(copy || {}) };
    const brand = brandName || "AppBuilder Site";
    const color = accent || "#7C3AED";
    const boundPages = incomingBoundPages;
    const assets = incomingAssets;

    const renderNow = (
      manifest: TemplateManifest,
      config: SiteConfig,
      knowledge: TemplateKnowledge
    ) =>
      renderSiteFromConfig({
        template,
        manifest,
        config,
        knowledge,
        boundPages,
        assets,
      });

    // ——— Undo / restore previous config snapshot ———
    if (restoreSnapshot || rerenderOnly) {
      if (!incomingConfig && !rerenderOnly) {
        return NextResponse.json(
          { error: "Nothing to restore — snapshot is missing config. Try Regenerate Site." },
          { status: 400 }
        );
      }
      const baseConfig: SiteConfig = incomingConfig || {
        brandName: brand,
        accent: color,
        pages: currentPages,
        content: nextCopy,
        updatedAt: Date.now(),
      };
      const restored: SiteConfig = {
        ...baseConfig,
        brandName: brand,
        accent: color,
        pages: currentPages.length ? currentPages : baseConfig.pages,
        content:
          nextCopy && Object.keys(nextCopy).length
            ? { ...baseConfig.content, ...nextCopy }
            : baseConfig.content,
        updatedAt: Date.now(),
      };
      const ready = ensureAiReady({
        template,
        copy: restored.content,
        pages: restored.pages,
        brandName: brand,
        accent: color,
        idea: idea || "",
        manifest: incomingManifest,
        config: restored,
        knowledge: incomingKnowledge,
        refreshMedia: !!rerenderOnly,
      });
      return NextResponse.json({
        status: restoreSnapshot ? "restored" : "rerendered",
        assistantMessage: restoreSnapshot
          ? "Restored previous design."
          : "Rebuilt the preview from your site config.",
        copy: configToCopy(ready.config),
        pages: ready.config.pages,
        html: renderNow(ready.manifest, ready.config, ready.knowledge),
        manifest: ready.manifest,
        config: ready.config,
        knowledge: ready.knowledge,
        boundPages,
        assets,
        workEntry: {
          at: Date.now(),
          prompt: restoreSnapshot ? "undo" : "rerender",
          summary: restoreSnapshot ? "Restored previous design" : "Rebuilt preview",
          ops: [restoreSnapshot ? "undo" : "rerender"],
        },
      });
    }
    const details = {
      brandName: brand,
      prompt: idea + (instruction ? `\n\nModification request: ${instruction}` : ""),
      description: instruction || "",
      tone: "Professional",
      accent: color,
      notes: instruction || "",
    };

    // ——— Design picker completion (unknown page layout) ———
    if (selectedDesignId && pendingPage) {
      const newKey = pendingPage.key || keyFromLabel(pendingPage.label);
      if (pageExists(currentPages, newKey, pendingPage.label)) {
        const ready = ensureAiReady({
          template,
          copy: nextCopy,
          pages: currentPages,
          brandName: brand,
          accent: color,
          manifest: incomingManifest,
          config: incomingConfig,
          knowledge: incomingKnowledge,
        });
        return NextResponse.json({
          status: "exists",
          assistantMessage: `You already have a “${pendingPage.label}” page.`,
          copy: configToCopy(ready.config),
          pages: currentPages,
          html: renderNow(ready.manifest, ready.config, ready.knowledge),
          manifest: ready.manifest,
          config: ready.config,
          knowledge: ready.knowledge,
        });
      }

      const catalog = isCatalogDesignId(selectedDesignId)
        ? getPageDesign(selectedDesignId)
        : undefined;
      const layoutId = isLayoutDesignId(selectedDesignId)
        ? selectedDesignId
        : catalog
          ? undefined
          : selectedDesignId;

      if (!catalog && !layoutId) {
        return NextResponse.json({ error: "Unknown design selection." }, { status: 400 });
      }

      let pageCopy: Record<string, any>;
      let designId: string;

      if (catalog) {
        pageCopy = await generatePageCopy({
          schema: catalog.schema,
          details,
          pageLabel: pendingPage.label,
          pageKey: newKey,
          template: { name: template.name, category: template.category },
          copy: nextCopy,
          fallback: catalog.fallback,
        });
        designId = catalog.id;
      } else {
        pageCopy = await generatePageCopy({
          schema: schemaForCustomDesign(),
          details,
          pageLabel: pendingPage.label,
          pageKey: newKey,
          template: { name: template.name, category: template.category },
          copy: nextCopy,
          fallback: customPageFallback(pendingPage.label),
        });
        designId = "custom:" + layoutId;
        pageCopy.__customDesign = layoutId;
      }

      nextCopy[newKey] = pageCopy;
      currentPages.push({
        key: newKey,
        label: pendingPage.label,
        slug: slugForPage(newKey),
        designId,
      });

      const ready = ensureAiReady({
        template,
        copy: nextCopy,
        pages: currentPages,
        brandName: brand,
        accent: color,
        manifest: incomingManifest,
        config: incomingConfig,
        knowledge: incomingKnowledge,
      });

      const queue = Array.isArray(pendingQueue) ? [...pendingQueue] : [];
      const nextPending = queue.shift();

      if (nextPending) {
        return NextResponse.json({
          status: "need_design",
          assistantMessage: `“${pendingPage.label}” is ready. Next, pick a stored template or layout for “${nextPending.label}”.`,
          options: optionsForMissingPage(),
          pendingPage: nextPending,
          pendingQueue: queue,
          copy: configToCopy(ready.config),
          pages: currentPages,
          html: renderNow(ready.manifest, ready.config, ready.knowledge),
          manifest: ready.manifest,
          config: ready.config,
          knowledge: ready.knowledge,
          newPageKey: newKey,
        });
      }

      return NextResponse.json({
        status: "added",
        assistantMessage: `Added “${pendingPage.label}” via selected design. Config updated; template code unchanged.`,
        copy: configToCopy(ready.config),
        pages: currentPages,
        html: renderNow(ready.manifest, ready.config, ready.knowledge),
        manifest: ready.manifest,
        config: ready.config,
        knowledge: ready.knowledge,
        newPageKey: newKey,
      });
    }

    const msg = String(instruction || "").trim();

    // ——— Explicit page deletion (before add-page heuristics) ———
    {
      let delTarget = resolvePageToDelete(msg, currentPages);
      if (
        !delTarget &&
        /\b(delete|remove|drop)\b/i.test(msg) &&
        /\b(this|current)\s+page\b/i.test(msg) &&
        pageKey &&
        pageKey !== "home"
      ) {
        const p = currentPages.find((x) => x.key === pageKey);
        if (p) delTarget = { key: p.key, label: p.label };
      }
      if (delTarget && delTarget.key !== "home") {
        currentPages = currentPages.filter((p) => p.key !== delTarget!.key);
        nextCopy = { ...nextCopy };
        delete nextCopy[delTarget.key];
        const ready = ensureAiReady({
          template,
          copy: nextCopy,
          pages: currentPages,
          brandName: brand,
          accent: color,
          manifest: incomingManifest,
          config: incomingConfig
            ? {
                ...incomingConfig,
                content: nextCopy,
                pages: currentPages,
                brandName: brand,
                accent: color,
                customPages: Object.fromEntries(
                  Object.entries(incomingConfig.customPages || {}).filter(
                    ([k]) => k !== delTarget!.key
                  )
                ),
              }
            : undefined,
          knowledge: incomingKnowledge,
        });
        // Drop deleted page from bound HTML if present
        let nextBound = boundPages ? { ...boundPages } : undefined;
        if (nextBound) {
          const oldSlug =
            (incomingConfig?.pages || pages || []).find((p: PageDef) => p.key === delTarget!.key)
              ?.slug || `${delTarget.key}.html`;
          delete nextBound[oldSlug];
          delete nextBound[`${delTarget.key}.html`];
        }
        const html = renderSiteFromConfig({
          template,
          manifest: ready.manifest,
          config: ready.config,
          knowledge: ready.knowledge,
          boundPages: nextBound,
          assets,
        });
        return NextResponse.json({
          status: "updated",
          assistantMessage: `Removed the “${delTarget.label}” page.`,
          copy: configToCopy(ready.config),
          pages: ready.config.pages,
          html,
          manifest: ready.manifest,
          config: ready.config,
          knowledge: ready.knowledge,
          boundPages: nextBound,
          assets,
          updates: [{ type: "page", id: delTarget.key, op: "remove_page" }],
          newPageKey: "home",
          workEntry: {
            at: Date.now(),
            prompt: msg,
            summary: `Deleted page “${delTarget.label}”`,
            ops: [`remove_page:${delTarget.key}`],
          },
        });
      }
    }

    // ——— Catalog add-page shortcuts (still AI-ready after) ———
    const addRequests = !isInlinePageEdit(msg) ? parseAddPageRequests(msg) : null;
    if (addRequests?.length) {
      const catalogAdds: typeof addRequests = [];
      const unknownAdds: PendingPage[] = [];
      const alreadyHave: string[] = [];

      for (const req of addRequests) {
        if (pageExists(currentPages, req.key, req.label)) {
          alreadyHave.push(req.label);
          continue;
        }
        if (req.design) catalogAdds.push(req);
        else unknownAdds.push({ label: req.label, key: req.key });
      }

      const addedLabels: string[] = [];
      let lastAddedKey: string | undefined;

      for (const req of catalogAdds) {
        const result = await addCatalogPage({
          design: req.design!,
          pageKey: req.key,
          pageLabel: req.label,
          details,
          template: { name: template.name, category: template.category },
          copy: nextCopy,
          pages: currentPages,
        });
        nextCopy = result.copy;
        currentPages = result.pages;
        addedLabels.push(req.label);
        lastAddedKey = result.pageKey;
      }

      if (unknownAdds.length > 0) {
        const [first, ...rest] = unknownAdds;
        let assistantMessage = `I don’t have a ready “${first.label}” layout. Choose a stored page template or design style to copy.`;
        if (addedLabels.length) {
          assistantMessage =
            `Added ${addedLabels.map((l) => `“${l}”`).join(", ")}. ` + assistantMessage;
        }
        const ready = ensureAiReady({
          template,
          copy: nextCopy,
          pages: currentPages,
          brandName: brand,
          accent: color,
          manifest: incomingManifest,
          config: incomingConfig,
          knowledge: incomingKnowledge,
        });
        return NextResponse.json({
          status: "need_design",
          assistantMessage,
          options: optionsForMissingPage(),
          pendingPage: first,
          pendingQueue: rest,
          copy: configToCopy(ready.config),
          pages: currentPages,
          html: renderNow(ready.manifest, ready.config, ready.knowledge),
          manifest: ready.manifest,
          config: ready.config,
          knowledge: ready.knowledge,
          newPageKey: lastAddedKey,
        });
      }

      const ready = ensureAiReady({
        template,
        copy: nextCopy,
        pages: currentPages,
        brandName: brand,
        accent: color,
        manifest: incomingManifest,
        config: incomingConfig,
        knowledge: incomingKnowledge,
      });

      if (!addedLabels.length) {
        return NextResponse.json({
          status: "exists",
          assistantMessage: `${alreadyHave.map((l) => `“${l}”`).join(", ")} already on your site.`,
          copy: configToCopy(ready.config),
          pages: currentPages,
          html: renderNow(ready.manifest, ready.config, ready.knowledge),
          manifest: ready.manifest,
          config: ready.config,
          knowledge: ready.knowledge,
        });
      }

      return NextResponse.json({
        status: "added",
        assistantMessage: `Added ${addedLabels.map((l) => `“${l}”`).join(", ")} (config + manifest updated).`,
        copy: configToCopy(ready.config),
        pages: currentPages,
        html: renderNow(ready.manifest, ready.config, ready.knowledge),
        manifest: ready.manifest,
        config: ready.config,
        knowledge: ready.knowledge,
        newPageKey: lastAddedKey,
      });
    }

    // ——— Phase 3: AI Website Agent → JSON updates by ID → apply to config → re-render ———
    let { manifest, config, knowledge } = ensureAiReady({
      template,
      copy: nextCopy,
      pages: currentPages,
      brandName: brand,
      accent: color,
      idea: idea || "",
      manifest: incomingManifest,
      config: incomingConfig
        ? { ...incomingConfig, content: nextCopy, pages: currentPages, brandName: brand, accent: color }
        : undefined,
      knowledge: incomingKnowledge,
    });

    // Prefer stored config content when present
    if (incomingConfig?.content && Object.keys(incomingConfig.content).length) {
      config = {
        ...incomingConfig,
        content: { ...incomingConfig.content, ...nextCopy },
        pages: currentPages,
        brandName: brand,
        accent: color,
        updatedAt: Date.now(),
      };
    }

    const agent = await runWebsiteAgent({
      prompt: msg,
      config,
      manifest,
      knowledge,
      activePageKey: pageKey || "home",
      idea,
      history: incomingHistory,
      workLog: incomingWorkLog,
      target: incomingTarget,
      images: Array.isArray(incomingImages) ? incomingImages.slice(0, 4) : undefined,
    });

    if (agent.mode === "answer") {
      return NextResponse.json({
        status: "answered",
        copy: configToCopy(config),
        pages: config.pages,
        html: renderNow(manifest, config, knowledge),
        boundPages,
        assets,
        assistantMessage: agent.assistantMessage,
        newPageKey: pageKey,
        workEntry: {
          at: Date.now(),
          prompt: msg,
          summary: agent.assistantMessage.slice(0, 160),
          ops: ["answer"],
        },
      });
    }

    let nextConfig = applyUpdatesToConfig(config, agent.updates || [], manifest);
    if (agent.newPages?.length) {
      nextConfig = materializeNewPages(nextConfig, knowledge, agent.newPages);
    }

    // Re-analyze editable IDs when pages were added/removed
    const pageOps = (agent.updates || []).some(
      (u) => u.op === "add_page" || u.op === "remove_page"
    );
    if (agent.newPages?.length || pageOps) {
      const refreshed = analyzeTemplate({
        template,
        pages: nextConfig.pages,
        content: nextConfig.content,
        brandName: nextConfig.brandName,
        accent: nextConfig.accent,
      });
      manifest = refreshed.manifest;
      knowledge = refreshed.knowledge;
      nextConfig = {
        ...nextConfig,
        pages: nextConfig.pages,
        media: nextConfig.media || refreshed.config.media,
      };
    }

    // Prune bound pages for removals
    let nextBoundPages = boundPages;
    const removed = (agent.updates || []).filter((u) => u.op === "remove_page");
    if (nextBoundPages && removed.length) {
      nextBoundPages = { ...nextBoundPages };
      for (const u of removed) {
        const key = String(u.id || "").replace(/^page\./, "");
        delete nextBoundPages[`${key}.html`];
        const slug = config.pages.find((p) => p.key === key)?.slug;
        if (slug) delete nextBoundPages[slug];
      }
    }

    const html = renderSiteFromConfig({
      template,
      manifest,
      config: nextConfig,
      knowledge,
      boundPages: nextBoundPages,
      assets,
    });

    const ops = [
      ...(agent.updates || []).map((u) => `${u.op || "set"}:${u.id}`),
      ...(agent.newPages || []).map((p) => `add_page:${p.key}`),
    ];

    return NextResponse.json({
      status: "updated",
      copy: configToCopy(nextConfig),
      pages: nextConfig.pages,
      html,
      manifest,
      config: nextConfig,
      knowledge,
      boundPages: nextBoundPages,
      assets,
      assistantMessage: agent.assistantMessage,
      updates: agent.updates,
      newPageKey:
        removed.length
          ? "home"
          : agent.newPages?.[0]?.key ||
            pageKey ||
            nextConfig.pages[0]?.key,
      workEntry: {
        at: Date.now(),
        prompt: msg,
        summary: agent.assistantMessage.slice(0, 160),
        ops,
      },
    });
  } catch (err) {
    console.error("modify-site error", err);
    return NextResponse.json({ error: "Modify failed." }, { status: 500 });
  }
}
