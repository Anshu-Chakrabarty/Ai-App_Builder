// app/api/modify/route.ts — post-build chat: add healthcare pages consistently
import { NextResponse } from "next/server";
import { TEMPLATES } from "@/lib/templates";
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
import { parseAddPageRequests } from "@/lib/page-request";
import type { PageDef } from "@/lib/types";

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

function pageExists(
  pages: PageDef[],
  key: string,
  label: string
): boolean {
  const lc = label.toLowerCase();
  return pages.some(
    (p) => p.key === key || p.label.toLowerCase() === lc
  );
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

  const nextCopy = { ...args.copy, [args.pageKey]: pageCopy };
  const nextPages = [
    ...args.pages,
    {
      key: args.pageKey,
      label: args.pageLabel,
      slug: slugForPage(args.pageKey),
      designId: args.design.id,
    },
  ];

  return { copy: nextCopy, pages: nextPages, pageKey: args.pageKey };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      templateId,
      details,
      message,
      copy,
      pages,
      selectedDesignId,
      pendingPage,
      pendingQueue,
    } = body as {
      templateId: string;
      details: any;
      message: string;
      copy: Record<string, any>;
      pages: PageDef[];
      selectedDesignId?: string;
      pendingPage?: PendingPage;
      pendingQueue?: PendingPage[];
    };

    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) {
      return NextResponse.json({ error: "Unknown template." }, { status: 400 });
    }
    if (!message?.trim() && !selectedDesignId) {
      return NextResponse.json({ error: "Empty message." }, { status: 400 });
    }

    let currentPages: PageDef[] = Array.isArray(pages)
      ? [...pages]
      : [...template.pages];
    let nextCopy = { ...(copy || {}) };

    // User picked a stored template or layout for a page not in our catalog
    if (selectedDesignId && pendingPage) {
      const pageKey = pendingPage.key || keyFromLabel(pendingPage.label);

      if (pageExists(currentPages, pageKey, pendingPage.label)) {
        return NextResponse.json({
          status: "exists",
          assistantMessage: `You already have a “${pendingPage.label}” page.`,
          copy: nextCopy,
          pages: currentPages,
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
        return NextResponse.json(
          { error: "Unknown design selection." },
          { status: 400 }
        );
      }

      let pageCopy: Record<string, any>;
      let designId: string;

      if (catalog) {
        pageCopy = await generatePageCopy({
          schema: catalog.schema,
          details,
          pageLabel: pendingPage.label,
          pageKey,
          template,
          copy: nextCopy,
          fallback: catalog.fallback,
        });
        designId = catalog.id;
      } else {
        pageCopy = await generatePageCopy({
          schema: schemaForCustomDesign(),
          details,
          pageLabel: pendingPage.label,
          pageKey,
          template,
          copy: nextCopy,
          fallback: customPageFallback(pendingPage.label),
        });
        designId = "custom:" + layoutId;
        pageCopy.__customDesign = layoutId;
      }

      nextCopy[pageKey] = pageCopy;
      currentPages.push({
        key: pageKey,
        label: pendingPage.label,
        slug: slugForPage(pageKey),
        designId,
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
          copy: nextCopy,
          pages: currentPages,
          newPageKey: pageKey,
        });
      }

      return NextResponse.json({
        status: "added",
        assistantMessage: `Added the “${pendingPage.label}” page using your selected design, with copy matched to your practice brief. Open the new tab to review it.`,
        copy: nextCopy,
        pages: currentPages,
        newPageKey: pageKey,
      });
    }

    const msg = String(message || "").trim();
    const requests = parseAddPageRequests(msg);

    if (!requests?.length) {
      return NextResponse.json({
        status: "hint",
        assistantMessage:
          "Tell me exactly which pages to add — for example: “Add an FAQ page”, “Add FAQ and insurance”, or “Add a Partners page”. " +
          "If a page isn’t in our layout library, I’ll ask you to pick a stored template or design style.",
        copy: nextCopy,
        pages: currentPages,
      });
    }

    const catalogAdds: typeof requests = [];
    const unknownAdds: PendingPage[] = [];
    const alreadyHave: string[] = [];

    for (const req of requests) {
      if (pageExists(currentPages, req.key, req.label)) {
        alreadyHave.push(req.label);
        continue;
      }
      if (req.design) {
        catalogAdds.push(req);
      } else {
        unknownAdds.push({ label: req.label, key: req.key });
      }
    }

    const addedLabels: string[] = [];
    let lastAddedKey: string | undefined;

    for (const req of catalogAdds) {
      const result = await addCatalogPage({
        design: req.design!,
        pageKey: req.key,
        pageLabel: req.label,
        details,
        template,
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
      let assistantMessage =
        `I don’t have a ready “${first.label}” layout in our library. Choose a stored template or design style and I’ll copy that design to build the page.`;

      if (addedLabels.length) {
        assistantMessage =
          `Added ${addedLabels.map((l) => `“${l}”`).join(", ")}. ` + assistantMessage;
      }
      if (alreadyHave.length) {
        assistantMessage +=
          ` (${alreadyHave.map((l) => `“${l}”`).join(", ")} already on your site.)`;
      }

      return NextResponse.json({
        status: "need_design",
        assistantMessage,
        options: optionsForMissingPage(),
        pendingPage: first,
        pendingQueue: rest,
        copy: nextCopy,
        pages: currentPages,
        newPageKey: lastAddedKey,
      });
    }

    if (addedLabels.length === 0) {
      return NextResponse.json({
        status: "exists",
        assistantMessage: `${alreadyHave.map((l) => `“${l}”`).join(", ")} ${alreadyHave.length === 1 ? "is" : "are"} already on your site.`,
        copy: nextCopy,
        pages: currentPages,
      });
    }

    return NextResponse.json({
      status: "added",
      assistantMessage:
        addedLabels.length === 1
          ? `Added a “${addedLabels[0]}” page using our healthcare layout library, with copy aligned to your practice brief.`
          : `Added ${addedLabels.map((l) => `“${l}”`).join(", ")} using our healthcare layout library.`,
      copy: nextCopy,
      pages: currentPages,
      newPageKey: lastAddedKey,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("modify error:", message);
    return NextResponse.json(
      { error: "Could not update the site." },
      { status: 500 }
    );
  }
}
