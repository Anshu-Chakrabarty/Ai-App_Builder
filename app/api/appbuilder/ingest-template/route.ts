// app/api/appbuilder/ingest-template/route.ts — Phase 1: ZIP/HTML → AI-ready package
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import {
  ingestZipBuffer,
  ingestHtmlString,
  renderSiteFromConfig,
  makeIngestStubTemplate,
} from "@/lib/template-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST multipart: file (zip|html) OR { sample: "starter-agency" } */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // JSON body — load bundled sample
    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body.sample === "starter-agency") {
        const zipPath = path.join(
          process.cwd(),
          "templates",
          "samples",
          "starter-agency.zip"
        );
        const buf = await readFile(zipPath);
        return respondWithPackage(
          await ingestZipBuffer(buf, {
            brandName: body.brandName || "Harbor Studio",
            accent: body.accent || "#0F766E",
            templateName: "Starter Agency",
          })
        );
      }
      return NextResponse.json({ error: "Unknown sample." }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const brandName = String(form.get("brandName") || "Your Brand");
    const accent = String(form.get("accent") || "#2563EB");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Upload a .zip or .html file." }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());

    if (name.endsWith(".zip")) {
      const pkg = await ingestZipBuffer(buf, {
        brandName,
        accent,
        templateName: file.name.replace(/\.zip$/i, ""),
      });
      return respondWithPackage(pkg);
    }

    if (name.endsWith(".html") || name.endsWith(".htm")) {
      const html = buf.toString("utf8");
      const pkg = await ingestHtmlString(html, file.name, {
        brandName,
        accent,
        templateName: file.name,
      });
      return respondWithPackage(pkg);
    }

    return NextResponse.json(
      { error: "Only .zip or .html files are supported." },
      { status: 400 }
    );
  } catch (err) {
    console.error("ingest-template error", err);
    const message = err instanceof Error ? err.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function respondWithPackage(
  pkg: Awaited<ReturnType<typeof ingestZipBuffer>>
) {
  const stub = makeIngestStubTemplate({
    id: pkg.manifest.templateId,
    name: pkg.manifest.templateName,
    pages: pkg.config.pages,
    accent: pkg.config.accent,
  });

  const html = renderSiteFromConfig({
    template: stub,
    manifest: pkg.manifest,
    config: pkg.config,
    knowledge: pkg.knowledge,
    boundPages: pkg.boundPages,
    assets: pkg.assets,
  });

  return NextResponse.json({
    siteTemplateId: pkg.manifest.templateId,
    templateName: pkg.manifest.templateName,
    copy: pkg.config.content,
    pages: pkg.config.pages,
    html,
    manifest: pkg.manifest,
    config: pkg.config,
    knowledge: pkg.knowledge,
    boundPages: pkg.boundPages,
    assets: Object.fromEntries(
      // Don't send huge CSS blobs twice if already inlined; keep image data URLs
      Object.entries(pkg.assets).filter(
        ([, v]) => typeof v === "string" && v.startsWith("data:")
      )
    ),
    source: pkg.source,
    message: "Template ingested: manifest + bindings + knowledge ready. Template HTML structure unchanged.",
  });
}
