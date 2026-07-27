import type { Template } from "./types";
import { esc, MONO, SANS, DISPLAY } from "./render";

export const EXTRA_TEMPLATES: Template[] = [
  /* ---------- 1. Marketing agency — Atelier ---------- */
  {
    id: "agency",
    name: "Atelier",
    category: "Marketing agency",
    tagline: "Editorial brand site for studios that lead with craft.",
    font: DISPLAY,
    previewImage:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
    previewAccent: "#C45C26",
    pages: [
      { key: "home", label: "Home", slug: "index.html" },
      { key: "work", label: "Work", slug: "work.html" },
      { key: "services", label: "Services", slug: "services.html" },
      { key: "about", label: "About", slug: "about.html" },
      { key: "contact", label: "Contact", slug: "contact.html" },
    ],
    availablePageDesigns: [
      "about",
      "blog",
      "team",
      "testimonials",
      "careers",
      "gallery",
      "services",
      "privacy",
    ],
    schema: `{
 "hero":{"title":"","subtitle":"","ctaText":""},
 "capabilities":[{"title":"","body":""},{"title":"","body":""},{"title":"","body":""}],
 "work":[{"title":"","client":"","blurb":"","year":""}, ...exactly 6 items],
 "services":[{"name":"","desc":"","deliverables":["","",""]}, ...exactly 4 items],
 "about":{"heading":"","body":"","values":["","",""]},
 "contact":{"heading":"","blurb":"","email":"","phone":"","city":""}
}`,
    fallback: {
      hero: {
        title: "Brands built with intention",
        subtitle:
          "Atelier is a strategy-led creative studio for companies ready to look as sharp as they operate.",
        ctaText: "View selected work",
      },
      capabilities: [
        { title: "Brand systems", body: "Naming, identity, and guidelines that hold up in the wild." },
        { title: "Campaigns", body: "Launches and always-on stories that earn attention." },
        { title: "Digital craft", body: "Sites and product surfaces with editorial discipline." },
      ],
      work: [
        { title: "Northline", client: "Climate fintech", blurb: "Full rebrand and product marketing site.", year: "2025" },
        { title: "Fold Studio", client: "Architecture", blurb: "Identity and print system for a coastal practice.", year: "2025" },
        { title: "Keel", client: "Logistics", blurb: "Campaign and landing experience for a Series B raise.", year: "2024" },
        { title: "Lumen Press", client: "Publishing", blurb: "Editorial design language across web and print.", year: "2024" },
        { title: "Basin Goods", client: "Retail", blurb: "E-commerce redesign with a quiet luxury feel.", year: "2023" },
        { title: "Harbor Co.", client: "Hospitality", blurb: "Brand and booking site for a boutique inn.", year: "2023" },
      ],
      services: [
        { name: "Brand strategy", desc: "Positioning, audience, and narrative before a single pixel.", deliverables: ["Workshops", "Messaging map", "Tone guide"] },
        { name: "Identity design", desc: "Marks, typography, and systems built to scale.", deliverables: ["Logo suite", "Color & type", "Guidelines"] },
        { name: "Campaign creative", desc: "Concepts that travel from pitch to paid media.", deliverables: ["Concept boards", "Asset kits", "Motion"] },
        { name: "Web experiences", desc: "Marketing sites with clarity, pace, and craft.", deliverables: ["IA & copy", "Design", "Front-end"] },
      ],
      about: {
        heading: "A small studio, deliberate output",
        body: "We partner with a handful of clients at a time — founders and brand leads who want work that feels considered, not templated.",
        values: ["Strategy before spectacle", "Fewer projects, deeper craft", "Systems that survive growth"],
      },
      contact: {
        heading: "Start a conversation",
        blurb: "Tell us what you're building and the timeline you're working toward.",
        email: "hello@atelier.studio",
        phone: "+1 (555) 410-2200",
        city: "Portland · Remote",
      },
    },
    render(c, accent, brand, pageKey) {
      const home = () => `
        <section class="wrap" style="padding-top:100px;display:grid;grid-template-columns:1.2fr .8fr;gap:48px;align-items:end">
          <div>
            <div class="eyebrow">${esc(brand)}</div>
            <h1 style="font-family:${DISPLAY};max-width:14ch">${esc(c.hero.title)}</h1>
            <p class="lead" style="margin-top:22px">${esc(c.hero.subtitle)}</p>
            <div style="margin-top:32px"><a class="btn" href="work.html">${esc(c.hero.ctaText)}</a></div>
          </div>
          <div style="background:linear-gradient(160deg,${accent}18,#f4f0eb);min-height:320px;border-radius:4px 48px 4px 48px;padding:36px;display:flex;flex-direction:column;justify-content:flex-end">
            <div style="font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${accent};font-weight:700;margin-bottom:12px">Capabilities</div>
            ${c.capabilities.map((cap: any) => `<div style="padding:14px 0;border-top:1px solid ${accent}33"><div style="font-weight:700;font-size:17px">${esc(cap.title)}</div><div style="color:#666;font-size:14px;margin-top:4px">${esc(cap.body)}</div></div>`).join("")}
          </div>
        </section>
        <section class="wrap" style="padding-top:40px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:20px;flex-wrap:wrap;margin-bottom:28px">
            <h2 style="margin:0;font-family:${DISPLAY}">Selected work</h2>
            <a href="work.html" style="font-weight:700;color:${accent}">All projects →</a>
          </div>
          <div style="display:grid;gap:0;border-top:1px solid #e5e5e5">
            ${c.work.slice(0, 3).map((w: any) => `<a href="work.html" style="display:grid;grid-template-columns:1fr 140px 80px;gap:20px;padding:28px 0;border-bottom:1px solid #e5e5e5;align-items:center"><div><div style="font-size:24px;font-weight:700;letter-spacing:-.02em;font-family:${DISPLAY}">${esc(w.title)}</div><div style="color:#777;margin-top:4px">${esc(w.blurb)}</div></div><div style="font-family:${MONO};font-size:12px;color:#888">${esc(w.client)}</div><div style="text-align:right;font-family:${MONO};font-size:12px;color:${accent}">${esc(w.year)}</div></a>`).join("")}
          </div>
        </section>`;
      const work = () => `
        <section class="wrap"><div class="eyebrow">Portfolio</div>
          <h2 style="font-family:${DISPLAY}">Work that holds up</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-top:40px">
            ${c.work.map((w: any, i: number) => `<div style="background:${i % 2 === 0 ? "#f7f4f0" : "#1a1a1a"};color:${i % 2 === 0 ? "#1a1a1a" : "#f7f4f0"};padding:36px 28px;min-height:220px;display:flex;flex-direction:column;justify-content:space-between"><div><div style="font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.7;margin-bottom:10px">${esc(w.client)} · ${esc(w.year)}</div><h3 style="font-size:26px;font-family:${DISPLAY};font-weight:700;letter-spacing:-.02em">${esc(w.title)}</h3></div><p style="opacity:.75;margin-top:16px">${esc(w.blurb)}</p></div>`).join("")}
          </div></section>`;
      const services = () => `
        <section class="wrap"><div class="eyebrow">Services</div>
          <h2 style="font-family:${DISPLAY}">How we partner</h2>
          <div style="margin-top:44px;display:grid;gap:2px;background:#e8e4df">
            ${c.services.map((s: any, i: number) => `<div style="background:#fff;padding:36px 32px;display:grid;grid-template-columns:80px 1fr 1fr;gap:28px;align-items:start"><div style="font-family:${MONO};font-size:28px;font-weight:700;color:${accent}">0${i + 1}</div><div><h3 style="font-size:22px;font-family:${DISPLAY};margin-bottom:8px">${esc(s.name)}</h3><p style="color:#555">${esc(s.desc)}</p></div><ul style="list-style:none">${s.deliverables.map((d: string) => `<li style="padding:6px 0;border-bottom:1px solid #eee;font-size:14px;font-weight:600">— ${esc(d)}</li>`).join("")}</ul></div>`).join("")}
          </div></section>`;
      const about = () => `
        <section class="wrap" style="max-width:720px"><div class="eyebrow">About</div>
          <h2 style="font-family:${DISPLAY}">${esc(c.about.heading)}</h2>
          <p class="lead" style="font-size:22px;margin-top:8px">${esc(c.about.body)}</p>
          <div style="margin-top:48px;display:grid;gap:18px">${c.about.values.map((v: string) => `<div style="display:flex;gap:16px;align-items:center;padding:18px 0;border-bottom:1px solid #eee"><span style="width:10px;height:10px;border-radius:50%;background:${accent};flex-shrink:0"></span><span style="font-size:18px;font-weight:600">${esc(v)}</span></div>`).join("")}</div>
        </section>`;
      const contact = () => `
        <section class="wrap" style="max-width:680px;padding-top:110px"><div class="eyebrow">Contact</div>
          <h2 style="font-family:${DISPLAY};font-size:clamp(32px,5vw,52px)">${esc(c.contact.heading)}</h2>
          <p class="lead" style="margin:18px 0 36px">${esc(c.contact.blurb)}</p>
          <div style="display:grid;gap:22px;padding:32px;background:#1a1a1a;color:#f5f0eb;border-radius:4px">
            <div><div style="font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.55;margin-bottom:6px">Email</div><a style="color:${accent};font-size:20px;font-weight:700" href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></div>
            <div><div style="font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.55;margin-bottom:6px">Phone</div>${esc(c.contact.phone)}</div>
            <div><div style="font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.55;margin-bottom:6px">Studio</div>${esc(c.contact.city)}</div>
          </div></section>`;
      const map: Record<string, () => string> = { home, work, services, about, contact };
      return (map[pageKey] || home)();
    },
  },

  /* ---------- 2. Medical / clinic — Willow Health ---------- */
  {
    id: "clinic",
    name: "Willow Health",
    category: "Medical / clinic",
    tagline: "Calm, trustworthy clinic site with care pathways.",
    font: SANS,
    previewImage:
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80",
    previewAccent: "#2F6F5E",
    pages: [
      { key: "home", label: "Home", slug: "index.html" },
      { key: "services", label: "Services", slug: "services.html" },
      { key: "doctors", label: "Doctors", slug: "doctors.html" },
      { key: "patients", label: "Patients", slug: "patients.html" },
      { key: "contact", label: "Contact", slug: "contact.html" },
    ],
    availablePageDesigns: [
      "about",
      "faq",
      "team",
      "testimonials",
      "services",
      "booking",
      "privacy",
    ],
    schema: `{
 "hero":{"title":"","subtitle":"","ctaText":""},
 "highlights":[{"value":"","label":""},{"value":"","label":""},{"value":"","label":""}],
 "services":[{"name":"","desc":"","wait":""}, ...exactly 5 items],
 "doctors":[{"name":"","role":"","focus":"","bio":""}, ...exactly 4 items],
 "patients":{"heading":"","blurb":"","steps":[{"title":"","body":""},{"title":"","body":""},{"title":"","body":""}],"insurance":["","",""]},
 "contact":{"heading":"","blurb":"","email":"","phone":"","address":"","hours":""}
}`,
    fallback: {
      hero: {
        title: "Care that feels personal",
        subtitle:
          "Willow Health is a neighborhood clinic for primary care, wellness, and same-week visits — without the rushed feel.",
        ctaText: "Book a visit",
      },
      highlights: [
        { value: "Same week", label: "typical appointments" },
        { value: "18 min", label: "average visit length" },
        { value: "4.9★", label: "patient rating" },
      ],
      services: [
        { name: "Primary care", desc: "Ongoing relationships for adults and families.", wait: "New patients welcome" },
        { name: "Preventive wellness", desc: "Annual exams, screenings, and lifestyle coaching.", wait: "Book online" },
        { name: "Women's health", desc: "Thoughtful care across every life stage.", wait: "2–5 day wait" },
        { name: "Mental health", desc: "Integrated counseling referrals and follow-up.", wait: "Care team guided" },
        { name: "Urgent same-day", desc: "Sick visits when you need them most.", wait: "Call by 10am" },
      ],
      doctors: [
        { name: "Dr. Maya Chen", role: "Family Medicine", focus: "Adults & families", bio: "Believes good medicine starts with listening carefully." },
        { name: "Dr. James Okonkwo", role: "Internal Medicine", focus: "Chronic care", bio: "Partners with patients managing complex conditions." },
        { name: "Dr. Priya Nair", role: "Women's Health", focus: "Preventive care", bio: "Brings clarity and calm to every visit." },
        { name: "Dr. Eli Rosen", role: "Sports Medicine", focus: "Injury & recovery", bio: "Helps active patients heal and return stronger." },
      ],
      patients: {
        heading: "Your first visit, simplified",
        blurb: "We designed the patient journey to remove friction — from booking to follow-up.",
        steps: [
          { title: "Book online or call", body: "Choose a time that fits; we'll confirm within the hour." },
          { title: "Complete forms once", body: "Secure portal saves your history for every visit." },
          { title: "See your care team", body: "Arrive 10 minutes early; parking is free on Willow Ave." },
        ],
        insurance: ["Most major PPO plans", "Medicare accepted", "Self-pay options available"],
      },
      contact: {
        heading: "We're here when you need us",
        blurb: "Questions about insurance, records, or scheduling? Reach the front desk anytime.",
        email: "care@willowhealth.clinic",
        phone: "+1 (555) 330-1180",
        address: "420 Willow Avenue, Suite 200",
        hours: "Mon–Fri 8am–6pm · Sat 9am–1pm",
      },
    },
    render(c, accent, brand, pageKey) {
      const home = () => `
        <section style="background:linear-gradient(180deg,#f3f8f6 0%,#fff 70%);padding:100px 0 60px">
          <div class="wrap" style="text-align:center">
            <div class="eyebrow">${esc(brand)}</div>
            <h1 style="max-width:16ch;margin:0 auto">${esc(c.hero.title)}</h1>
            <p class="lead" style="margin:22px auto 0">${esc(c.hero.subtitle)}</p>
            <div style="margin-top:30px"><a class="btn" href="contact.html">${esc(c.hero.ctaText)}</a></div>
            <div style="display:flex;justify-content:center;gap:48px;flex-wrap:wrap;margin-top:64px;padding-top:36px;border-top:1px solid ${accent}22">
              ${c.highlights.map((h: any) => `<div><div style="font-size:32px;font-weight:800;color:${accent};letter-spacing:-.02em">${esc(h.value)}</div><div style="color:#6a7a74;font-size:14px;margin-top:4px">${esc(h.label)}</div></div>`).join("")}
            </div>
          </div>
        </section>
        <section class="wrap" style="padding-top:48px">
          <div class="eyebrow">Care pathways</div><h2>Services at a glance</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:28px">
            ${c.services.slice(0, 4).map((s: any) => `<a href="services.html" style="padding:24px 20px;border:1px solid #e2ebe7;border-radius:16px;background:#fff"><div style="font-weight:700;font-size:17px;margin-bottom:6px">${esc(s.name)}</div><div style="color:#5c6b65;font-size:14px">${esc(s.desc)}</div></a>`).join("")}
          </div>
        </section>`;
      const services = () => `
        <section class="wrap"><div class="eyebrow">Services</div><h2>Whole-person care</h2>
          <div style="margin-top:36px;display:grid;gap:14px">
            ${c.services.map((s: any) => `<div style="display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;padding:28px 26px;background:#f6faf8;border-radius:18px;border-left:4px solid ${accent}"><div><h3 style="font-size:20px;font-weight:700;margin-bottom:6px">${esc(s.name)}</h3><p style="color:#55635d">${esc(s.desc)}</p></div><div style="font-family:${MONO};font-size:12px;font-weight:700;color:${accent};white-space:nowrap">${esc(s.wait)}</div></div>`).join("")}
          </div></section>`;
      const doctors = () => `
        <section class="wrap"><div class="eyebrow">Care team</div><h2>Meet your doctors</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:22px;margin-top:40px">
            ${c.doctors.map((d: any) => `<div style="padding:0 0 28px"><div style="height:8px;background:${accent};border-radius:8px 8px 0 0;margin-bottom:20px"></div><div style="font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${accent};font-weight:700">${esc(d.role)}</div><h3 style="font-size:22px;font-weight:800;margin:8px 0 4px">${esc(d.name)}</h3><div style="color:#6a7a74;font-size:14px;margin-bottom:12px">${esc(d.focus)}</div><p style="color:#444;font-size:15px">${esc(d.bio)}</p></div>`).join("")}
          </div></section>`;
      const patients = () => `
        <section class="wrap"><div class="eyebrow">For patients</div><h2>${esc(c.patients.heading)}</h2>
          <p class="lead">${esc(c.patients.blurb)}</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;margin-top:40px">
            ${c.patients.steps.map((st: any, i: number) => `<div style="padding:28px 24px;background:#fff;border:1px solid #e2ebe7;border-radius:16px"><div style="width:36px;height:36px;border-radius:50%;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;margin-bottom:14px">${i + 1}</div><h3 style="font-size:18px;font-weight:700;margin-bottom:8px">${esc(st.title)}</h3><p style="color:#55635d;font-size:15px">${esc(st.body)}</p></div>`).join("")}
          </div>
          <div style="margin-top:48px;padding:28px;background:#f6faf8;border-radius:16px">
            <div style="font-family:${MONO};font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${accent};font-weight:700;margin-bottom:14px">Insurance</div>
            <div style="display:flex;flex-wrap:wrap;gap:12px">${c.patients.insurance.map((ins: string) => `<span style="background:#fff;border:1px solid #d5e4de;padding:10px 16px;border-radius:100px;font-size:14px;font-weight:600">${esc(ins)}</span>`).join("")}</div>
          </div></section>`;
      const contact = () => `
        <section class="wrap" style="max-width:700px"><div class="eyebrow">Contact</div><h2>${esc(c.contact.heading)}</h2>
          <p class="lead" style="margin-bottom:28px">${esc(c.contact.blurb)}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div style="padding:24px;background:#f6faf8;border-radius:14px"><strong>Phone</strong><br>${esc(c.contact.phone)}</div>
            <div style="padding:24px;background:#f6faf8;border-radius:14px"><strong>Email</strong><br><a style="color:${accent}" href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></div>
            <div style="padding:24px;background:#f6faf8;border-radius:14px"><strong>Address</strong><br>${esc(c.contact.address)}</div>
            <div style="padding:24px;background:#f6faf8;border-radius:14px"><strong>Hours</strong><br>${esc(c.contact.hours)}</div>
          </div></section>`;
      const map: Record<string, () => string> = { home, services, doctors, patients, contact };
      return (map[pageKey] || home)();
    },
  },

  /* ---------- 3. E-commerce — Meridian Shop ---------- */
  {
    id: "ecommerce",
    name: "Meridian Shop",
    category: "E-commerce",
    tagline: "Product-forward storefront with clean commerce pages.",
    font: SANS,
    previewImage:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
    previewAccent: "#1A5F4A",
    pages: [
      { key: "home", label: "Home", slug: "index.html" },
      { key: "shop", label: "Shop", slug: "shop.html" },
      { key: "product", label: "Product", slug: "product.html" },
      { key: "about", label: "About", slug: "about.html" },
      { key: "contact", label: "Contact", slug: "contact.html" },
    ],
    availablePageDesigns: [
      "about",
      "blog",
      "faq",
      "testimonials",
      "gallery",
      "services",
      "privacy",
    ],
    schema: `{
 "hero":{"title":"","subtitle":"","ctaText":""},
 "featured":[{"name":"","price":"","tag":"","blurb":""}, ...exactly 4 items],
 "shop":[{"name":"","price":"","category":"","blurb":""}, ...exactly 8 items],
 "product":{"name":"","price":"","tagline":"","description":"","details":["","",""],"ctaText":""},
 "about":{"heading":"","body":"","pillars":["","",""]},
 "contact":{"heading":"","blurb":"","email":"","supportHours":""}
}`,
    fallback: {
      hero: {
        title: "Objects made for daily ritual",
        subtitle:
          "Meridian Shop curates apparel, home goods, and tools designed to last — quietly premium, never loud.",
        ctaText: "Shop the collection",
      },
      featured: [
        { name: "Linen field shirt", price: "$128", tag: "New", blurb: "Stone-washed, relaxed fit." },
        { name: "Ceramic pour-over", price: "$64", tag: "Bestseller", blurb: "Hand-thrown in small batches." },
        { name: "Wool travel throw", price: "$180", tag: "Limited", blurb: "Undyed merino, soft edge." },
        { name: "Walnut desk tray", price: "$72", tag: "Home", blurb: "Solid wood, oiled finish." },
      ],
      shop: [
        { name: "Linen field shirt", price: "$128", category: "Apparel", blurb: "Relaxed everyday layer." },
        { name: "Canvas work apron", price: "$86", category: "Apparel", blurb: "Waxed cotton, brass hardware." },
        { name: "Ceramic pour-over", price: "$64", category: "Kitchen", blurb: "Matte glaze, drip-ready." },
        { name: "Stoneware bowl set", price: "$96", category: "Kitchen", blurb: "Set of four nesting bowls." },
        { name: "Wool travel throw", price: "$180", category: "Home", blurb: "Packable warmth." },
        { name: "Walnut desk tray", price: "$72", category: "Home", blurb: "Organize the essentials." },
        { name: "Brass desk lamp", price: "$210", category: "Lighting", blurb: "Warm directional light." },
        { name: "Day tote", price: "$118", category: "Bags", blurb: "Structured canvas carryall." },
      ],
      product: {
        name: "Ceramic pour-over",
        price: "$64",
        tagline: "A quieter morning ritual",
        description:
          "Hand-thrown stoneware with a matte glaze that softens with use. Designed for a steady drip and an easy clean.",
        details: ["Dishwasher safe", "Fits standard filters", "Made in small kiln batches"],
        ctaText: "Add to bag",
      },
      about: {
        heading: "Fewer things, chosen well",
        body: "Meridian partners with makers who obsess over materials and longevity. Every piece earns its place on the shelf.",
        pillars: ["Responsible materials", "Small-batch makers", "Repair-friendly design"],
      },
      contact: {
        heading: "We're happy to help",
        blurb: "Orders, returns, and product questions — our team replies within one business day.",
        email: "hello@meridianshop.co",
        supportHours: "Mon–Fri, 9am–5pm PT",
      },
    },
    render(c, accent, brand, pageKey) {
      const home = () => `
        <section class="wrap" style="padding-top:96px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center">
            <div>
              <div class="eyebrow">${esc(brand)}</div>
              <h1 style="max-width:12ch">${esc(c.hero.title)}</h1>
              <p class="lead" style="margin-top:20px">${esc(c.hero.subtitle)}</p>
              <div style="margin-top:28px"><a class="btn" href="shop.html">${esc(c.hero.ctaText)}</a></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              ${c.featured.map((f: any, i: number) => `<a href="product.html" style="background:${i === 0 || i === 3 ? accent : "#f0ebe3"};color:${i === 0 || i === 3 ? "#fff" : "#1a1a1a"};padding:24px 20px;min-height:140px;display:flex;flex-direction:column;justify-content:space-between"><div style="font-family:${MONO};font-size:11px;letter-spacing:.1em;text-transform:uppercase;opacity:.8">${esc(f.tag)}</div><div><div style="font-weight:700;font-size:16px">${esc(f.name)}</div><div style="margin-top:4px;font-weight:600;opacity:.85">${esc(f.price)}</div></div></a>`).join("")}
            </div>
          </div>
        </section>`;
      const shop = () => `
        <section class="wrap"><div class="eyebrow">Shop</div><h2>The collection</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:28px 20px;margin-top:40px">
            ${c.shop.map((p: any) => `<a href="product.html" style="display:block"><div style="aspect-ratio:4/5;background:linear-gradient(145deg,#ebe6de,#d9d2c6);margin-bottom:14px;border-radius:2px"></div><div style="font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#888;margin-bottom:4px">${esc(p.category)}</div><div style="font-weight:700;font-size:17px">${esc(p.name)}</div><div style="display:flex;justify-content:space-between;margin-top:6px;color:#555;font-size:14px"><span>${esc(p.blurb)}</span><span style="font-weight:700;color:${accent}">${esc(p.price)}</span></div></a>`).join("")}
          </div></section>`;
      const product = () => `
        <section class="wrap" style="padding-top:96px;display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:start">
          <div style="aspect-ratio:1;background:linear-gradient(160deg,#e8e2d8 0%,#cfc6b8 100%);border-radius:2px"></div>
          <div>
            <div class="eyebrow">Featured</div>
            <h1 style="font-size:clamp(28px,4vw,42px)">${esc(c.product.name)}</h1>
            <div style="font-size:28px;font-weight:800;color:${accent};margin:12px 0 8px">${esc(c.product.price)}</div>
            <p style="font-size:18px;color:#555;margin-bottom:20px">${esc(c.product.tagline)}</p>
            <p style="color:#444;line-height:1.7;margin-bottom:24px">${esc(c.product.description)}</p>
            <ul style="list-style:none;margin-bottom:32px">${c.product.details.map((d: string) => `<li style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600">✓ ${esc(d)}</li>`).join("")}</ul>
            <a class="btn" href="contact.html">${esc(c.product.ctaText)}</a>
          </div>
        </section>`;
      const about = () => `
        <section class="wrap" style="max-width:680px"><div class="eyebrow">About</div>
          <h2>${esc(c.about.heading)}</h2>
          <p class="lead" style="font-size:20px">${esc(c.about.body)}</p>
          <div style="margin-top:40px;display:grid;gap:0;border-top:1px solid #e5e5e5">
            ${c.about.pillars.map((p: string) => `<div style="padding:22px 0;border-bottom:1px solid #e5e5e5;font-size:18px;font-weight:700;display:flex;gap:14px;align-items:center"><span style="width:28px;height:2px;background:${accent}"></span>${esc(p)}</div>`).join("")}
          </div></section>`;
      const contact = () => `
        <section class="wrap" style="max-width:560px"><div class="eyebrow">Support</div>
          <h2>${esc(c.contact.heading)}</h2>
          <p class="lead" style="margin-bottom:28px">${esc(c.contact.blurb)}</p>
          <div style="padding:28px;border:1px solid #e5e5e5;border-radius:4px">
            <div style="margin-bottom:16px"><strong>Email</strong><br><a style="color:${accent}" href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></div>
            <div><strong>Hours</strong><br>${esc(c.contact.supportHours)}</div>
          </div></section>`;
      const map: Record<string, () => string> = { home, shop, product, about, contact };
      return (map[pageKey] || home)();
    },
  },

  /* ---------- 4. Real estate — Harbor Homes ---------- */
  {
    id: "realestate",
    name: "Harbor Homes",
    category: "Real estate",
    tagline: "Coastal brokerage site for listings and neighborhoods.",
    font: DISPLAY,
    previewImage:
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
    previewAccent: "#2C4A6E",
    pages: [
      { key: "home", label: "Home", slug: "index.html" },
      { key: "listings", label: "Listings", slug: "listings.html" },
      { key: "neighborhoods", label: "Neighborhoods", slug: "neighborhoods.html" },
      { key: "agents", label: "Agents", slug: "agents.html" },
      { key: "contact", label: "Contact", slug: "contact.html" },
    ],
    availablePageDesigns: [
      "about",
      "blog",
      "team",
      "testimonials",
      "gallery",
      "services",
      "booking",
      "privacy",
    ],
    schema: `{
 "hero":{"title":"","subtitle":"","ctaText":""},
 "stats":[{"value":"","label":""},{"value":"","label":""},{"value":"","label":""}],
 "listings":[{"address":"","price":"","beds":"","baths":"","sqft":"","tag":""}, ...exactly 6 items],
 "neighborhoods":[{"name":"","blurb":"","vibe":""}, ...exactly 4 items],
 "agents":[{"name":"","title":"","focus":"","phone":""}, ...exactly 4 items],
 "contact":{"heading":"","blurb":"","email":"","phone":"","office":""}
}`,
    fallback: {
      hero: {
        title: "Homes with a water view mindset",
        subtitle:
          "Harbor Homes helps buyers and sellers along the coast find places that feel like belonging — not just square footage.",
        ctaText: "Browse listings",
      },
      stats: [
        { value: "$2.1B", label: "career volume" },
        { value: "320+", label: "homes sold" },
        { value: "12 days", label: "avg. on market" },
      ],
      listings: [
        { address: "18 Driftwood Lane", price: "$1.85M", beds: "4", baths: "3", sqft: "2,840", tag: "Open Sunday" },
        { address: "9 Harbor Court", price: "$1.24M", beds: "3", baths: "2.5", sqft: "2,100", tag: "New" },
        { address: "44 Seabright Ave", price: "$2.40M", beds: "5", baths: "4", sqft: "3,620", tag: "Waterfront" },
        { address: "7 Cove Place", price: "$980K", beds: "2", baths: "2", sqft: "1,480", tag: "Pending" },
        { address: "112 Cliffside Rd", price: "$3.15M", beds: "4", baths: "3.5", sqft: "3,200", tag: "View lot" },
        { address: "3 Lighthouse Way", price: "$1.52M", beds: "3", baths: "3", sqft: "2,250", tag: "Reduced" },
      ],
      neighborhoods: [
        { name: "Seabright", blurb: "Walkable streets, cafés, and morning fog.", vibe: "Village energy" },
        { name: "North Cove", blurb: "Quiet lanes and larger lots above the marina.", vibe: "Family-friendly" },
        { name: "Cliffside", blurb: "Dramatic views and architect-designed homes.", vibe: "Design-forward" },
        { name: "Harbor Flats", blurb: "Condos and townhomes near the ferry.", vibe: "Urban coastal" },
      ],
      agents: [
        { name: "Elena Vargas", title: "Principal Broker", focus: "Waterfront sales", phone: "+1 (555) 201-4401" },
        { name: "Marcus Hale", title: "Senior Agent", focus: "Buyer representation", phone: "+1 (555) 201-4402" },
        { name: "Sofia Berg", title: "Listing Specialist", focus: "Luxury marketing", phone: "+1 (555) 201-4403" },
        { name: "David Park", title: "Relocation Lead", focus: "Out-of-area buyers", phone: "+1 (555) 201-4404" },
      ],
      contact: {
        heading: "Let's find your next address",
        blurb: "Whether you're listing, buying, or just exploring — we're glad to talk.",
        email: "hello@harborhomes.co",
        phone: "+1 (555) 201-4400",
        office: "88 Pier Street, Suite 4 · Harbor Town",
      },
    },
    render(c, accent, brand, pageKey) {
      const home = () => `
        <section style="background:linear-gradient(135deg,#1a2a3a 0%,#2C4A6E 55%,#3d5f7a 100%);color:#f5f7fa;padding:110px 0 80px">
          <div class="wrap">
            <div class="eyebrow" style="color:#9ec0e0">${esc(brand)}</div>
            <h1 style="font-family:${DISPLAY};max-width:14ch;color:#fff">${esc(c.hero.title)}</h1>
            <p class="lead" style="color:#c5d4e0;margin-top:20px">${esc(c.hero.subtitle)}</p>
            <div style="margin-top:30px"><a class="btn" href="listings.html">${esc(c.hero.ctaText)}</a></div>
            <div style="display:flex;gap:48px;flex-wrap:wrap;margin-top:56px;padding-top:28px;border-top:1px solid rgba(255,255,255,.15)">
              ${c.stats.map((s: any) => `<div><div style="font-size:30px;font-weight:800;font-family:${DISPLAY}">${esc(s.value)}</div><div style="font-size:13px;opacity:.7;margin-top:4px;font-family:${MONO};letter-spacing:.08em;text-transform:uppercase">${esc(s.label)}</div></div>`).join("")}
            </div>
          </div>
        </section>
        <section class="wrap" style="padding-top:56px">
          <div style="display:flex;justify-content:space-between;align-items:end;gap:16px;flex-wrap:wrap;margin-bottom:24px">
            <h2 style="margin:0;font-family:${DISPLAY}">Featured listings</h2>
            <a href="listings.html" style="font-weight:700;color:${accent}">View all →</a>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px">
            ${c.listings.slice(0, 3).map((l: any) => `<a href="listings.html" style="display:block;border:1px solid #e4e8ee;overflow:hidden"><div style="height:160px;background:linear-gradient(160deg,#d8e0ea,#a8b8c8)"></div><div style="padding:20px"><div style="font-family:${MONO};font-size:11px;color:${accent};font-weight:700;letter-spacing:.1em;text-transform:uppercase">${esc(l.tag)}</div><div style="font-size:20px;font-family:${DISPLAY};font-weight:700;margin:6px 0">${esc(l.address)}</div><div style="font-weight:800;color:${accent}">${esc(l.price)}</div><div style="color:#6a7684;font-size:13px;margin-top:8px">${esc(l.beds)} bd · ${esc(l.baths)} ba · ${esc(l.sqft)} sqft</div></div></a>`).join("")}
          </div>
        </section>`;
      const listings = () => `
        <section class="wrap"><div class="eyebrow">Listings</div>
          <h2 style="font-family:${DISPLAY}">Available homes</h2>
          <div style="margin-top:36px;display:grid;gap:12px">
            ${c.listings.map((l: any) => `<div style="display:grid;grid-template-columns:140px 1fr auto;gap:24px;align-items:center;padding:20px;border-bottom:1px solid #e8ecf0"><div style="height:90px;background:linear-gradient(145deg,#cfd8e4,#9eafc2);border-radius:2px"></div><div><div style="font-family:${MONO};font-size:11px;color:${accent};font-weight:700;text-transform:uppercase;letter-spacing:.1em">${esc(l.tag)}</div><div style="font-size:22px;font-family:${DISPLAY};font-weight:700">${esc(l.address)}</div><div style="color:#667584;font-size:14px;margin-top:4px">${esc(l.beds)} beds · ${esc(l.baths)} baths · ${esc(l.sqft)} sqft</div></div><div style="font-size:22px;font-weight:800;color:${accent};white-space:nowrap">${esc(l.price)}</div></div>`).join("")}
          </div></section>`;
      const neighborhoods = () => `
        <section class="wrap"><div class="eyebrow">Explore</div>
          <h2 style="font-family:${DISPLAY}">Neighborhoods we know</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:2px;background:#dfe5ec;margin-top:40px">
            ${c.neighborhoods.map((n: any, i: number) => `<div style="background:${i % 2 === 0 ? "#fff" : "#f4f7fa"};padding:36px 28px;min-height:200px"><div style="font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${accent};font-weight:700;margin-bottom:10px">${esc(n.vibe)}</div><h3 style="font-size:26px;font-family:${DISPLAY};font-weight:700;margin-bottom:10px">${esc(n.name)}</h3><p style="color:#556070">${esc(n.blurb)}</p></div>`).join("")}
          </div></section>`;
      const agents = () => `
        <section class="wrap"><div class="eyebrow">Team</div>
          <h2 style="font-family:${DISPLAY}">Your local guides</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:24px;margin-top:40px">
            ${c.agents.map((a: any) => `<div style="padding:28px 24px;border-top:3px solid ${accent}"><div style="font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7a8796;margin-bottom:8px">${esc(a.title)}</div><h3 style="font-size:22px;font-family:${DISPLAY};font-weight:700">${esc(a.name)}</h3><div style="color:#556070;margin:8px 0 16px">${esc(a.focus)}</div><a style="font-weight:700;color:${accent}" href="tel:${esc(a.phone)}">${esc(a.phone)}</a></div>`).join("")}
          </div></section>`;
      const contact = () => `
        <section class="wrap" style="max-width:640px"><div class="eyebrow">Contact</div>
          <h2 style="font-family:${DISPLAY}">${esc(c.contact.heading)}</h2>
          <p class="lead" style="margin-bottom:28px">${esc(c.contact.blurb)}</p>
          <div style="background:#1a2a3a;color:#f0f4f8;padding:32px;border-radius:4px;display:grid;gap:18px">
            <div><strong style="opacity:.6;font-size:12px;font-family:${MONO};letter-spacing:.12em;text-transform:uppercase">Email</strong><br><a style="color:#9ec0e0" href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></div>
            <div><strong style="opacity:.6;font-size:12px;font-family:${MONO};letter-spacing:.12em;text-transform:uppercase">Phone</strong><br>${esc(c.contact.phone)}</div>
            <div><strong style="opacity:.6;font-size:12px;font-family:${MONO};letter-spacing:.12em;text-transform:uppercase">Office</strong><br>${esc(c.contact.office)}</div>
          </div></section>`;
      const map: Record<string, () => string> = { home, listings, neighborhoods, agents, contact };
      return (map[pageKey] || home)();
    },
  },

  /* ---------- 5. Education — Lumen Academy ---------- */
  {
    id: "education",
    name: "Lumen Academy",
    category: "Education / courses",
    tagline: "Warm academic site for courses, campus, and admissions.",
    font: DISPLAY,
    previewImage:
      "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80",
    previewAccent: "#B45309",
    pages: [
      { key: "home", label: "Home", slug: "index.html" },
      { key: "courses", label: "Courses", slug: "courses.html" },
      { key: "campus", label: "Campus", slug: "campus.html" },
      { key: "admissions", label: "Admissions", slug: "admissions.html" },
      { key: "contact", label: "Contact", slug: "contact.html" },
    ],
    availablePageDesigns: [
      "about",
      "blog",
      "faq",
      "team",
      "testimonials",
      "careers",
      "gallery",
      "services",
      "booking",
      "privacy",
    ],
    schema: `{
 "hero":{"title":"","subtitle":"","ctaText":""},
 "highlights":[{"title":"","body":""},{"title":"","body":""},{"title":"","body":""}],
 "courses":[{"title":"","level":"","duration":"","blurb":"","tuition":""}, ...exactly 6 items],
 "campus":{"heading":"","body":"","spaces":[{"name":"","desc":""},{"name":"","desc":""},{"name":"","desc":""}]},
 "admissions":{"heading":"","blurb":"","steps":[{"title":"","body":""},{"title":"","body":""},{"title":"","body":""},{"title":"","body":""}],"deadline":""},
 "contact":{"heading":"","blurb":"","email":"","phone":"","address":""}
}`,
    fallback: {
      hero: {
        title: "Learn with light and rigor",
        subtitle:
          "Lumen Academy offers immersive courses in design, writing, and technology — taught by practitioners on a walkable campus.",
        ctaText: "Explore courses",
      },
      highlights: [
        { title: "Small cohorts", body: "12–18 students per studio so feedback stays personal." },
        { title: "Working faculty", body: "Instructors who still ship work in the field." },
        { title: "Career studio", body: "Portfolio reviews and employer nights every term." },
      ],
      courses: [
        { title: "Visual Systems", level: "Foundation", duration: "8 weeks", blurb: "Typography, layout, and brand grammar.", tuition: "$2,400" },
        { title: "Narrative Craft", level: "Writing", duration: "6 weeks", blurb: "Essays and story structure for makers.", tuition: "$1,800" },
        { title: "Product Prototyping", level: "Technology", duration: "10 weeks", blurb: "From sketch to interactive demo.", tuition: "$2,900" },
        { title: "Editorial Design", level: "Intermediate", duration: "8 weeks", blurb: "Magazines, reports, and long-form web.", tuition: "$2,200" },
        { title: "Creative Leadership", level: "Advanced", duration: "5 weeks", blurb: "Running teams and creative critique.", tuition: "$1,950" },
        { title: "Motion Foundations", level: "Foundation", duration: "6 weeks", blurb: "Timing, storyboards, and tool fluency.", tuition: "$2,100" },
      ],
      campus: {
        heading: "A campus built for focus",
        body: "Studios, libraries, and courtyards sit around a central quad — quiet enough to think, open enough to collaborate.",
        spaces: [
          { name: "North Studio Hall", desc: "Daylit rooms with pin-up walls and large tables." },
          { name: "The Stacks", desc: "Reference library with late hours during critique weeks." },
          { name: "Courtyard Café", desc: "Coffee, quiet corners, and weekend open studios." },
        ],
      },
      admissions: {
        heading: "How to apply",
        blurb: "We look for curiosity and craft more than perfect résumés. Rolling review until the cohort fills.",
        steps: [
          { title: "Submit inquiry", body: "Share your goals and preferred term." },
          { title: "Portfolio or writing sample", body: "5–8 pieces that show how you think." },
          { title: "Conversation", body: "A 30-minute call with admissions faculty." },
          { title: "Offer & enrollment", body: "Secure your seat with a deposit within 10 days." },
        ],
        deadline: "Fall term priority: August 15",
      },
      contact: {
        heading: "Ask admissions anything",
        blurb: "Program fit, scholarships, or campus visits — we're glad to help.",
        email: "admissions@lumen.academy",
        phone: "+1 (555) 760-3300",
        address: "12 Scholars Lane, Riverbend",
      },
    },
    render(c, accent, brand, pageKey) {
      const home = () => `
        <section class="wrap" style="padding-top:100px;text-align:center">
          <div class="eyebrow">${esc(brand)}</div>
          <h1 style="font-family:${DISPLAY};max-width:16ch;margin:0 auto">${esc(c.hero.title)}</h1>
          <p class="lead" style="margin:22px auto 0">${esc(c.hero.subtitle)}</p>
          <div style="margin-top:30px"><a class="btn" href="courses.html">${esc(c.hero.ctaText)}</a></div>
        </section>
        <section class="wrap" style="padding-top:48px">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0;border:1px solid #eadfce;border-radius:4px;overflow:hidden">
            ${c.highlights.map((h: any, i: number) => `<div style="padding:32px 26px;background:${i === 1 ? accent : "#fffaf3"};color:${i === 1 ? "#fff" : "#1a1a1a"};${i < 2 ? "border-right:1px solid #eadfce" : ""}"><h3 style="font-size:20px;font-family:${DISPLAY};font-weight:700;margin-bottom:10px">${esc(h.title)}</h3><p style="opacity:.85;font-size:15px">${esc(h.body)}</p></div>`).join("")}
          </div>
        </section>`;
      const courses = () => `
        <section class="wrap"><div class="eyebrow">Curriculum</div>
          <h2 style="font-family:${DISPLAY}">Courses this term</h2>
          <div style="margin-top:36px;display:grid;gap:0">
            ${c.courses.map((course: any) => `<div style="display:grid;grid-template-columns:1fr 120px 100px;gap:20px;align-items:start;padding:28px 0;border-bottom:1px solid #eadfce"><div><div style="font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${accent};font-weight:700;margin-bottom:6px">${esc(course.level)}</div><h3 style="font-size:24px;font-family:${DISPLAY};font-weight:700">${esc(course.title)}</h3><p style="color:#5c5348;margin-top:6px">${esc(course.blurb)}</p></div><div style="font-size:14px;color:#6b6358;padding-top:22px">${esc(course.duration)}</div><div style="font-weight:800;color:${accent};padding-top:22px;text-align:right">${esc(course.tuition)}</div></div>`).join("")}
          </div></section>`;
      const campus = () => `
        <section class="wrap"><div class="eyebrow">Campus</div>
          <h2 style="font-family:${DISPLAY}">${esc(c.campus.heading)}</h2>
          <p class="lead" style="max-width:640px">${esc(c.campus.body)}</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin-top:44px">
            ${c.campus.spaces.map((sp: any, i: number) => `<div style="padding:28px 24px;background:linear-gradient(180deg,${i === 0 ? "#fff6eb" : "#f7f3ec"} 0%,#fff 100%);border:1px solid #eadfce;border-radius:4px;min-height:180px"><div style="width:36px;height:3px;background:${accent};margin-bottom:18px"></div><h3 style="font-size:20px;font-family:${DISPLAY};font-weight:700;margin-bottom:10px">${esc(sp.name)}</h3><p style="color:#5c5348">${esc(sp.desc)}</p></div>`).join("")}
          </div></section>`;
      const admissions = () => `
        <section class="wrap"><div class="eyebrow">Admissions</div>
          <h2 style="font-family:${DISPLAY}">${esc(c.admissions.heading)}</h2>
          <p class="lead">${esc(c.admissions.blurb)}</p>
          <div style="margin-top:16px;display:inline-block;font-family:${MONO};font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${accent};padding:8px 14px;border:1px solid ${accent}44;border-radius:4px">${esc(c.admissions.deadline)}</div>
          <div style="margin-top:44px;position:relative;padding-left:28px;border-left:2px solid ${accent}44">
            ${c.admissions.steps.map((st: any, i: number) => `<div style="position:relative;padding:0 0 36px 16px"><div style="position:absolute;left:-37px;top:4px;width:14px;height:14px;border-radius:50%;background:${accent};border:3px solid #fff;box-shadow:0 0 0 2px ${accent}33"></div><div style="font-family:${MONO};font-size:11px;color:${accent};font-weight:700;margin-bottom:4px">STEP 0${i + 1}</div><h3 style="font-size:20px;font-family:${DISPLAY};font-weight:700;margin-bottom:6px">${esc(st.title)}</h3><p style="color:#5c5348">${esc(st.body)}</p></div>`).join("")}
          </div>
          <div style="margin-top:8px"><a class="btn" href="contact.html">Start your application</a></div>
        </section>`;
      const contact = () => `
        <section class="wrap" style="max-width:620px"><div class="eyebrow">Contact</div>
          <h2 style="font-family:${DISPLAY}">${esc(c.contact.heading)}</h2>
          <p class="lead" style="margin-bottom:28px">${esc(c.contact.blurb)}</p>
          <div style="background:#fffaf3;border:1px solid #eadfce;padding:30px;border-radius:4px;display:grid;gap:16px">
            <div><strong>Email</strong><br><a style="color:${accent}" href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></div>
            <div><strong>Phone</strong><br>${esc(c.contact.phone)}</div>
            <div><strong>Campus</strong><br>${esc(c.contact.address)}</div>
          </div></section>`;
      const map: Record<string, () => string> = { home, courses, campus, admissions, contact };
      return (map[pageKey] || home)();
    },
  },
];

export function getExtraTemplate(id: string): Template | undefined {
  return EXTRA_TEMPLATES.find((t) => t.id === id);
}
