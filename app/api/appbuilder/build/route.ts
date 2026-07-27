// app/api/appbuilder/build/route.ts — actually generate the multi-page site
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import {
  generateContentResilient,
  parseJsonLoose,
  QuotaExceededError,
} from "@/lib/gemini";
import { HEALTHCARE_SYSTEM } from "@/lib/healthcare-prompt";
import { generatePageCopy } from "@/lib/generate-page-copy";
import { getPageDesign } from "@/lib/page-designs";
import { parsePagesFromBrief } from "@/lib/page-request";
import type { PageDef } from "@/lib/types";
import {
  buildGenerationPrompt,
  pagesFromFeatures,
  pickSiteTemplate,
} from "@/lib/appbuilder/pick-template";
import { buildDockerfile, buildGithubActionsYaml, buildReadme } from "@/lib/appbuilder/artifacts";
import type { AppProject } from "@/lib/appbuilder/types";
import { analyzeTemplate, renderSiteFromConfig } from "@/lib/template-ai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(req: Request) {
  let raw = "";
  try {
    const body = await req.json();
    const project = body.project as AppProject;
    if (!project?.idea?.trim() && !project?.requirementsText?.trim()) {
      return NextResponse.json(
        { error: "Provide an idea or upload a requirements file." },
        { status: 400 }
      );
    }

    const brandName = project.name || "AppBuilder Site";
    const accent = project.theme?.primary || "#7C3AED";
    const idea = [project.idea, project.requirementsText].filter(Boolean).join("\n\n");

    const template = pickSiteTemplate(idea, project.siteTemplateId || project.templateId);
    const briefPages = parsePagesFromBrief(idea);
    const featurePages = pagesFromFeatures(
      project.features || [],
      briefPages.fromPrompt
        ? briefPages.pages.map((p) => ({ key: p.key, label: p.label }))
        : project.pages || []
    );

    // Prefer explicit page list from prompt when user listed pages
    let sitePages: PageDef[] = featurePages;
    if (briefPages.fromPrompt && briefPages.pages.length) {
      sitePages = [];
      const seen = new Set<string>();
      for (const p of briefPages.pages) {
        if (seen.has(p.key)) continue;
        seen.add(p.key);
        sitePages.push({
          key: p.key === "home" ? "home" : p.key,
          label: p.label,
          slug: p.key === "home" ? "index.html" : `${p.key}.html`,
          designId: p.design?.id,
        });
      }
      if (!seen.has("home")) {
        sitePages.unshift({ key: "home", label: "Home", slug: "index.html" });
      }
    }

    const prompt = buildGenerationPrompt({
      idea: project.idea || "",
      requirementsText: project.requirementsText,
      featureIds: project.features || [],
      brandName,
      pages: sitePages,
    });

    const details = {
      brandName,
      prompt,
      description: prompt,
      tone: "Professional",
      accent,
      notes: `Stack: ${project.stack?.frontend}/${project.stack?.backend}/${project.stack?.database}. Cloud: ${project.deploy?.cloud}.`,
      sectionHints: briefPages.sectionHints,
    };

    let copy: Record<string, any> = { ...(template.fallback || {}) };
    let usedFallback = false;

    // Generate root/home schema copy
    try {
      const homePrompt =
        prompt +
        "\n\nTemplate: \"" +
        template.name +
        "\" (" +
        template.category +
        ").\nReturn JSON matching EXACTLY this schema:\n" +
        template.schema;

      const result = await generateContentResilient(ai, {
        contents: homePrompt,
        config: {
          systemInstruction: HEALTHCARE_SYSTEM.replace(
            "healthcare marketing copywriter for clinics, hospitals, and care practices",
            "product copywriter for web applications and marketing sites"
          ),
          responseMimeType: "application/json",
          temperature: 0.4,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      raw = result.text ?? "";
      copy = { ...copy, ...(parseJsonLoose(raw) as Record<string, any>) };
    } catch (err) {
      console.error("build home generation failed:", err);
      usedFallback = true;
      copy = { ...(template.fallback || {}) };
      if (err instanceof QuotaExceededError) {
        // continue with fallback site rather than failing the whole build
      }
    }

    // Generate catalog/design pages + custom pages
    for (const page of sitePages) {
      if (page.key === "home") continue;
      // Template-native keys (services, providers, contact, …) live in root copy
      const nativeKeys = new Set(template.pages.map((p) => p.key));
      if (nativeKeys.has(page.key) && !page.designId) continue;

      if (page.designId) {
        const design = getPageDesign(page.designId);
        if (!design) continue;
        try {
          const pageCopy = await generatePageCopy({
            schema: design.schema,
            details,
            pageLabel: page.label,
            pageKey: page.key,
            template: { name: template.name, category: template.category },
            copy,
            fallback: design.fallback,
            sectionHints: briefPages.sectionHints[page.key],
          });
          copy[page.key] = pageCopy;
        } catch {
          copy[page.key] = { ...design.fallback };
          usedFallback = true;
        }
        continue;
      }

      // Unknown page → custom card-grid layout with AI or fallback sections
      try {
        const { schemaForCustomDesign } = await import("@/lib/custom-designs");
        const pageCopy = await generatePageCopy({
          schema: schemaForCustomDesign(),
          details,
          pageLabel: page.label,
          pageKey: page.key,
          template: { name: template.name, category: template.category },
          copy,
          fallback: {
            heading: page.label,
            blurb: `Overview of ${page.label} for ${brandName}.`,
            sections: [
              { title: "Overview", body: briefPages.sectionHints[page.key] || details.prompt.slice(0, 240) },
              { title: "Details", body: "Built from your requirements and selected features." },
              { title: "Next steps", body: "Contact us to learn more." },
            ],
            cta: "Get started",
            __customDesign: "card-grid",
          },
          sectionHints: briefPages.sectionHints[page.key],
        });
        pageCopy.__customDesign = pageCopy.__customDesign || "card-grid";
        copy[page.key] = pageCopy;
        page.designId = "custom:card-grid";
      } catch {
        copy[page.key] = {
          heading: page.label,
          blurb: `Learn more about ${page.label}.`,
          sections: [
            { title: "Overview", body: "Content generated from your requirements." },
            { title: "Capabilities", body: (project.features || []).join(", ") },
            { title: "Contact", body: "Reach out to get started." },
          ],
          cta: "Contact us",
          __customDesign: "card-grid",
        };
        page.designId = "custom:card-grid";
        usedFallback = true;
      }
    }

    // Ensure contact exists in copy if contact page present
    if (sitePages.some((p) => p.key === "contact") && !copy.contact) {
      copy.contact = template.fallback?.contact || {
        heading: "Contact us",
        blurb: "We would love to hear from you.",
        email: "hello@example.com",
        phone: "+1 (555) 010-2000",
        address: "Remote · Global",
        hours: "Mon–Fri 9am–6pm",
      };
    }

    // Part 1: Make template AI-ready — analyze once → manifest + config + knowledge
    const { manifest, config, knowledge } = analyzeTemplate({
      template,
      pages: sitePages,
      content: copy,
      brandName,
      accent,
    });

    // Website Renderer: config + original template components (template code unchanged)
    const html = renderSiteFromConfig({ template, manifest, config, knowledge });

    const artifacts = {
      githubActions: buildGithubActionsYaml(project),
      dockerfile: buildDockerfile(project),
      readme: buildReadme(project),
    };

    return NextResponse.json({
      siteTemplateId: template.id,
      templateName: template.name,
      copy: config.content,
      pages: config.pages,
      html,
      manifest,
      config,
      knowledge,
      usedFallback,
      artifacts,
      message: usedFallback
        ? "AI-ready site built with sample config where the model was unavailable."
        : "Template analyzed into manifest + config. Site rendered from data bindings.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("build error:", message);
    if (err instanceof QuotaExceededError || /Quota exceeded|free_tier/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "Gemini quota exceeded. Add billing or wait for reset, then regenerate. Offline sample build was not returned for this request — retry.",
        },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Build failed: " + message }, { status: 500 });
  }
}
