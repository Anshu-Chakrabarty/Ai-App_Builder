// lib/page-designs.ts — healthcare add-on page layouts
import type { DesignOption, PageDesign } from "./types";
import { esc, MONO } from "./render";

export const DESIGN_OPTIONS: DesignOption[] = [
  {
    id: "editorial",
    label: "Editorial",
    description: "Calm long-form page — ideal for patient education or about care philosophy.",
    previewHint: "Readable · reassuring",
  },
  {
    id: "card-grid",
    label: "Service cards",
    description: "Scannable cards for services, conditions, or care pathways.",
    previewHint: "Cards · clear choices",
  },
  {
    id: "split-hero",
    label: "Split hero",
    description: "Strong headline with accent panel — good for campaigns or new programs.",
    previewHint: "Impact · booking CTA",
  },
  {
    id: "timeline",
    label: "Care journey",
    description: "Step-by-step visit or recovery path — reduces patient anxiety.",
    previewHint: "Steps · guided",
  },
  {
    id: "minimal-list",
    label: "Minimal list",
    description: "Clean stacked sections — policies, insurance, or FAQs.",
    previewHint: "Quiet · precise",
  },
];

function sectionWrap(inner: string) {
  return `<section class="wrap" style="padding-top:96px;padding-bottom:96px">${inner}</section>`;
}

