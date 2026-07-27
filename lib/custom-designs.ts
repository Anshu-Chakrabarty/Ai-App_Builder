// lib/custom-designs.ts — layouts used when a requested page isn't in the catalog
import { esc, MONO } from "./render";
import type { DesignOption } from "./types";
import { DESIGN_OPTIONS, PAGE_DESIGNS } from "./page-designs";
import { iconHTML } from "./site-media";

export { DESIGN_OPTIONS };

const GENERIC_SCHEMA = `{
 "heading":"",
 "blurb":"",
 "sections":[{"title":"","body":""},{"title":"","body":""},{"title":"","body":""}],
 "cta":""
}`;

const CUSTOM_IMAGES = [
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1000&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1000&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1000&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1551434678-e076c223a692?w=1000&q=80&auto=format&fit=crop",
];

export function schemaForCustomDesign(): string {
  return GENERIC_SCHEMA;
}

export function renderCustomDesign(
  designId: string,
  copy: any,
  accent: string
): string {
  const heading = esc(copy?.heading || "New page");
  const blurb = esc(copy?.blurb || "");
  const sections = Array.isArray(copy?.sections) ? copy.sections : [];
  const cta = esc(copy?.cta || "Get in touch");
  const img = CUSTOM_IMAGES[Math.abs(hash(designId + heading)) % CUSTOM_IMAGES.length];

  if (designId === "split-hero") {
    return `<section style="display:grid;grid-template-columns:1.1fr 0.9fr;min-height:70vh">
      <div class="wrap" style="padding:100px 40px;display:flex;flex-direction:column;justify-content:center">
        <div class="eyebrow">${iconHTML("spark")} New page</div>
        <h1 style="font-size:clamp(36px,5vw,52px)">${heading}</h1>
        <p class="lead" style="margin-top:18px">${blurb}</p>
        <div style="margin-top:28px"><a class="btn" href="contact.html">${iconHTML("calendar")} ${cta}</a></div>
      </div>
      <div style="min-height:320px;position:relative;overflow:hidden">
        <img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover;min-height:320px"/>
        <div style="position:absolute;inset:0;background:linear-gradient(160deg,${accent}66,transparent)"></div>
      </div>
    </section>
    <section class="wrap">
      <div style="display:grid;gap:28px;max-width:720px">
        ${sections.map((s: any, i: number) => `<div style="display:flex;gap:14px"><div class="icon-badge">${iconHTML(i % 2 ? "check" : "star")}</div><div><h3 style="font-size:20px;font-weight:800;margin-bottom:8px">${esc(s.title)}</h3><p style="color:#555">${esc(s.body)}</p></div></div>`).join("")}
      </div>
    </section>`;
  }

  if (designId === "card-grid") {
    return `<section class="wrap" style="padding-top:96px">
      <div class="eyebrow">${iconHTML("image")} New page</div>
      <h2>${heading}</h2>
      <p class="lead">${blurb}</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin-top:40px">
        ${sections.map((s: any, i: number) => `<div style="border:1px solid #ececec;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 10px 30px rgba(16,24,40,.04)">
          <img src="${CUSTOM_IMAGES[i % CUSTOM_IMAGES.length]}" alt="" style="width:100%;height:140px;object-fit:cover"/>
          <div style="padding:20px"><div class="icon-badge">${iconHTML(["spark", "users", "shield", "star"][i % 4])}</div>
          <h3 style="font-size:18px;font-weight:800;margin-bottom:8px">${esc(s.title)}</h3><p style="color:#555">${esc(s.body)}</p></div>
        </div>`).join("")}
      </div>
      <div style="margin-top:36px"><a class="btn" href="contact.html">${iconHTML("calendar")} ${cta}</a></div>
    </section>`;
  }

  if (designId === "timeline") {
    return `<section class="wrap" style="padding-top:96px;max-width:720px">
      <div class="eyebrow">${iconHTML("clock")} New page</div>
      <h2>${heading}</h2>
      <p class="lead">${blurb}</p>
      <div style="margin-top:40px;border-left:2px solid ${accent};padding-left:24px;display:grid;gap:28px">
        ${sections.map((s: any, i: number) => `<div><div style="font-family:${MONO};font-size:12px;color:${accent};font-weight:700">0${i + 1}</div><h3 style="font-size:18px;font-weight:800;margin:6px 0">${esc(s.title)}</h3><p style="color:#555">${esc(s.body)}</p></div>`).join("")}
      </div>
    </section>`;
  }

  if (designId === "minimal-list") {
    return `<section class="wrap" style="padding-top:96px;max-width:760px">
      <div class="eyebrow">${iconHTML("check")} New page</div>
      <h2>${heading}</h2>
      <p class="lead" style="margin-bottom:36px">${blurb}</p>
      ${sections.map((s: any) => `<div style="border-top:1px solid #e8e8e8;padding:26px 0;display:flex;gap:14px">${iconHTML("check")}<div><h3 style="font-size:18px;font-weight:800;margin-bottom:8px">${esc(s.title)}</h3><p style="color:#555">${esc(s.body)}</p></div></div>`).join("")}
      <div style="margin-top:28px"><a class="btn" href="contact.html">${cta}</a></div>
    </section>`;
  }

  // editorial default
  return `<section class="wrap" style="padding-top:48px;max-width:900px">
    <div style="border-radius:20px;overflow:hidden;margin-bottom:32px;max-height:280px">
      <img src="${img}" alt="" style="width:100%;height:280px;object-fit:cover"/>
    </div>
    <div class="eyebrow">${iconHTML("spark")} New page</div>
    <h1 style="font-size:clamp(36px,5vw,52px);margin-bottom:20px">${heading}</h1>
    <p class="lead" style="font-size:22px;margin-bottom:40px">${blurb}</p>
    ${sections.map((s: any) => `<div style="margin-bottom:32px"><h3 style="font-size:20px;font-weight:800;margin-bottom:10px">${esc(s.title)}</h3><p style="color:#444;font-size:17px;line-height:1.7">${esc(s.body)}</p></div>`).join("")}
    <a class="btn" href="contact.html">${iconHTML("calendar")} ${cta}</a>
  </section>`;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** Catalog page templates + layout styles the user can copy for an unknown page. */
export function optionsForMissingPage(): DesignOption[] {
  const catalog: DesignOption[] = PAGE_DESIGNS.map((d) => ({
    id: d.id,
    label: d.label,
    description: `Copy the “${d.label}” template layout. ${d.description}`,
    previewHint: "Stored template",
  }));
  return [...catalog, ...DESIGN_OPTIONS];
}
