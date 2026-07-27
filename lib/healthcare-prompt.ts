// lib/healthcare-prompt.ts — consistent healthcare AI instructions
export const HEALTHCARE_SYSTEM = [
  "You are a senior healthcare marketing copywriter for clinics, hospitals, and care practices.",
  "Return ONLY valid JSON matching the exact schema provided — same keys and array lengths.",
  "Write clear, compassionate, professional patient-facing copy.",
  "Rules for accuracy and safety:",
  "- Never invent medical outcomes, cure rates, or guarantees.",
  "- Never diagnose, prescribe, or give clinical advice.",
  "- Do not claim board certifications, awards, or affiliations unless the user brief states them.",
  "- Use realistic but clearly illustrative details when the brief is thin; stay plausible for the specialty.",
  "- Prefer inclusive, respectful language; avoid fear-based or sensational wording.",
  "- Keep brand name, specialty, location, and tone consistent across every field.",
  "- Phone/email/address/hours must be coherent with the brief (or clearly placeholder-style if missing).",
  "- Never use lorem ipsum, 'placeholder', or TODO text.",
  "- Only cover pages and sections the user asked for — do not invent extra site pages or unrelated topics.",
  "Keep strings concise and scannable for website UI.",
].join(" ");

export const HEALTHCARE_TONES = [
  "Compassionate",
  "Professional",
  "Calm & reassuring",
  "Warm & approachable",
  "Clinical & precise",
] as const;

/** Normalize user brief into stable generation context. */
export function buildHealthcareBrief(details: {
  brandName?: string;
  prompt?: string;
  description?: string;
  tone?: string;
  notes?: string;
}): string {
  const brief = (details.prompt || details.description || "").trim();
  const brand = (details.brandName || "").trim() || "(infer a fitting practice name from the brief)";
  const tone = details.tone || "Compassionate";

  return [
    "Practice / brand name: " + brand,
    "Tone: " + tone,
    details.notes ? "Extra notes: " + details.notes : "",
    "",
    "Patient / practice brief:",
    brief,
    "",
    "Consistency requirements:",
    "- Use the same practice name everywhere.",
    "- Reflect the same specialty, services, and location cues from the brief on every page.",
    "- CTAs should match healthcare actions (Book appointment, Call us, Patient portal, etc.).",
    "- If the brief omits a detail, invent a coherent placeholder that fits the specialty — do not contradict the brief.",
    "- Follow the user's listed pages and section hints exactly; do not add unrequested pages.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function pageCopyPrompt(args: {
  details: {
    brandName?: string;
    prompt?: string;
    description?: string;
    tone?: string;
    notes?: string;
  };
  pageLabel: string;
  templateName: string;
  templateCategory: string;
  schema: string;
  existingSummary?: string;
  sectionHints?: string;
}): string {
  return [
    buildHealthcareBrief(args.details),
    "",
    "Template: " + args.templateName + " (" + args.templateCategory + ")",
    "Page to write: " + args.pageLabel,
    args.sectionHints
      ? "Required sections / topics for this page (cover these specifically):\n" +
        args.sectionHints
      : "",
    args.existingSummary
      ? "Existing site context (keep consistent):\n" + args.existingSummary
      : "",
    "",
    "Return JSON matching EXACTLY this schema:",
    args.schema,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Short consistency snapshot from already-generated home copy. */
export function summarizeExistingCopy(copy: Record<string, any> | null | undefined): string {
  if (!copy || typeof copy !== "object") return "";
  const parts: string[] = [];
  if (copy.hero?.title) parts.push("Hero: " + copy.hero.title);
  if (copy.hero?.subtitle) parts.push("Subtitle: " + copy.hero.subtitle);
  if (Array.isArray(copy.services)) {
    const names = copy.services
      .slice(0, 5)
      .map((s: any) => s?.name || s?.title)
      .filter(Boolean);
    if (names.length) parts.push("Services: " + names.join(", "));
  }
  if (copy.contact?.phone) parts.push("Phone: " + copy.contact.phone);
  if (copy.contact?.address) parts.push("Address: " + copy.contact.address);
  return parts.join("\n");
}