export const PAGE_DESIGNS: PageDesign[] = [
  {
    id: "about",
    label: "About",
    description: "Practice story, mission, and values.",
    aliases: ["about", "about us", "our story", "mission", "who we are", "practice"],
    schema: `{"heading":"","body":"","points":["","",""],"cta":""}`,
    fallback: {
      heading: "Care rooted in trust",
      body: "We built this practice so patients feel heard, informed, and supported at every step — not rushed through a checklist.",
      points: ["Patient-first decisions", "Evidence-informed care", "Clear communication"],
      cta: "Meet our team",
    },
    render(c, accent) {
      return sectionWrap(`
        <div class="eyebrow">About</div>
        <h2>${esc(c.heading)}</h2>
        <p class="lead" style="font-size:21px;margin-top:18px">${esc(c.body)}</p>
        <div style="display:flex;gap:28px;flex-wrap:wrap;margin-top:40px">
          ${(c.points || []).map((p: string) => `<div style="border-left:2px solid ${accent};padding-left:14px;font-weight:600">${esc(p)}</div>`).join("")}
        </div>
        <div style="margin-top:36px"><a class="btn" href="contact.html">${esc(c.cta || "Contact us")}</a></div>
      `);
    },
  },
  {
    id: "faq",
    label: "FAQ",
    description: "Patient questions answered clearly.",
    aliases: ["faq", "questions", "help", "patient questions", "common questions"],
    schema: `{"heading":"","blurb":"","items":[{"q":"","a":""}, ...exactly 6]}`,
    fallback: {
      heading: "Common patient questions",
      blurb: "Straightforward answers about visits, insurance, and what to expect.",
      items: [
        { q: "How do I book an appointment?", a: "Book online or call the front desk. We usually confirm within one business day." },
        { q: "What should I bring?", a: "Photo ID, insurance card, medication list, and any recent records if you have them." },
        { q: "Do you accept my insurance?", a: "We work with many major plans. Call us and we’ll verify benefits before your visit." },
        { q: "Is telehealth available?", a: "Where clinically appropriate, video visits are available for follow-ups and select concerns." },
        { q: "How do I get prescriptions refilled?", a: "Request through the patient portal or your pharmacy. Allow 2–3 business days." },
        { q: "What if I need to cancel?", a: "Please give at least 24 hours notice so we can offer the time to another patient." },
      ],
    },
    render(c) {
      return sectionWrap(`
        <div class="eyebrow">FAQ</div>
        <h2>${esc(c.heading)}</h2>
        <p class="lead">${esc(c.blurb)}</p>
        <div style="margin-top:36px;max-width:760px">
          ${(c.items || []).map((it: any) => `
            <div style="border-bottom:1px solid #eee;padding:22px 0">
              <h3 style="font-size:18px;font-weight:700;margin-bottom:8px">${esc(it.q)}</h3>
              <p style="color:#555">${esc(it.a)}</p>
            </div>`).join("")}
        </div>
      `);
    },
  },
  {
    id: "team",
    label: "Care team",
    description: "Clinicians and staff profiles.",
    aliases: ["team", "providers", "doctors", "clinicians", "staff", "care team", "our doctors"],
    schema: `{"heading":"","blurb":"","members":[{"name":"","role":"","bio":""}, ...exactly 6]}`,
    fallback: {
      heading: "Your care team",
      blurb: "Experienced clinicians who take time to explain options in plain language.",
      members: [
        { name: "Dr. Maya Chen", role: "Family Medicine", bio: "Focuses on preventive care and long-term patient relationships." },
        { name: "Dr. James Okonkwo", role: "Internal Medicine", bio: "Supports adults managing chronic conditions with clear plans." },
        { name: "Dr. Priya Nair", role: "Women’s Health", bio: "Offers thoughtful, respectful care across life stages." },
        { name: "Alex Rivera, NP", role: "Nurse Practitioner", bio: "Same-week visits and follow-up coordination." },
        { name: "Sam Patel, PA-C", role: "Physician Assistant", bio: "Procedures, education, and continuity between visits." },
        { name: "Jordan Lee", role: "Care Coordinator", bio: "Helps with scheduling, referrals, and portal support." },
      ],
    },
    render(c, accent) {
      return sectionWrap(`
        <div class="eyebrow">Care team</div>
        <h2>${esc(c.heading)}</h2>
        <p class="lead">${esc(c.blurb)}</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:22px;margin-top:40px">
          ${(c.members || []).map((m: any) => `
            <div style="border:1px solid #ececec;border-radius:16px;padding:24px">
              <div style="width:48px;height:48px;border-radius:12px;background:${accent};opacity:.2;margin-bottom:14px"></div>
              <h3 style="font-size:18px;font-weight:800">${esc(m.name)}</h3>
              <div style="color:${accent};font-size:13px;font-weight:700;margin:4px 0 10px">${esc(m.role)}</div>
              <p style="color:#666;font-size:14px">${esc(m.bio)}</p>
            </div>`).join("")}
        </div>
      `);
    },
  },
  {
    id: "testimonials",
    label: "Patient stories",
    description: "Respectful patient feedback.",
    aliases: ["testimonials", "reviews", "patient stories", "feedback", "quotes"],
    schema: `{"heading":"","blurb":"","quotes":[{"quote":"","name":"","title":""}, ...exactly 4]}`,
    fallback: {
      heading: "What patients say",
      blurb: "Shared with permission — experiences may vary.",
      quotes: [
        { quote: "They explained every option clearly and never made me feel rushed.", name: "A. M.", title: "Patient" },
        { quote: "Booking was simple and the follow-up call put my mind at ease.", name: "R. K.", title: "Patient" },
        { quote: "The care team treated my family with real kindness.", name: "S. L.", title: "Parent" },
        { quote: "I finally understand my care plan — and how to stick with it.", name: "J. T.", title: "Patient" },
      ],
    },
    render(c, accent) {
      return sectionWrap(`
        <div class="eyebrow">Patient stories</div>
        <h2>${esc(c.heading)}</h2>
        <p class="lead">${esc(c.blurb)}</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-top:40px">
          ${(c.quotes || []).map((q: any) => `
            <blockquote style="background:#f7faf9;border-radius:16px;padding:28px;border-top:3px solid ${accent}">
              <p style="font-size:17px;line-height:1.5;margin-bottom:18px">“${esc(q.quote)}”</p>
              <footer style="font-weight:700">${esc(q.name)} <span style="color:#888;font-weight:500">· ${esc(q.title)}</span></footer>
            </blockquote>`).join("")}
        </div>
      `);
    },
  },
  {
    id: "services",
    label: "Services",
    description: "Care offerings overview.",
    aliases: ["services", "care", "treatments", "what we offer", "programs"],
    schema: `{"heading":"","blurb":"","items":[{"title":"","body":"","price":""}, ...exactly 4]}`,
    fallback: {
      heading: "How we can help",
      blurb: "Clear pathways so you know what to expect before you arrive.",
      items: [
        { title: "Primary visits", body: "Annual exams, sick visits, and ongoing relationship-based care.", price: "Most plans" },
        { title: "Chronic care", body: "Structured follow-up for diabetes, blood pressure, and more.", price: "Care plans" },
        { title: "Prevention", body: "Screenings and counseling tailored to your age and risk factors.", price: "Covered*" },
        { title: "Care coordination", body: "Referrals and records handled with you — not around you.", price: "Included" },
      ],
    },
    render(c, accent) {
      return sectionWrap(`
        <div class="eyebrow">Services</div>
        <h2>${esc(c.heading)}</h2>
        <p class="lead">${esc(c.blurb)}</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin-top:40px">
          ${(c.items || []).map((it: any) => `
            <div style="border:1px solid #ececec;border-radius:16px;padding:26px">
              <div style="font-family:${MONO};font-size:12px;color:${accent};font-weight:700;letter-spacing:.08em">${esc(it.price)}</div>
              <h3 style="font-size:20px;font-weight:800;margin:10px 0 8px">${esc(it.title)}</h3>
              <p style="color:#555">${esc(it.body)}</p>
            </div>`).join("")}
        </div>
      `);
    },
  },
  {
    id: "booking",
    label: "Appointments",
    description: "Scheduling and visit prep.",
    aliases: ["booking", "book", "appointment", "appointments", "schedule", "reserve"],
    schema: `{"heading":"","blurb":"","hours":"","note":"","cta":""}`,
    fallback: {
      heading: "Book an appointment",
      blurb: "Choose a time that works. We’ll confirm and send prep instructions.",
      hours: "Mon–Fri 8am–6pm · Sat 9am–1pm",
      note: "For emergencies, call your local emergency number or go to the nearest ER.",
      cta: "Request an appointment",
    },
    render(c) {
      return sectionWrap(`
        <div class="eyebrow">Appointments</div>
        <h2>${esc(c.heading)}</h2>
        <p class="lead">${esc(c.blurb)}</p>
        <div style="margin-top:28px;background:#f7faf9;border-radius:16px;padding:28px;max-width:520px;display:grid;gap:12px">
          <div><strong>Hours</strong><br>${esc(c.hours)}</div>
          <div style="color:#666">${esc(c.note)}</div>
          <a class="btn" href="contact.html">${esc(c.cta)}</a>
        </div>
      `);
    },
  },
  {
    id: "privacy",
    label: "Privacy",
    description: "Patient privacy overview.",
    aliases: ["privacy", "hipaa", "privacy policy", "patient privacy", "confidentiality"],
    schema: `{"heading":"","sections":[{"title":"","body":""}, ...exactly 4]}`,
    fallback: {
      heading: "Your privacy matters",
      sections: [
        { title: "Protected health information", body: "We handle medical and contact information according to applicable privacy laws and our notice of privacy practices." },
        { title: "How we use information", body: "To provide care, coordinate with other clinicians you authorize, bill insurance, and improve our services." },
        { title: "Sharing", body: "We do not sell patient data. Disclosures follow law and your written authorizations where required." },
        { title: "Your rights", body: "You may request access, corrections, and restrictions. Contact our privacy officer for details." },
      ],
    },
    render(c) {
      return sectionWrap(`
        <div class="eyebrow">Privacy</div>
        <h2>${esc(c.heading)}</h2>
        <div style="max-width:720px;margin-top:28px;display:grid;gap:28px">
          ${(c.sections || []).map((s: any) => `
            <div>
              <h3 style="font-size:18px;font-weight:800;margin-bottom:8px">${esc(s.title)}</h3>
              <p style="color:#555;line-height:1.7">${esc(s.body)}</p>
            </div>`).join("")}
        </div>
      `);
    },
  },
  {
    id: "insurance",
    label: "Insurance",
    description: "Plans and billing info.",
    aliases: ["insurance", "billing", "payment", "plans", "coverage"],
    schema: `{"heading":"","blurb":"","plans":["","","",""],"notes":["","",""]}`,
    fallback: {
      heading: "Insurance & billing",
      blurb: "We’ll help you understand coverage before your visit whenever possible.",
      plans: ["Most major PPO plans", "Medicare (select services)", "Medicaid (select services)", "Self-pay options"],
      notes: [
        "Bring your insurance card to every visit.",
        "Copays are due at check-in.",
        "Ask us about estimates for common procedures.",
      ],
    },
    render(c, accent) {
      return sectionWrap(`
        <div class="eyebrow">Insurance</div>
        <h2>${esc(c.heading)}</h2>
        <p class="lead">${esc(c.blurb)}</p>
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:28px">
          ${(c.plans || []).map((p: string) => `<span style="border:1px solid #d5e4de;background:#fff;padding:10px 16px;border-radius:999px;font-weight:600;font-size:14px">${esc(p)}</span>`).join("")}
        </div>
        <ul style="margin-top:32px;max-width:640px;color:#555;line-height:1.7;padding-left:18px">
          ${(c.notes || []).map((n: string) => `<li style="margin-bottom:8px">${esc(n)}</li>`).join("")}
        </ul>
        <div style="margin-top:28px"><a class="btn" href="contact.html">Ask about your plan</a></div>
      `);
    },
  },
  {
    id: "blog",
    label: "Health tips",
    description: "Educational articles (non-diagnostic).",
    aliases: ["blog", "articles", "health tips", "education", "resources", "news"],
    schema: `{"heading":"","blurb":"","posts":[{"title":"","category":"","excerpt":"","date":""}, ...exactly 6]}`,
    fallback: {
      heading: "Health tips & resources",
      blurb: "Educational reading — not a substitute for medical advice. Talk with your clinician about your situation.",
      posts: [
        { title: "Preparing for your annual checkup", category: "Prevention", excerpt: "What to bring and questions worth asking.", date: "Mar 2026" },
        { title: "Understanding blood pressure numbers", category: "Wellness", excerpt: "A plain-language guide to readings and next steps.", date: "Feb 2026" },
        { title: "When to choose urgent care vs. ER", category: "Guidance", excerpt: "Practical cues for common situations.", date: "Jan 2026" },
        { title: "Medication refill checklist", category: "Pharmacy", excerpt: "Avoid gaps by planning a few days ahead.", date: "Dec 2025" },
        { title: "Sleep habits that support recovery", category: "Lifestyle", excerpt: "Small routines clinicians often recommend.", date: "Nov 2025" },
        { title: "How patient portals keep care connected", category: "Digital", excerpt: "Messages, results, and visit summaries in one place.", date: "Oct 2025" },
      ],
    },
    render(c, accent) {
      return sectionWrap(`
        <div class="eyebrow">Resources</div>
        <h2>${esc(c.heading)}</h2>
        <p class="lead">${esc(c.blurb)}</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:2px;background:#eee;margin-top:40px;border-radius:14px;overflow:hidden">
          ${(c.posts || []).map((p: any) => `
            <article style="background:#fff;padding:28px">
              <div style="font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${accent};font-weight:700">${esc(p.category)} · ${esc(p.date)}</div>
              <h3 style="font-size:20px;font-weight:800;margin:10px 0 8px;letter-spacing:-.02em">${esc(p.title)}</h3>
              <p style="color:#666;font-size:15px">${esc(p.excerpt)}</p>
            </article>`).join("")}
        </div>
      `);
    },
  },
  {
    id: "careers",
    label: "Careers",
    description: "Join the care team.",
    aliases: ["careers", "jobs", "hiring", "join us", "open roles"],
    schema: `{"heading":"","blurb":"","roles":[{"title":"","location":"","type":"","blurb":""}, ...exactly 4]}`,
    fallback: {
      heading: "Join our care team",
      blurb: "We’re looking for people who bring skill and kindness to every patient interaction.",
      roles: [
        { title: "Registered Nurse", location: "On-site", type: "Full-time", blurb: "Clinic nursing with room to mentor." },
        { title: "Medical Assistant", location: "On-site", type: "Full-time", blurb: "Rooming, vitals, and patient flow." },
        { title: "Front Desk Coordinator", location: "On-site", type: "Full-time", blurb: "Scheduling and first impressions." },
        { title: "Billing Specialist", location: "Hybrid", type: "Full-time", blurb: "Claims accuracy and patient clarity." },
      ],
    },
    render(c, accent) {
      return sectionWrap(`
        <div class="eyebrow">Careers</div>
        <h2>${esc(c.heading)}</h2>
        <p class="lead">${esc(c.blurb)}</p>
        <div style="margin-top:36px;display:grid;gap:14px;max-width:820px">
          ${(c.roles || []).map((r: any) => `
            <div style="display:flex;justify-content:space-between;gap:20px;align-items:center;border:1px solid #ececec;border-radius:14px;padding:22px 24px;flex-wrap:wrap">
              <div>
                <h3 style="font-size:18px;font-weight:800">${esc(r.title)}</h3>
                <div style="color:#888;font-size:14px;margin-top:4px">${esc(r.location)} · ${esc(r.type)}</div>
                <p style="color:#555;margin-top:8px;font-size:15px">${esc(r.blurb)}</p>
              </div>
              <a class="btn" href="contact.html">Apply</a>
            </div>`).join("")}
        </div>
      `);
    },
  },
];

export function findPageDesign(query: string): PageDesign | undefined {
  const q = query.toLowerCase().trim().replace(/\s+/g, " ");
  if (!q) return undefined;

  for (const d of PAGE_DESIGNS) {
    if (q === d.id || q === d.label.toLowerCase()) return d;
  }

  let best: { design: PageDesign; score: number } | undefined;

  for (const d of PAGE_DESIGNS) {
    for (const alias of d.aliases) {
      const a = alias.toLowerCase();
      if (q === a) return d;
      const wordMatch = new RegExp(`\\b${escapeRegExp(a)}\\b`, "i").test(q);
      if (wordMatch || (a.length >= 4 && q.includes(a))) {
        const score = a.length;
        if (!best || score > best.score) best = { design: d, score };
      }
    }
  }

  return best?.design;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isCatalogDesignId(id: string): boolean {
  return PAGE_DESIGNS.some((d) => d.id === id);
}

export function isLayoutDesignId(id: string): boolean {
  return DESIGN_OPTIONS.some((d) => d.id === id);
}

export function getPageDesign(id: string): PageDesign | undefined {
  return PAGE_DESIGNS.find((d) => d.id === id);
}

export function slugForPage(key: string): string {
  return key === "home" ? "index.html" : `${key}.html`;
}
