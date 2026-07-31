// lib/site-media.ts — images, icons, and visual CSS for generated sites

const esc = (s: unknown): string =>
  String(s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type MediaTheme = {
  hero: string;
  gallery: string[];
  category: string;
  /** Split-media section photo (right column) */
  split?: string;
  /** Inner page banner */
  banner?: string;
};

const GALLERY_POOL: Record<string, string[]> = {
  healthcare: [
    "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1666214280557-f1b5022eb634?w=900&q=80&auto=format&fit=crop",
  ],
  dental: [
    "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=1200&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1609840114035-3c981b782dfe?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=900&q=80&auto=format&fit=crop",
  ],
  agency: [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&q=80&auto=format&fit=crop",
  ],
  ecommerce: [
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1445205170230-053b83016050?w=900&q=80&auto=format&fit=crop",
  ],
  food: [
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=80&auto=format&fit=crop",
  ],
  realestate: [
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=900&q=80&auto=format&fit=crop",
  ],
  education: [
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=900&q=80&auto=format&fit=crop",
  ],
  default: [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1551434678-e076c223a692?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=900&q=80&auto=format&fit=crop",
  ],
};

const GALLERY_LABELS: Record<string, string[]> = {
  food: ["Dishes", "Kitchen", "Delivery", "Menu", "Dining", "Chefs"],
  ecommerce: ["Collection", "Product", "Detail", "Lifestyle", "Checkout", "Brand"],
  healthcare: ["Care", "Team", "Clinic", "Visit", "Support", "Facility"],
  dental: ["Smile", "Studio", "Care", "Team", "Visit", "Results"],
  agency: ["Workspace", "Team", "Craft", "Strategy", "Delivery", "Culture"],
  realestate: ["Homes", "Interior", "Neighborhood", "Exterior", "Kitchen", "Outdoor"],
  education: ["Campus", "Classroom", "Students", "Library", "Lab", "Community"],
  default: ["Workspace", "Team", "Product", "Detail", "Atmosphere", "Community"],
};

/** Infer media domain from idea / brand / template labels — idea wins over template. */
export function inferMediaDomain(...parts: (string | undefined | null)[]): string {
  const t = parts.filter(Boolean).join(" ").toLowerCase();
  if (!t.trim()) return "default";
  // Food / delivery before healthcare (clinic template was wrongly used for restaurants)
  if (/food|restaurant|cafe|dining|menu|kitchen|delivery|pizza|burger|meal|cuisine|bistro|catering/.test(t))
    return "food";
  if (/dental|dentist|orthodont|smile/.test(t)) return "dental";
  if (/hospital|clinic|health|patient|doctor|pharm|telehealth|mental|medical|care practice/.test(t))
    return "healthcare";
  if (/shop|ecom|store|retail|cart|checkout|fashion|boutique|product catalog/.test(t))
    return "ecommerce";
  if (/real.?estate|property|listing|home buyer|broker/.test(t)) return "realestate";
  if (/edu|learn|course|school|university|campus|lms/.test(t)) return "education";
  if (/agency|saas|marketing|brand|studio|startup|software/.test(t)) return "agency";
  if (/hotel|resort|travel|fitness|salon|spa|beauty|pet|vet/.test(t)) return "default";
  return "default";
}

function poolKey(category: string, templateId: string, ideaHint?: string): string {
  const fromIdea = inferMediaDomain(ideaHint);
  if (fromIdea !== "default") return fromIdea;
  const t = `${category} ${templateId}`.toLowerCase();
  if (/dental|dentist/.test(t)) return "dental";
  if (/clinic|hospital|health|care|pharm|tele|mental|primary|specialty/.test(t))
    return "healthcare";
  if (/food|restaurant|cafe|dining/.test(t)) return "food";
  if (/shop|ecom|store|retail/.test(t)) return "ecommerce";
  if (/real|estate|property|listing/.test(t)) return "realestate";
  if (/edu|learn|course|school/.test(t)) return "education";
  if (/agency|saas|marketing|brand|studio/.test(t)) return "agency";
  return "default";
}

export function resolveMediaTheme(
  category: string,
  templateId: string,
  previewImage?: string,
  ideaHint?: string
): MediaTheme {
  const key = poolKey(category, templateId, ideaHint);
  const pool = GALLERY_POOL[key] || GALLERY_POOL.default;
  const ideaDomain = ideaHint ? inferMediaDomain(ideaHint) : "default";
  const useHero =
    ideaDomain !== "default"
      ? pool[0]
      : isBrokenMediaUrl(previewImage)
        ? pool[0]
        : previewImage || pool[0];
  const gallery = ensureGalleryUrls(
    pool.filter((u) => u !== useHero).concat(pool),
    key,
    6
  );
  return {
    hero: useHero || FALLBACK_IMAGE,
    gallery,
    category: key,
    split: gallery[1] || useHero || FALLBACK_IMAGE,
    banner: gallery[2] || useHero || FALLBACK_IMAGE,
  };
}

/** Known-good fallback when a gallery/hero URL 404s or is empty. */
export const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80&auto=format&fit=crop";

/** Dead Unsplash IDs we have shipped before — rewrite on render. */
const DEAD_PHOTO_IDS = [
  "photo-1581595220892-b245d5c2e3e8",
  "photo-1523050854058-8df90110c9f1",
];

export function isBrokenMediaUrl(url: string | undefined | null): boolean {
  if (!url || !String(url).trim()) return true;
  const u = String(url);
  if (!/^https?:\/\//i.test(u) && !u.startsWith("data:image/")) return true;
  return DEAD_PHOTO_IDS.some((id) => u.includes(id));
}

/** Ensure gallery always has N fetchable URLs (pad from pool, drop dead ones). */
export function ensureGalleryUrls(
  urls: string[] | undefined,
  poolKeyName: string,
  count = 6
): string[] {
  const pool = GALLERY_POOL[poolKeyName] || GALLERY_POOL.default;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of urls || []) {
    if (isBrokenMediaUrl(u)) continue;
    const s = String(u).trim();
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= count) break;
  }
  for (const u of pool) {
    if (out.length >= count) break;
    if (isBrokenMediaUrl(u) || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  while (out.length < count) out.push(FALLBACK_IMAGE);
  return out;
}

function withSize(url: string, w: number, h: number): string {
  if (url.startsWith("data:")) return url;
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}w=${w}&h=${h}&fit=crop`;
}

/** img tag attrs with onerror → fallback so “Detail” never shows empty. */
export function mediaImgAttrs(src: string, opts?: { w?: number; h?: number }): string {
  let url = isBrokenMediaUrl(src) ? FALLBACK_IMAGE : String(src || FALLBACK_IMAGE);
  if (opts?.w && opts?.h) url = withSize(url, opts.w, opts.h);
  const fb = FALLBACK_IMAGE;
  return `src="${esc(url)}" onerror="this.onerror=null;this.src='${fb}'"`;
}

export function galleryLabelsFor(category: string): string[] {
  return GALLERY_LABELS[category] || GALLERY_LABELS.default;
}

/** Inline SVG icons (no external dependency — works in downloaded HTML). */
export const ICONS: Record<string, string> = {
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.1a2 2 0 0 1 2.1-.4c.9.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.1 6.3L22 9.3l-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>`,
  map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="m22 6-10 7L2 6"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`,
};

export function iconHTML(name: keyof typeof ICONS | string, cls = "icon"): string {
  const svg = ICONS[name] || ICONS.spark;
  return `<span class="${cls}" aria-hidden="true">${svg}</span>`;
}

export function mediaCSS(accent: string): string {
  return `
    img{max-width:100%;height:auto;display:block}
    .media-hero{position:relative;min-height:min(62vh,560px);display:grid;align-items:end;overflow:hidden;border-radius:0 0 28px 28px;margin-bottom:8px}
    .media-hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .media-hero .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,12,18,.15) 0%,rgba(10,12,18,.72) 100%)}
    .media-hero .hero-copy{position:relative;z-index:2;padding:48px 28px 56px;color:#fff;max-width:1100px;margin:0 auto;width:100%}
    .media-hero .hero-copy .eyebrow{color:#fff;opacity:.9}
    .media-hero .hero-copy h1{color:#fff;max-width:16ch;text-shadow:0 8px 40px rgba(0,0,0,.25)}
    .media-hero .hero-copy .lead{color:rgba(255,255,255,.88)}
    .media-hero .hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}
    .media-hero .btn-light{background:#fff;color:${accent}}
    .icon{display:inline-flex;width:22px;height:22px;vertical-align:middle;flex-shrink:0}
    .icon svg{width:100%;height:100%}
    .icon-lg{width:28px;height:28px}
    .icon-badge{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:${accent}18;color:${accent};margin-bottom:14px}
    .icon-badge .icon{width:24px;height:24px}
    .feature-icons{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:18px;margin-top:28px}
    .feature-icons .card-soft{background:#fff;border:1px solid #e8ecf2;border-radius:18px;padding:22px 20px;box-shadow:0 10px 30px rgba(16,24,40,.04);transition:transform .2s,box-shadow .2s}
    .feature-icons .card-soft:hover{transform:translateY(-3px);box-shadow:0 16px 40px rgba(16,24,40,.08)}
    .feature-icons h3{font-size:17px;font-weight:800;margin-bottom:6px;letter-spacing:-.01em}
    .feature-icons p{color:#5b6472;font-size:14px;line-height:1.55}
    .photo-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:12px;margin-top:28px}
    .photo-grid .shot{border-radius:16px;overflow:hidden;position:relative;min-height:160px;background:#e8ecf2}
    .photo-grid .shot img{width:100%;height:100%;object-fit:cover;min-height:160px;transition:transform .45s ease}
    .photo-grid .shot:hover img{transform:scale(1.04)}
    .photo-grid .shot:nth-child(1){grid-column:span 7;min-height:280px}
    .photo-grid .shot:nth-child(2){grid-column:span 5;min-height:280px}
    .photo-grid .shot:nth-child(3),.photo-grid .shot:nth-child(4),.photo-grid .shot:nth-child(5){grid-column:span 4}
    .photo-grid .shot .cap{position:absolute;left:12px;bottom:12px;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;color:#1a1a1a}
    .photo-grid.is-equal{grid-template-columns:repeat(3,1fr)}
    .photo-grid.is-equal .shot,.photo-grid.is-equal .shot:nth-child(n){grid-column:auto;min-height:200px}
    .html-blocks-grid{display:grid;gap:18px;margin:24px auto;max-width:1100px;padding:0 20px;align-items:stretch}
    .html-blocks-grid > *{min-width:0}
    .split-media{display:grid;grid-template-columns:1.05fr .95fr;gap:36px;align-items:center;margin-top:20px}
    .split-media .frame{border-radius:22px;overflow:hidden;min-height:320px;box-shadow:0 20px 50px rgba(16,24,40,.12);position:relative}
    .split-media .frame img{width:100%;height:100%;object-fit:cover;min-height:320px}
    .split-media .frame .float-chip{position:absolute;left:16px;bottom:16px;display:flex;align-items:center;gap:8px;background:#fff;padding:10px 14px;border-radius:999px;font-size:13px;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.12);color:#1a1a1a}
    .avatar-row{display:flex;align-items:center;gap:10px;margin-top:18px}
    .avatar-row .avs{display:flex}
    .avatar-row .avs img{width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;margin-left:-10px;background:#ddd}
    .avatar-row .avs img:first-child{margin-left:0}
    .page-banner{position:relative;height:220px;overflow:hidden;border-radius:0 0 22px 22px;margin-bottom:8px}
    .page-banner img{width:100%;height:100%;object-fit:cover}
    .page-banner .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(10,12,18,.65),rgba(10,12,18,.2))}
    .page-banner .label{position:absolute;left:28px;bottom:28px;color:#fff;z-index:2}
    .page-banner .label h1{font-size:clamp(28px,4vw,42px);color:#fff}
    .brand-mark-img{width:34px;height:34px;border-radius:10px;object-fit:cover;margin-right:10px;vertical-align:middle;box-shadow:0 0 0 2px ${accent}33}
    nav .brand{display:flex;align-items:center;gap:0}
    body{background:
      radial-gradient(1200px 400px at 10% -10%, ${accent}14, transparent 55%),
      radial-gradient(900px 360px at 90% 0%, ${accent}0d, transparent 50%),
      #fff}
    section .wrap > [style*="border:1px"],
    section .wrap a[style*="border:1px"],
    section .wrap div[style*="border-radius"]{
      transition:transform .2s ease, box-shadow .2s ease;
    }
    @media(max-width:860px){
      .split-media{grid-template-columns:1fr}
      .photo-grid{grid-template-columns:1fr!important}
      .photo-grid .shot,.photo-grid .shot:nth-child(1),.photo-grid .shot:nth-child(2),
      .photo-grid .shot:nth-child(3),.photo-grid .shot:nth-child(4),.photo-grid .shot:nth-child(5),
      .photo-grid.is-equal{grid-template-columns:1fr!important}
      .photo-grid.is-equal .shot,.photo-grid .shot{grid-column:span 12!important;min-height:200px}
      .html-blocks-grid{grid-template-columns:1fr!important}
      .media-hero{min-height:min(70vh,480px);border-radius:0 0 18px 18px}
      .media-hero .hero-copy{padding:32px 16px 40px}
      .media-hero .hero-copy h1{max-width:100%}
      .feature-icons{grid-template-columns:1fr!important}
      .split-media .frame{min-height:240px}
      .page-banner{height:160px}
      .page-banner .label{left:16px;bottom:16px}
      .cta-band{padding:28px 18px;border-radius:16px}
      .site-form{padding:20px;margin-top:18px}
    }
    @media(max-width:480px){
      .media-hero{min-height:380px}
      .photo-grid .shot{min-height:160px}
    }
  `;
}

/** Extra CSS driven by config.layout (columns / equal grids). Desktop only so phones stay single-column. */
export function layoutOverrideCSS(layout?: {
  galleryColumns?: number;
  galleryVariant?: "featured" | "equal";
  featureColumns?: number;
  blocksColumns?: number;
} | null): string {
  if (!layout) return "";
  const parts: string[] = [];
  const fCols = clampCols(layout.featureColumns);
  if (fCols) {
    parts.push(
      `@media(min-width:721px){.feature-icons{grid-template-columns:repeat(${fCols},minmax(0,1fr))!important}}`
    );
  }
  const gCols = clampCols(layout.galleryColumns) || (layout.galleryVariant === "equal" ? 3 : 0);
  if (layout.galleryVariant === "equal" || gCols) {
    const cols = gCols || 3;
    parts.push(
      `@media(min-width:721px){.photo-grid,.photo-grid.is-equal{grid-template-columns:repeat(${cols},minmax(0,1fr))!important}.photo-grid .shot,.photo-grid .shot:nth-child(n),.photo-grid.is-equal .shot{grid-column:auto!important;min-height:200px}}`
    );
  }
  const bCols = clampCols(layout.blocksColumns);
  if (bCols) {
    parts.push(
      `@media(min-width:721px){.html-blocks-grid{grid-template-columns:repeat(${bCols},minmax(0,1fr))!important}}`
    );
  }
  return parts.length ? `\n${parts.join("\n")}` : "";
}

function clampCols(n?: number): number {
  if (!n || !Number.isFinite(n)) return 0;
  return Math.min(6, Math.max(2, Math.round(n)));
}

const FEATURE_SETS: Record<string, { icon: string; title: string; body: string }[]> = {
  healthcare: [
    { icon: "calendar", title: "Easy scheduling", body: "Book visits online in a few taps." },
    { icon: "shield", title: "Trusted care", body: "Clear guidance and verified providers." },
    { icon: "heart", title: "Patient-first", body: "Warm support from first contact to follow-up." },
    { icon: "clock", title: "Fast response", body: "Same-week availability for most visits." },
  ],
  dental: [
    { icon: "spark", title: "Modern smiles", body: "Comfort-first dentistry with clear plans." },
    { icon: "calendar", title: "Online booking", body: "Reserve cleanings and consults instantly." },
    { icon: "shield", title: "Gentle care", body: "Safety protocols you can see and feel." },
    { icon: "star", title: "Five-star visits", body: "Patients love the calm chairside experience." },
  ],
  agency: [
    { icon: "spark", title: "Sharp strategy", body: "Positioning that converts attention into growth." },
    { icon: "users", title: "Senior craft", body: "Designers and engineers who ship together." },
    { icon: "check", title: "Clear delivery", body: "Milestones, demos, and measurable outcomes." },
    { icon: "star", title: "Brand polish", body: "Visual systems that feel premium everywhere." },
  ],
  ecommerce: [
    { icon: "star", title: "Curated picks", body: "Products chosen for quality and style." },
    { icon: "check", title: "Easy checkout", body: "Frictionless bags and transparent shipping." },
    { icon: "shield", title: "Secure pay", body: "Trusted payments and easy returns." },
    { icon: "spark", title: "Fresh drops", body: "New arrivals every week." },
  ],
  food: [
    { icon: "star", title: "Chef-quality meals", body: "Restaurants and kitchens near you." },
    { icon: "clock", title: "Fast delivery", body: "Track orders from kitchen to door." },
    { icon: "check", title: "Easy ordering", body: "Menus, carts, and checkout in a few taps." },
    { icon: "heart", title: "Favorites saved", body: "Reorder the dishes you love." },
  ],
  default: [
    { icon: "spark", title: "Modern experience", body: "Clean UI with purposeful motion and clarity." },
    { icon: "users", title: "Built for people", body: "Flows that feel obvious on day one." },
    { icon: "shield", title: "Reliable foundation", body: "Production-ready structure you can deploy." },
    { icon: "check", title: "Clear next steps", body: "CTAs and forms that convert visitors." },
  ],
};

export function renderIconFeatures(
  theme: MediaTheme,
  accent: string,
  copy?: {
    title?: string;
    subtitle?: string;
    items?: { icon?: string; title?: string; body?: string }[];
  }
): string {
  const defaults = FEATURE_SETS[theme.category] || FEATURE_SETS.default;
  const set =
    Array.isArray(copy?.items) && copy!.items!.length
      ? copy!.items!.map((it, i) => ({
          icon: it.icon || defaults[i % defaults.length]?.icon || "spark",
          title: it.title || defaults[i % defaults.length]?.title || `Feature ${i + 1}`,
          body: it.body || defaults[i % defaults.length]?.body || "",
        }))
      : defaults;
  const title = copy?.title || "Designed with icons, imagery & polish";
  const subtitle =
    copy?.subtitle ||
    "Every generated site ships with styled components, photo layouts, and SVG icons — not just plain text.";
  return `<section class="wrap" style="padding-top:56px;padding-bottom:24px" data-ai-section="features" data-ai-id="home.features" id="features">
    <div class="eyebrow">${iconHTML("spark")} Why it feels modern</div>
    <h2 data-ai-id="visual.features.title">${esc(title)}</h2>
    <p class="lead" data-ai-id="visual.features.subtitle">${esc(subtitle)}</p>
    <div class="feature-icons">
      ${set
        .map(
          (f, i) => `<div class="card-soft" data-ai-id="visual.features.items.${i}">
          <div class="icon-badge">${iconHTML(f.icon)}</div>
          <h3 data-ai-id="visual.features.items.${i}.title">${esc(f.title)}</h3>
          <p data-ai-id="visual.features.items.${i}.body">${esc(f.body)}</p>
        </div>`
        )
        .join("")}
    </div>
  </section>`;
}

export function renderPhotoGallery(
  theme: MediaTheme,
  labels?: string[],
  layout?: { columns?: number; variant?: "featured" | "equal" },
  copy?: { title?: string; subtitle?: string }
): string {
  const caps = labels || galleryLabelsFor(theme.category);
  const shots = theme.gallery.slice(0, 5);
  const equal = layout?.variant === "equal" || (layout?.columns && layout.columns >= 2);
  const title = copy?.title || "Real imagery, ready to ship";
  const subtitle =
    copy?.subtitle ||
    "High-quality photos matched to your category — swap with your brand assets anytime.";
  return `<section class="wrap" style="padding-top:40px;padding-bottom:24px" data-ai-section="gallery" data-ai-id="home.gallery" id="gallery">
    <div class="eyebrow">${iconHTML("image")} Visual story</div>
    <h2 data-ai-id="visual.gallery.title">${esc(title)}</h2>
    <p class="lead" data-ai-id="visual.gallery.subtitle">${esc(subtitle)}</p>
    <div class="photo-grid${equal ? " is-equal" : ""}">
      ${shots
        .map(
          (src, i) =>
            `<div class="shot" data-gallery-index="${i}" data-ai-id="media.gallery.${i}" data-gallery-label="${esc(caps[i] || "Gallery")}" role="button" tabindex="0" title="Edit ${esc(caps[i] || "Gallery")} image">
              <img data-ai-id="media.gallery.${i}" ${mediaImgAttrs(src)} alt="${esc(caps[i] || "Gallery")}" loading="lazy"/>
              <div class="cap">${esc(caps[i] || "Gallery")}</div>
            </div>`
        )
        .join("")}
    </div>
  </section>`;
}

export function renderSplitMedia(
  theme: MediaTheme,
  brand: string,
  accent: string,
  copy?: { title?: string; subtitle?: string; trust?: string; cta?: string; secondaryCta?: string }
): string {
  const img = theme.split || theme.gallery[1] || theme.hero;
  const title = copy?.title || "A polished layout with depth";
  const subtitle =
    copy?.subtitle ||
    "Layered photography, icon badges, and conversion-ready CTAs — the same ingredients modern AI site builders use.";
  const trust = copy?.trust || "Trusted by teams shipping faster";
  const cta = copy?.cta || "Get started";
  const secondaryCta = copy?.secondaryCta || "View gallery";
  return `<section class="wrap split-media-section" style="padding-top:48px;padding-bottom:24px" data-ai-section="split" data-ai-id="home.split" id="split">
    <div class="split-media">
      <div>
        <div class="eyebrow">${iconHTML("users")} Built for ${esc(brand)}</div>
        <h2 data-ai-id="visual.split.title">${esc(title)}</h2>
        <p class="lead" data-ai-id="visual.split.subtitle">${esc(subtitle)}</p>
        <div class="avatar-row">
          <div class="avs">
            ${(theme.gallery.slice(0, 4) || [])
              .map(
                (u, i) =>
                  `<img data-ai-id="media.gallery.${i}" ${mediaImgAttrs(u, { w: 80, h: 80 })} alt="Team ${i + 1}" />`
              )
              .join("")}
          </div>
          <div style="font-size:13px;color:#5b6472;font-weight:600" data-ai-id="visual.split.trust">${esc(trust)}</div>
        </div>
        <div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap">
          <a class="btn" href="contact.html" data-ai-id="visual.split.cta">${iconHTML("calendar")} ${esc(cta)}</a>
          <a class="btn-secondary" href="#gallery" data-ai-id="visual.split.secondaryCta">${iconHTML("image")} ${esc(secondaryCta)}</a>
        </div>
      </div>
      <div class="frame">
        <img data-ai-id="media.split" ${mediaImgAttrs(img)} alt="${esc(brand)} preview" loading="lazy"/>
        <div class="float-chip">${iconHTML("check")} Live preview ready</div>
      </div>
    </div>
  </section>`;
}

export function renderHomeHeroMedia(
  theme: MediaTheme,
  brand: string,
  title: string,
  subtitle: string,
  cta: string
): string {
  return `<section class="media-hero" data-ai-section="hero" data-ai-id="home.hero" id="hero">
    <img data-ai-id="media.hero" ${mediaImgAttrs(theme.hero)} alt="${esc(brand)} hero" />
    <div class="shade"></div>
    <div class="hero-copy">
      <div class="eyebrow">${iconHTML("spark")} ${esc(brand)}</div>
      <h1 data-ai-id="hero.title">${esc(title)}</h1>
      <p class="lead" style="margin-top:14px" data-ai-id="hero.subtitle">${esc(subtitle)}</p>
      <div class="hero-actions">
        <a class="btn btn-light" href="contact.html" data-ai-id="hero.ctaText">${iconHTML("calendar")} ${esc(cta)}</a>
        <a class="btn-secondary" style="color:#fff;border-color:rgba(255,255,255,.55)" href="#features">${iconHTML("spark")} Explore</a>
      </div>
    </div>
  </section>`;
}

export function renderPageBanner(theme: MediaTheme, label: string): string {
  const img = theme.banner || theme.gallery[2] || theme.hero;
  return `<section class="page-banner" data-ai-section="banner" data-ai-id="home.banner" id="banner">
    <img data-ai-id="media.banner" ${mediaImgAttrs(img)} alt="${esc(label)}" />
    <div class="shade"></div>
    <div class="label">
      <div class="eyebrow" style="color:#fff">${iconHTML("image")} ${esc(label)}</div>
      <h1>${esc(label)}</h1>
    </div>
  </section>`;
}

/** Full visual package injected into pages. */
export function renderVisualPackage(args: {
  pageKey: string;
  brand: string;
  accent: string;
  theme: MediaTheme;
  heroTitle?: string;
  heroSubtitle?: string;
  heroCta?: string;
  pageLabel?: string;
  visualCopy?: {
    split?: {
      title?: string;
      subtitle?: string;
      trust?: string;
      cta?: string;
      secondaryCta?: string;
    };
    gallery?: { title?: string; subtitle?: string };
    features?: {
      title?: string;
      subtitle?: string;
      items?: { icon?: string; title?: string; body?: string }[];
    };
  };
  layout?: {
    galleryColumns?: number;
    galleryVariant?: "featured" | "equal";
    featureColumns?: number;
    blocksColumns?: number;
  };
}): string {
  const { pageKey, brand, accent, theme } = args;
  if (pageKey === "home") {
    return (
      renderIconFeatures(theme, accent, args.visualCopy?.features) +
      renderSplitMedia(theme, brand, accent, args.visualCopy?.split) +
      renderPhotoGallery(theme, undefined, {
        columns: args.layout?.galleryColumns,
        variant: args.layout?.galleryVariant,
      }, args.visualCopy?.gallery)
    );
  }
  return (
    renderPageBanner(theme, args.pageLabel || pageKey) +
    `<section class="wrap" style="padding-top:36px;padding-bottom:0" data-ai-section="features">
      <div class="feature-icons">
        ${(FEATURE_SETS[theme.category] || FEATURE_SETS.default)
          .slice(0, 3)
          .map(
            (f) => `<div class="card-soft" style="padding:16px 18px">
            <div style="display:flex;gap:12px;align-items:center">
              <div class="icon-badge" style="margin:0">${iconHTML(f.icon)}</div>
              <div><h3 style="margin:0;font-size:15px">${esc(f.title)}</h3>
              <p style="margin:0;font-size:13px;color:#5b6472">${esc(f.body)}</p></div>
            </div>
          </div>`
          )
          .join("")}
      </div>
    </section>`
  );
}

/** Full-bleed photo hero used when we want imagery above copy (optional). */
export function renderOptionalHomeHero(args: {
  brand: string;
  theme: MediaTheme;
  title: string;
  subtitle: string;
  cta: string;
}): string {
  return renderHomeHeroMedia(
    args.theme,
    args.brand,
    args.title,
    args.subtitle,
    args.cta
  );
}
