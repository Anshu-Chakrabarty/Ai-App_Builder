import type { Template } from "./types";
import { esc, MONO, SANS, DISPLAY } from "./render";
import { renderServiceCards } from "./site-media";

const COMMON_DESIGNS = [
  "about",
  "faq",
  "team",
  "testimonials",
  "services",
  "booking",
  "privacy",
];

export const HEALTHCARE_TEMPLATES: Template[] = [
  /* ---------- 1. Primary care — Willow Primary Care ---------- */
  {
    id: "primary-care",
    name: "Willow Primary Care",
    category: "Primary care clinic",
    tagline: "Neighborhood primary care with calm, personal visits.",
    font: SANS,
    previewImage:
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80",
    previewAccent: "#2F6F5E",
    pages: [
      { key: "home", label: "Home", slug: "index.html" },
      { key: "services", label: "Services", slug: "services.html" },
      { key: "providers", label: "Providers", slug: "providers.html" },
      { key: "patients", label: "Patients", slug: "patients.html" },
      { key: "contact", label: "Contact", slug: "contact.html" },
    ],
    availablePageDesigns: [...COMMON_DESIGNS, "gallery", "careers"],
    schema: `{
 "hero":{"title":"","subtitle":"","ctaText":""},
 "highlights":[{"value":"","label":""},{"value":"","label":""},{"value":"","label":""}],
 "services":[{"name":"","desc":"","note":""}, ...exactly 5 items],
 "providers":[{"name":"","role":"","focus":"","bio":""}, ...exactly 4 items],
 "patients":{"heading":"","blurb":"","steps":[{"title":"","body":""},{"title":"","body":""},{"title":"","body":""}],"insurance":["","",""]},
 "contact":{"heading":"","blurb":"","email":"","phone":"","address":"","hours":""}
}`,
    fallback: {
      hero: {
        title: "Primary care that knows your name",
        subtitle:
          "Willow Primary Care offers same-week visits, preventive exams, and ongoing relationships for adults and families.",
        ctaText: "Book an appointment",
      },
      highlights: [
        { value: "Same week", label: "typical new visits" },
        { value: "18 min", label: "average appointment" },
        { value: "Est. 2012", label: "serving our neighborhood" },
      ],
      services: [
        { name: "Annual wellness", desc: "Physicals, screenings, and care plans tailored to your history.", note: "Book online" },
        { name: "Chronic care", desc: "Support for diabetes, hypertension, asthma, and related conditions.", note: "Care team follow-up" },
        { name: "Sick visits", desc: "Same-week appointments for colds, infections, and minor injuries.", note: "Call by 10am" },
        { name: "Women's health", desc: "Preventive visits and referrals coordinated with specialists.", note: "2–5 day wait" },
        { name: "Mental health liaison", desc: "Screening and warm handoffs to counseling partners.", note: "Referral guided" },
      ],
      providers: [
        { name: "Dr. Maya Chen", role: "Family Medicine", focus: "Adults & families", bio: "Focuses on listening carefully and explaining options clearly." },
        { name: "Dr. James Okonkwo", role: "Internal Medicine", focus: "Chronic conditions", bio: "Partners with patients managing complex, long-term care." },
        { name: "Dr. Priya Nair", role: "Family Medicine", focus: "Preventive care", bio: "Helps patients build practical routines that stick." },
        { name: "Alex Rivera, NP", role: "Nurse Practitioner", focus: "Acute visits", bio: "Keeps same-week sick visits calm and thorough." },
      ],
      patients: {
        heading: "Your first visit, simplified",
        blurb: "From booking to follow-up, we keep the path clear so you can focus on feeling better.",
        steps: [
          { title: "Book online or call", body: "Choose a time that fits; we confirm within one business hour." },
          { title: "Complete forms once", body: "Our secure portal stores your history for future visits." },
          { title: "Meet your care team", body: "Arrive 10 minutes early; free parking is on Willow Ave." },
        ],
        insurance: ["Most major PPO plans", "Medicare accepted", "Self-pay options available"],
      },
      contact: {
        heading: "We're here when you need us",
        blurb: "Questions about scheduling, records, or insurance? Reach the front desk anytime.",
        email: "care@willowprimary.clinic",
        phone: "+1 (555) 330-1180",
        address: "420 Willow Avenue, Suite 200",
        hours: "Mon–Fri 8am–6pm · Sat 9am–1pm",
      },
    },
    render(c, accent, brand, pageKey) {
      const home = () => `
        <section style="background:linear-gradient(180deg,#f3f8f6 0%,#fff 72%);padding:100px 0 56px">
          <div class="wrap" style="text-align:center">
            <div class="eyebrow">${esc(brand)}</div>
            <h1 style="max-width:16ch;margin:0 auto">${esc(c.hero.title)}</h1>
            <p class="lead" style="margin:20px auto 0">${esc(c.hero.subtitle)}</p>
            <div style="margin-top:28px"><a class="btn" href="contact.html">${esc(c.hero.ctaText)}</a></div>
            <div style="display:flex;justify-content:center;gap:40px;flex-wrap:wrap;margin-top:56px;padding-top:32px;border-top:1px solid ${accent}22">
              ${c.highlights.map((h: any) => `<div><div style="font-size:30px;font-weight:800;color:${accent}">${esc(h.value)}</div><div style="color:#6a7a74;font-size:14px;margin-top:4px">${esc(h.label)}</div></div>`).join("")}
            </div>
          </div>
        </section>
        <section class="wrap services" style="padding-top:40px">
          <div class="eyebrow">Care pathways</div><h2>Services at a glance</h2>
          ${renderServiceCards(c.services)}
        </section>`;
      const services = () => `
        <section class="wrap"><div class="eyebrow">Services</div><h2>Whole-person primary care</h2>
          <div style="margin-top:32px;display:grid;gap:12px">
            ${c.services.map((s: any) => `<div style="display:grid;grid-template-columns:1fr auto;gap:20px;align-items:center;padding:24px;background:#f6faf8;border-radius:16px;border-left:4px solid ${accent}"><div><h3 style="font-size:19px;font-weight:700;margin-bottom:6px">${esc(s.name)}</h3><p style="color:#55635d">${esc(s.desc)}</p></div><div style="font-family:${MONO};font-size:12px;font-weight:700;color:${accent};white-space:nowrap">${esc(s.note)}</div></div>`).join("")}
          </div></section>`;
      const providers = () => `
        <section class="wrap"><div class="eyebrow">Care team</div><h2>Meet your providers</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:22px;margin-top:36px">
            ${c.providers.map((p: any) => `<div><div style="height:6px;background:${accent};border-radius:8px 8px 0 0;margin-bottom:16px"></div><div style="font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${accent};font-weight:700">${esc(p.role)}</div><h3 style="font-size:20px;font-weight:800;margin:8px 0 4px">${esc(p.name)}</h3><div style="color:#6a7a74;font-size:14px;margin-bottom:10px">${esc(p.focus)}</div><p style="color:#444;font-size:15px">${esc(p.bio)}</p></div>`).join("")}
          </div></section>`;
      const patients = () => `
        <section class="wrap"><div class="eyebrow">For patients</div><h2>${esc(c.patients.heading)}</h2>
          <p class="lead">${esc(c.patients.blurb)}</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px;margin-top:36px">
            ${c.patients.steps.map((st: any, i: number) => `<div style="padding:24px;border:1px solid #e2ebe7;border-radius:16px"><div style="width:34px;height:34px;border-radius:50%;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;margin-bottom:12px">${i + 1}</div><h3 style="font-size:17px;font-weight:700;margin-bottom:6px">${esc(st.title)}</h3><p style="color:#55635d;font-size:14px">${esc(st.body)}</p></div>`).join("")}
          </div>
          <div style="margin-top:40px;padding:24px;background:#f6faf8;border-radius:16px">
            <div style="font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${accent};font-weight:700;margin-bottom:12px">Insurance</div>
            <div style="display:flex;flex-wrap:wrap;gap:10px">${c.patients.insurance.map((ins: string) => `<span style="background:#fff;border:1px solid #d5e4de;padding:8px 14px;border-radius:100px;font-size:14px;font-weight:600">${esc(ins)}</span>`).join("")}</div>
          </div></section>`;
      const contact = () => `
        <section class="wrap" style="max-width:700px"><div class="eyebrow">Contact</div><h2>${esc(c.contact.heading)}</h2>
          <p class="lead" style="margin-bottom:24px">${esc(c.contact.blurb)}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div style="padding:22px;background:#f6faf8;border-radius:14px"><strong>Phone</strong><br>${esc(c.contact.phone)}</div>
            <div style="padding:22px;background:#f6faf8;border-radius:14px"><strong>Email</strong><br><a style="color:${accent}" href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></div>
            <div style="padding:22px;background:#f6faf8;border-radius:14px"><strong>Address</strong><br>${esc(c.contact.address)}</div>
            <div style="padding:22px;background:#f6faf8;border-radius:14px"><strong>Hours</strong><br>${esc(c.contact.hours)}</div>
          </div></section>`;
      const map: Record<string, () => string> = { home, services, providers, patients, contact };
      return (map[pageKey] || home)();
    },
  },

  /* ---------- 2. Dental — BrightPath Dental ---------- */
  {
    id: "dental",
    name: "BrightPath Dental",
    category: "Dental practice",
    tagline: "Modern dental care with a gentle, clear approach.",
    font: SANS,
    previewImage:
      "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=800&q=80",
    previewAccent: "#1E7A8C",
    pages: [
      { key: "home", label: "Home", slug: "index.html" },
      { key: "services", label: "Services", slug: "services.html" },
      { key: "smile", label: "Smile", slug: "smile.html" },
      { key: "patients", label: "Patients", slug: "patients.html" },
      { key: "contact", label: "Contact", slug: "contact.html" },
    ],
    availablePageDesigns: [...COMMON_DESIGNS, "gallery", "blog"],
    schema: `{
 "hero":{"title":"","subtitle":"","ctaText":""},
 "highlights":[{"value":"","label":""},{"value":"","label":""},{"value":"","label":""}],
 "services":[{"name":"","desc":"","duration":""}, ...exactly 5 items],
 "smile":{"heading":"","blurb":"","treatments":[{"name":"","result":"","note":""}, ...exactly 4 items]},
 "patients":{"heading":"","blurb":"","prep":[{"title":"","body":""},{"title":"","body":""},{"title":"","body":""}],"insurance":["","",""]},
 "contact":{"heading":"","blurb":"","email":"","phone":"","address":"","hours":""}
}`,
    fallback: {
      hero: {
        title: "Healthy smiles, unhurried visits",
        subtitle:
          "BrightPath Dental provides preventive, restorative, and cosmetic care in a calm, modern studio.",
        ctaText: "Schedule a cleaning",
      },
      highlights: [
        { value: "Digital X-rays", label: "low-dose imaging" },
        { value: "Evening hours", label: "two nights a week" },
        { value: "New patients", label: "welcome year-round" },
      ],
      services: [
        { name: "Cleanings & exams", desc: "Routine hygiene visits with personalized home-care tips.", duration: "45–60 min" },
        { name: "Fillings & crowns", desc: "Tooth-colored restorations matched to your smile.", duration: "60–90 min" },
        { name: "Whitening", desc: "In-office and take-home options after a hygiene visit.", duration: "Consult first" },
        { name: "Invisalign consults", desc: "Clear aligner evaluations with digital scanning.", duration: "30 min" },
        { name: "Emergency care", desc: "Same-day relief for chips, pain, and lost fillings when possible.", duration: "Call ahead" },
      ],
      smile: {
        heading: "Smile goals, explained clearly",
        blurb: "We outline options, timelines, and costs before any elective treatment begins.",
        treatments: [
          { name: "Whitening", result: "Brighter shade", note: "After cleaning recommended" },
          { name: "Bonding", result: "Smooth chips", note: "Often one visit" },
          { name: "Veneers consult", result: "Shape & color plan", note: "Digital preview" },
          { name: "Aligners", result: "Straighter bite path", note: "Wear-time guided" },
        ],
      },
      patients: {
        heading: "Preparing for your visit",
        blurb: "A little prep helps appointments run on time and feel comfortable.",
        prep: [
          { title: "Bring your ID & insurance", body: "We'll verify benefits and estimate any out-of-pocket costs." },
          { title: "List medications", body: "Include allergies and recent dental work from other offices." },
          { title: "Arrive a few minutes early", body: "Parking is behind the building; elevators are available." },
        ],
        insurance: ["Delta Dental PPO", "Most major dental plans", "Membership discount available"],
      },
      contact: {
        heading: "Book your next visit",
        blurb: "New patients and families are welcome. Ask about evening hygiene openings.",
        email: "hello@brightpath.dental",
        phone: "+1 (555) 482-0190",
        address: "88 Harbor Lane, Suite 110",
        hours: "Mon–Thu 8am–6pm · Fri 8am–2pm",
      },
    },
    render(c, accent, brand, pageKey) {
      const home = () => `
        <section style="background:linear-gradient(165deg,#eef7f9 0%,#fff 68%);padding:96px 0 52px">
          <div class="wrap" style="display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center">
            <div>
              <div class="eyebrow">${esc(brand)}</div>
              <h1 style="max-width:14ch">${esc(c.hero.title)}</h1>
              <p class="lead" style="margin-top:18px">${esc(c.hero.subtitle)}</p>
              <div style="margin-top:26px"><a class="btn" href="contact.html">${esc(c.hero.ctaText)}</a></div>
            </div>
            <div style="display:grid;gap:12px">${c.highlights.map((h: any) => `<div style="padding:18px 20px;background:#fff;border:1px solid #d7e8ec;border-radius:14px"><div style="font-weight:800;color:${accent};font-size:22px">${esc(h.value)}</div><div style="color:#5f7278;font-size:14px">${esc(h.label)}</div></div>`).join("")}</div>
          </div>
        </section>`;
      const services = () => `
        <section class="wrap"><div class="eyebrow">Services</div><h2>Care for every stage</h2>
          <div style="margin-top:32px;display:grid;gap:12px">
            ${c.services.map((s: any) => `<div style="padding:24px;border-radius:16px;background:#f4fafb;display:grid;grid-template-columns:1fr auto;gap:16px"><div><h3 style="font-size:19px;font-weight:700;margin-bottom:6px">${esc(s.name)}</h3><p style="color:#55666c">${esc(s.desc)}</p></div><div style="font-family:${MONO};font-size:12px;color:${accent};font-weight:700">${esc(s.duration)}</div></div>`).join("")}
          </div></section>`;
      const smile = () => `
        <section class="wrap"><div class="eyebrow">Smile</div><h2>${esc(c.smile.heading)}</h2>
          <p class="lead">${esc(c.smile.blurb)}</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-top:36px">
            ${c.smile.treatments.map((t: any) => `<div style="padding:24px;border:1px solid #d7e8ec;border-radius:16px"><h3 style="font-size:18px;font-weight:700">${esc(t.name)}</h3><div style="color:${accent};font-weight:700;margin:8px 0 6px">${esc(t.result)}</div><p style="color:#5f7278;font-size:14px">${esc(t.note)}</p></div>`).join("")}
          </div></section>`;
      const patients = () => `
        <section class="wrap"><div class="eyebrow">Patients</div><h2>${esc(c.patients.heading)}</h2>
          <p class="lead">${esc(c.patients.blurb)}</p>
          <div style="display:grid;gap:12px;margin-top:32px">
            ${c.patients.prep.map((p: any, i: number) => `<div style="padding:22px 24px;background:#f4fafb;border-radius:14px;display:grid;grid-template-columns:48px 1fr;gap:14px;align-items:start"><div style="font-family:${MONO};font-size:22px;font-weight:800;color:${accent}">0${i + 1}</div><div><h3 style="font-size:17px;font-weight:700;margin-bottom:4px">${esc(p.title)}</h3><p style="color:#55666c;font-size:15px">${esc(p.body)}</p></div></div>`).join("")}
          </div>
          <div style="margin-top:28px;display:flex;flex-wrap:wrap;gap:10px">${c.patients.insurance.map((ins: string) => `<span style="padding:8px 14px;border:1px solid #cfe3e8;border-radius:100px;font-size:14px;font-weight:600">${esc(ins)}</span>`).join("")}</div>
        </section>`;
      const contact = () => `
        <section class="wrap" style="max-width:680px"><div class="eyebrow">Contact</div><h2>${esc(c.contact.heading)}</h2>
          <p class="lead" style="margin-bottom:24px">${esc(c.contact.blurb)}</p>
          <div style="display:grid;gap:12px;padding:28px;background:#f4fafb;border-radius:16px">
            <div><strong>Phone</strong> · ${esc(c.contact.phone)}</div>
            <div><strong>Email</strong> · <a style="color:${accent}" href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></div>
            <div><strong>Visit</strong> · ${esc(c.contact.address)}</div>
            <div><strong>Hours</strong> · ${esc(c.contact.hours)}</div>
          </div></section>`;
      const map: Record<string, () => string> = { home, services, smile, patients, contact };
      return (map[pageKey] || home)();
    },
  },

  /* ---------- 3. Hospital — Meridian General ---------- */
  {
    id: "hospital",
    name: "Meridian General",
    category: "Community hospital",
    tagline: "Trusted community hospital care, clearly organized.",
    font: DISPLAY,
    previewImage:
      "https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800&q=80",
    previewAccent: "#1B4F72",
    pages: [
      { key: "home", label: "Home", slug: "index.html" },
      { key: "departments", label: "Departments", slug: "departments.html" },
      { key: "specialists", label: "Specialists", slug: "specialists.html" },
      { key: "visitors", label: "Visitors", slug: "visitors.html" },
      { key: "contact", label: "Contact", slug: "contact.html" },
    ],
    availablePageDesigns: [...COMMON_DESIGNS, "careers", "blog"],
    schema: `{
 "hero":{"title":"","subtitle":"","ctaText":""},
 "stats":[{"value":"","label":""},{"value":"","label":""},{"value":"","label":""}],
 "departments":[{"name":"","desc":"","floor":""}, ...exactly 6 items],
 "specialists":[{"name":"","dept":"","focus":"","bio":""}, ...exactly 4 items],
 "visitors":{"heading":"","blurb":"","hours":"","parking":"","amenities":[{"title":"","body":""},{"title":"","body":""},{"title":"","body":""}]},
 "contact":{"heading":"","blurb":"","email":"","phone":"","address":"","emergency":""}
}`,
    fallback: {
      hero: {
        title: "Care for our community, every day",
        subtitle:
          "Meridian General is a full-service community hospital with emergency, surgical, and specialty care under one roof.",
        ctaText: "Find a department",
      },
      stats: [
        { value: "24/7", label: "emergency department" },
        { value: "180+", label: "beds" },
        { value: "12", label: "specialty departments" },
      ],
      departments: [
        { name: "Emergency", desc: "Round-the-clock evaluation for urgent and emergent needs.", floor: "Level 1" },
        { name: "Cardiology", desc: "Diagnostics, monitoring, and coordinated heart care.", floor: "Level 3" },
        { name: "Maternity", desc: "Labor, delivery, and postpartum support for families.", floor: "Level 4" },
        { name: "Orthopedics", desc: "Injury care, joint procedures, and rehabilitation planning.", floor: "Level 2" },
        { name: "Imaging", desc: "X-ray, ultrasound, CT, and MRI with scheduled slots.", floor: "Level B" },
        { name: "Surgery", desc: "Inpatient and outpatient procedures with pre-op guidance.", floor: "Level 2" },
      ],
      specialists: [
        { name: "Dr. Helen Park", dept: "Cardiology", focus: "Heart rhythm", bio: "Coordinates testing and long-term heart health plans." },
        { name: "Dr. Omar Hassan", dept: "Emergency", focus: "Acute care", bio: "Leads rapid assessment with clear next-step communication." },
        { name: "Dr. Sofia Alvarez", dept: "Maternity", focus: "Labor support", bio: "Partners with families through delivery and recovery." },
        { name: "Dr. Nate Brooks", dept: "Orthopedics", focus: "Joint care", bio: "Helps patients understand surgical and non-surgical paths." },
      ],
      visitors: {
        heading: "Visiting a patient",
        blurb: "We welcome visitors while protecting rest and recovery. Please check current guidelines at the front desk.",
        hours: "Daily 10am–8pm (unit rules may vary)",
        parking: "Garage A · first 30 minutes free",
        amenities: [
          { title: "Cafeteria", body: "Open 7am–7pm on Level 1 near the atrium." },
          { title: "Quiet rooms", body: "Family spaces available on maternity and ICU floors." },
          { title: "Wayfinding", body: "Volunteer guides at the main lobby information desk." },
        ],
      },
      contact: {
        heading: "Reach Meridian General",
        blurb: "For appointments and records, use the main line. For life-threatening emergencies, call 911.",
        email: "info@meridiangeneral.org",
        phone: "+1 (555) 900-2400",
        address: "1200 Meridian Parkway",
        emergency: "Emergency: +1 (555) 900-2911",
      },
    },
    render(c, accent, brand, pageKey) {
      const home = () => `
        <section style="background:linear-gradient(180deg,#eef4f8 0%,#fff 70%);padding:100px 0 56px">
          <div class="wrap">
            <div class="eyebrow">${esc(brand)}</div>
            <h1 style="font-family:${DISPLAY};max-width:16ch">${esc(c.hero.title)}</h1>
            <p class="lead" style="margin-top:18px">${esc(c.hero.subtitle)}</p>
            <div style="margin-top:28px"><a class="btn" href="departments.html">${esc(c.hero.ctaText)}</a></div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:48px">
              ${c.stats.map((s: any) => `<div style="padding:22px;background:#fff;border:1px solid #d9e4ec;border-radius:12px"><div style="font-size:28px;font-weight:800;color:${accent};font-family:${DISPLAY}">${esc(s.value)}</div><div style="color:#5a6b78;font-size:14px;margin-top:4px">${esc(s.label)}</div></div>`).join("")}
            </div>
          </div>
        </section>
        ${
          Array.isArray(c.services) && c.services.length
            ? `<section class="wrap services" style="padding-top:40px">
          <div class="eyebrow">Care pathways</div><h2>Services at a glance</h2>
          ${renderServiceCards(c.services)}
        </section>`
            : Array.isArray(c.departments) && c.departments.length
              ? `<section class="wrap services" style="padding-top:40px">
          <div class="eyebrow">Care pathways</div><h2>Services at a glance</h2>
          ${renderServiceCards(
            c.departments.map((d: any) => ({
              name: d.name,
              desc: d.desc,
              image: d.image,
            }))
          )}
        </section>`
              : ""
        }`;
      const departments = () => `
        <section class="wrap"><div class="eyebrow">Departments</div><h2 style="font-family:${DISPLAY}">Find the right care</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:32px">
            ${c.departments.map((d: any) => `<div style="padding:24px;border:1px solid #d9e4ec;border-radius:14px;background:#f7fafc"><div style="font-family:${MONO};font-size:11px;color:${accent};font-weight:700;letter-spacing:.1em;text-transform:uppercase">${esc(d.floor)}</div><h3 style="font-family:${DISPLAY};font-size:22px;margin:8px 0">${esc(d.name)}</h3><p style="color:#556575;font-size:15px">${esc(d.desc)}</p></div>`).join("")}
          </div></section>`;
      const specialists = () => `
        <section class="wrap"><div class="eyebrow">Specialists</div><h2 style="font-family:${DISPLAY}">Physicians & care leads</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px;margin-top:36px">
            ${c.specialists.map((s: any) => `<div style="padding:0 0 20px;border-top:3px solid ${accent}"><div style="font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${accent};font-weight:700;margin-top:14px">${esc(s.dept)}</div><h3 style="font-family:${DISPLAY};font-size:22px;margin:8px 0 4px">${esc(s.name)}</h3><div style="color:#5a6b78;font-size:14px;margin-bottom:10px">${esc(s.focus)}</div><p style="color:#444;font-size:15px">${esc(s.bio)}</p></div>`).join("")}
          </div></section>`;
      const visitors = () => `
        <section class="wrap"><div class="eyebrow">Visitors</div><h2 style="font-family:${DISPLAY}">${esc(c.visitors.heading)}</h2>
          <p class="lead">${esc(c.visitors.blurb)}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:28px 0 36px">
            <div style="padding:22px;background:#f7fafc;border-radius:12px"><strong>Hours</strong><br>${esc(c.visitors.hours)}</div>
            <div style="padding:22px;background:#f7fafc;border-radius:12px"><strong>Parking</strong><br>${esc(c.visitors.parking)}</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px">
            ${c.visitors.amenities.map((a: any) => `<div style="padding:20px;border:1px solid #d9e4ec;border-radius:12px"><h3 style="font-size:17px;font-weight:700;margin-bottom:6px">${esc(a.title)}</h3><p style="color:#556575;font-size:14px">${esc(a.body)}</p></div>`).join("")}
          </div></section>`;
      const contact = () => `
        <section class="wrap" style="max-width:700px"><div class="eyebrow">Contact</div><h2 style="font-family:${DISPLAY}">${esc(c.contact.heading)}</h2>
          <p class="lead" style="margin-bottom:24px">${esc(c.contact.blurb)}</p>
          <div style="display:grid;gap:12px;padding:28px;background:#1B4F72;color:#f4f8fb;border-radius:14px">
            <div>${esc(c.contact.phone)} · <a style="color:#9fd0ef" href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></div>
            <div>${esc(c.contact.address)}</div>
            <div style="font-weight:700">${esc(c.contact.emergency)}</div>
          </div></section>`;
      const map: Record<string, () => string> = { home, departments, specialists, visitors, contact };
      return (map[pageKey] || home)();
    },
  },

  /* ---------- 4. Mental health — Harbor Mind ---------- */
  {
    id: "mental-health",
    name: "Harbor Mind",
    category: "Mental health / counseling",
    tagline: "Calm counseling spaces and clear first steps.",
    font: SANS,
    previewImage:
      "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&q=80",
    previewAccent: "#3D6B7A",
    pages: [
      { key: "home", label: "Home", slug: "index.html" },
      { key: "programs", label: "Programs", slug: "programs.html" },
      { key: "therapists", label: "Therapists", slug: "therapists.html" },
      { key: "start", label: "Start", slug: "start.html" },
      { key: "contact", label: "Contact", slug: "contact.html" },
    ],
    availablePageDesigns: [...COMMON_DESIGNS, "blog"],
    schema: `{
 "hero":{"title":"","subtitle":"","ctaText":""},
 "pillars":[{"title":"","body":""},{"title":"","body":""},{"title":"","body":""}],
 "programs":[{"name":"","desc":"","format":""}, ...exactly 5 items],
 "therapists":[{"name":"","role":"","focus":"","bio":""}, ...exactly 4 items],
 "start":{"heading":"","blurb":"","steps":[{"title":"","body":""},{"title":"","body":""},{"title":"","body":""}],"note":""},
 "contact":{"heading":"","blurb":"","email":"","phone":"","address":"","hours":""}
}`,
    fallback: {
      hero: {
        title: "A steady place to begin",
        subtitle:
          "Harbor Mind offers individual therapy, group programs, and practical first steps for adults seeking support.",
        ctaText: "Book a consult",
      },
      pillars: [
        { title: "Confidential", body: "Sessions are private, with clear consent around records and sharing." },
        { title: "Collaborative", body: "Goals are set together and revisited as your needs change." },
        { title: "Accessible", body: "In-person and telehealth options with evening openings each week." },
      ],
      programs: [
        { name: "Individual therapy", desc: "One-to-one sessions focused on your goals and pace.", format: "50 min · weekly" },
        { name: "Anxiety skills group", desc: "Small groups practicing grounding and thought tools.", format: "8 weeks" },
        { name: "Depression support", desc: "Structured check-ins and behavioral activation planning.", format: "Ongoing" },
        { name: "Couples counseling", desc: "Communication and conflict skills with a licensed clinician.", format: "60–75 min" },
        { name: "Workplace stress", desc: "Short-term coaching for burnout and boundary setting.", format: "6 sessions" },
      ],
      therapists: [
        { name: "Jordan Lee, LCSW", role: "Clinical social worker", focus: "Anxiety & life transitions", bio: "Creates a grounded space for adults navigating change." },
        { name: "Samira Patel, PhD", role: "Psychologist", focus: "Mood & trauma-informed care", bio: "Uses evidence-based approaches with a warm, clear style." },
        { name: "Chris Nguyen, LMFT", role: "Marriage & family therapist", focus: "Couples & families", bio: "Helps partners slow down and hear each other again." },
        { name: "Riley Brooks, LPC", role: "Professional counselor", focus: "Stress & burnout", bio: "Practical tools for high-demand seasons of work and life." },
      ],
      start: {
        heading: "How to get started",
        blurb: "You do not need a perfect plan to reach out. A short consult helps us match you with the right clinician.",
        steps: [
          { title: "Share what brings you in", body: "A brief form or phone call is enough to begin." },
          { title: "Match with a therapist", body: "We consider schedule, modality, and clinical fit." },
          { title: "First session", body: "Clarify goals, answer questions, and decide on next steps together." },
        ],
        note: "If you are in crisis or thinking about harming yourself, call or text 988 (US) or use local emergency services.",
      },
      contact: {
        heading: "Reach Harbor Mind",
        blurb: "Intake replies within one business day. Evening consult slots open each Monday.",
        email: "intake@harbormind.care",
        phone: "+1 (555) 617-0440",
        address: "210 Cove Street, Suite 4",
        hours: "Mon–Fri 9am–7pm · Sat by appointment",
      },
    },
    render(c, accent, brand, pageKey) {
      const home = () => `
        <section style="background:linear-gradient(180deg,#f2f7f8 0%,#fff 70%);padding:100px 0 52px">
          <div class="wrap" style="text-align:center;max-width:760px;margin:0 auto">
            <div class="eyebrow">${esc(brand)}</div>
            <h1>${esc(c.hero.title)}</h1>
            <p class="lead" style="margin:18px auto 0">${esc(c.hero.subtitle)}</p>
            <div style="margin-top:28px"><a class="btn" href="start.html">${esc(c.hero.ctaText)}</a></div>
          </div>
          <div class="wrap" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-top:48px">
            ${c.pillars.map((p: any) => `<div style="padding:22px;background:#fff;border:1px solid #d8e4e8;border-radius:16px;text-align:left"><h3 style="font-size:17px;font-weight:700;margin-bottom:6px">${esc(p.title)}</h3><p style="color:#5a6c72;font-size:14px">${esc(p.body)}</p></div>`).join("")}
          </div>
        </section>`;
      const programs = () => `
        <section class="wrap"><div class="eyebrow">Programs</div><h2>Support that fits your life</h2>
          <div style="margin-top:32px;display:grid;gap:12px">
            ${c.programs.map((p: any) => `<div style="padding:24px;background:#f5f9fa;border-radius:14px;border-left:4px solid ${accent};display:grid;grid-template-columns:1fr auto;gap:16px"><div><h3 style="font-size:18px;font-weight:700;margin-bottom:6px">${esc(p.name)}</h3><p style="color:#55666c">${esc(p.desc)}</p></div><div style="font-family:${MONO};font-size:12px;color:${accent};font-weight:700;white-space:nowrap">${esc(p.format)}</div></div>`).join("")}
          </div></section>`;
      const therapists = () => `
        <section class="wrap"><div class="eyebrow">Therapists</div><h2>Clinicians you can trust</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px;margin-top:36px">
            ${c.therapists.map((t: any) => `<div style="padding:24px;border:1px solid #d8e4e8;border-radius:16px"><div style="font-family:${MONO};font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:${accent};font-weight:700">${esc(t.role)}</div><h3 style="font-size:20px;font-weight:800;margin:8px 0 4px">${esc(t.name)}</h3><div style="color:#5a6c72;font-size:14px;margin-bottom:10px">${esc(t.focus)}</div><p style="color:#444;font-size:15px">${esc(t.bio)}</p></div>`).join("")}
          </div></section>`;
      const start = () => `
        <section class="wrap" style="max-width:760px"><div class="eyebrow">Start</div><h2>${esc(c.start.heading)}</h2>
          <p class="lead">${esc(c.start.blurb)}</p>
          <div style="display:grid;gap:12px;margin-top:32px">
            ${c.start.steps.map((st: any, i: number) => `<div style="padding:22px;background:#f5f9fa;border-radius:14px"><div style="font-family:${MONO};font-size:12px;color:${accent};font-weight:700;margin-bottom:6px">STEP 0${i + 1}</div><h3 style="font-size:18px;font-weight:700;margin-bottom:4px">${esc(st.title)}</h3><p style="color:#55666c">${esc(st.body)}</p></div>`).join("")}
          </div>
          <p style="margin-top:28px;padding:16px 18px;background:#fff8e8;border-radius:12px;font-size:14px;color:#5a5340">${esc(c.start.note)}</p>
          <div style="margin-top:24px"><a class="btn" href="contact.html">Contact intake</a></div>
        </section>`;
      const contact = () => `
        <section class="wrap" style="max-width:660px"><div class="eyebrow">Contact</div><h2>${esc(c.contact.heading)}</h2>
          <p class="lead" style="margin-bottom:24px">${esc(c.contact.blurb)}</p>
          <div style="display:grid;gap:12px;padding:26px;background:#f5f9fa;border-radius:16px">
            <div><strong>Phone</strong><br>${esc(c.contact.phone)}</div>
            <div><strong>Email</strong><br><a style="color:${accent}" href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></div>
            <div><strong>Office</strong><br>${esc(c.contact.address)}</div>
            <div><strong>Hours</strong><br>${esc(c.contact.hours)}</div>
          </div></section>`;
      const map: Record<string, () => string> = { home, programs, therapists, start, contact };
      return (map[pageKey] || home)();
    },
  },

  /* ---------- 5. Pharmacy — Northside Pharmacy ---------- */
  {
    id: "pharmacy",
    name: "Northside Pharmacy",
    category: "Pharmacy & wellness",
    tagline: "Neighborhood pharmacy with clear prescription support.",
    font: SANS,
    previewImage:
      "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&q=80",
    previewAccent: "#2A7A62",
    pages: [
      { key: "home", label: "Home", slug: "index.html" },
      { key: "services", label: "Services", slug: "services.html" },
      { key: "prescriptions", label: "Prescriptions", slug: "prescriptions.html" },
      { key: "wellness", label: "Wellness", slug: "wellness.html" },
      { key: "contact", label: "Contact", slug: "contact.html" },
    ],
    availablePageDesigns: [...COMMON_DESIGNS, "gallery"],
    schema: `{
 "hero":{"title":"","subtitle":"","ctaText":""},
 "highlights":[{"value":"","label":""},{"value":"","label":""},{"value":"","label":""}],
 "services":[{"name":"","desc":"","note":""}, ...exactly 5 items],
 "prescriptions":{"heading":"","blurb":"","steps":[{"title":"","body":""},{"title":"","body":""},{"title":"","body":""}],"tips":["","",""]},
 "wellness":{"heading":"","blurb":"","items":[{"name":"","desc":"","tag":""}, ...exactly 4 items]},
 "contact":{"heading":"","blurb":"","email":"","phone":"","address":"","hours":""}
}`,
    fallback: {
      hero: {
        title: "Your neighborhood pharmacy, ready today",
        subtitle:
          "Northside Pharmacy fills prescriptions quickly, answers questions clearly, and stocks everyday wellness essentials.",
        ctaText: "Transfer a prescription",
      },
      highlights: [
        { value: "Same-day", label: "most refill requests" },
        { value: "Drive-thru", label: "open daily" },
        { value: "Pharmacist chat", label: "no appointment needed" },
      ],
      services: [
        { name: "Prescription filling", desc: "New scripts and transfers with insurance checks at the counter.", note: "Most plans accepted" },
        { name: "Refill reminders", desc: "Text or app alerts so you never miss a dose window.", note: "Opt-in anytime" },
        { name: "Immunizations", desc: "Seasonal vaccines administered by licensed pharmacists.", note: "Walk-in when available" },
        { name: "Medication sync", desc: "Align monthly fills to one convenient pickup day.", note: "Ask the team" },
        { name: "Compounding consult", desc: "Partner compounding for select formulations when prescribed.", note: "Lead time varies" },
      ],
      prescriptions: {
        heading: "How prescriptions work here",
        blurb: "Whether you are transferring or refilling, we keep the process simple and transparent.",
        steps: [
          { title: "Send or transfer", body: "Have your provider e-prescribe, or bring your bottle for a transfer." },
          { title: "We verify coverage", body: "Our team checks benefits and shares estimated costs before you pick up." },
          { title: "Ready for pickup", body: "You'll get a text when it's ready — counter or drive-thru." },
        ],
        tips: ["Bring photo ID for controlled medications", "Ask about generic alternatives", "Tell us about allergies each visit"],
      },
      wellness: {
        heading: "Everyday wellness aisle",
        blurb: "Practical products and pharmacist guidance — not miracle claims.",
        items: [
          { name: "Cold & allergy", desc: "OTC options with pharmacist help choosing safely.", tag: "Seasonal" },
          { name: "First aid", desc: "Bandages, antiseptics, and recovery basics.", tag: "Home kit" },
          { name: "Vitamins", desc: "Common supplements with label guidance on request.", tag: "Daily" },
          { name: "Home tests", desc: "Select at-home kits; ask us how to read results.", tag: "Self-care" },
        ],
      },
      contact: {
        heading: "Visit Northside",
        blurb: "Questions about a refill, insurance, or vaccine availability? Call the pharmacy desk.",
        email: "desk@northsidepharmacy.com",
        phone: "+1 (555) 278-4400",
        address: "55 North Market Street",
        hours: "Mon–Fri 8am–8pm · Sat–Sun 9am–5pm",
      },
    },
    render(c, accent, brand, pageKey) {
      const home = () => `
        <section style="background:linear-gradient(160deg,#eef8f4 0%,#fff 65%);padding:96px 0 52px">
          <div class="wrap">
            <div class="eyebrow">${esc(brand)}</div>
            <h1 style="max-width:15ch">${esc(c.hero.title)}</h1>
            <p class="lead" style="margin-top:18px">${esc(c.hero.subtitle)}</p>
            <div style="margin-top:26px"><a class="btn" href="prescriptions.html">${esc(c.hero.ctaText)}</a></div>
            <div style="display:flex;gap:28px;flex-wrap:wrap;margin-top:44px">${c.highlights.map((h: any) => `<div><div style="font-size:28px;font-weight:800;color:${accent}">${esc(h.value)}</div><div style="color:#5f746c;font-size:14px">${esc(h.label)}</div></div>`).join("")}</div>
          </div>
        </section>`;
      const services = () => `
        <section class="wrap"><div class="eyebrow">Services</div><h2>Pharmacy support beyond the counter</h2>
          <div style="margin-top:32px;display:grid;gap:12px">
            ${c.services.map((s: any) => `<div style="padding:22px 24px;background:#f4faf7;border-radius:14px;display:grid;grid-template-columns:1fr auto;gap:14px"><div><h3 style="font-size:18px;font-weight:700;margin-bottom:6px">${esc(s.name)}</h3><p style="color:#55685f">${esc(s.desc)}</p></div><div style="font-family:${MONO};font-size:12px;color:${accent};font-weight:700">${esc(s.note)}</div></div>`).join("")}
          </div></section>`;
      const prescriptions = () => `
        <section class="wrap"><div class="eyebrow">Prescriptions</div><h2>${esc(c.prescriptions.heading)}</h2>
          <p class="lead">${esc(c.prescriptions.blurb)}</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-top:32px">
            ${c.prescriptions.steps.map((st: any, i: number) => `<div style="padding:22px;border:1px solid #d5e8df;border-radius:14px"><div style="width:32px;height:32px;border-radius:50%;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;margin-bottom:12px">${i + 1}</div><h3 style="font-size:17px;font-weight:700;margin-bottom:6px">${esc(st.title)}</h3><p style="color:#55685f;font-size:14px">${esc(st.body)}</p></div>`).join("")}
          </div>
          <ul style="margin-top:28px;list-style:none;display:grid;gap:8px">${c.prescriptions.tips.map((t: string) => `<li style="padding:10px 0;border-bottom:1px solid #e5eee9">— ${esc(t)}</li>`).join("")}</ul>
        </section>`;
      const wellness = () => `
        <section class="wrap"><div class="eyebrow">Wellness</div><h2>${esc(c.wellness.heading)}</h2>
          <p class="lead">${esc(c.wellness.blurb)}</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-top:32px">
            ${c.wellness.items.map((it: any) => `<div style="padding:22px;background:#f4faf7;border-radius:14px"><div style="font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${accent};font-weight:700">${esc(it.tag)}</div><h3 style="font-size:18px;font-weight:700;margin:8px 0 6px">${esc(it.name)}</h3><p style="color:#55685f;font-size:14px">${esc(it.desc)}</p></div>`).join("")}
          </div></section>`;
      const contact = () => `
        <section class="wrap" style="max-width:660px"><div class="eyebrow">Contact</div><h2>${esc(c.contact.heading)}</h2>
          <p class="lead" style="margin-bottom:24px">${esc(c.contact.blurb)}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div style="padding:20px;background:#f4faf7;border-radius:12px"><strong>Phone</strong><br>${esc(c.contact.phone)}</div>
            <div style="padding:20px;background:#f4faf7;border-radius:12px"><strong>Email</strong><br><a style="color:${accent}" href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></div>
            <div style="padding:20px;background:#f4faf7;border-radius:12px"><strong>Address</strong><br>${esc(c.contact.address)}</div>
            <div style="padding:20px;background:#f4faf7;border-radius:12px"><strong>Hours</strong><br>${esc(c.contact.hours)}</div>
          </div></section>`;
      const map: Record<string, () => string> = { home, services, prescriptions, wellness, contact };
      return (map[pageKey] || home)();
    },
  },

  /* ---------- 6. Telehealth — CareLink Virtual ---------- */
  {
    id: "telehealth",
    name: "CareLink Virtual",
    category: "Telehealth",
    tagline: "Secure video visits with clear pricing and specialties.",
    font: SANS,
    previewImage:
      "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80",
    previewAccent: "#2B6CB0",
    pages: [
      { key: "home", label: "Home", slug: "index.html" },
      { key: "how-it-works", label: "How it works", slug: "how-it-works.html" },
      { key: "specialties", label: "Specialties", slug: "specialties.html" },
      { key: "pricing", label: "Pricing", slug: "pricing.html" },
      { key: "contact", label: "Contact", slug: "contact.html" },
    ],
    availablePageDesigns: [...COMMON_DESIGNS, "blog"],
    schema: `{
 "hero":{"title":"","subtitle":"","ctaText":""},
 "benefits":[{"title":"","body":""},{"title":"","body":""},{"title":"","body":""}],
 "how":{"heading":"","blurb":"","steps":[{"title":"","body":""},{"title":"","body":""},{"title":"","body":""},{"title":"","body":""}]},
 "specialties":[{"name":"","desc":"","wait":""}, ...exactly 5 items],
 "pricing":[{"name":"","price":"","period":"","points":["","",""],"featured":false}, ...exactly 3 tiers],
 "contact":{"heading":"","blurb":"","email":"","phone":"","hours":"","coverage":""}
}`,
    fallback: {
      hero: {
        title: "Care from wherever you are",
        subtitle:
          "CareLink Virtual connects you with licensed clinicians for video visits, follow-ups, and clear next steps.",
        ctaText: "Start a visit",
      },
      benefits: [
        { title: "Secure video", body: "HIPAA-aware sessions on desktop or phone — no app install required." },
        { title: "Same-day slots", body: "Many specialties offer openings within hours on weekdays." },
        { title: "Visit summaries", body: "After each appointment, you receive notes and action items in writing." },
      ],
      how: {
        heading: "How a CareLink visit works",
        blurb: "From booking to follow-up, the path stays short and predictable.",
        steps: [
          { title: "Create your profile", body: "Share history, medications, and pharmacy details once." },
          { title: "Choose a specialty", body: "Pick the visit type that matches your concern." },
          { title: "Join by video", body: "Enter the waiting room a few minutes early from any browser." },
          { title: "Receive next steps", body: "Get a summary, prescriptions when appropriate, and referrals if needed." },
        ],
      },
      specialties: [
        { name: "Primary care", desc: "Routine concerns, follow-ups, and medication reviews.", wait: "Often same day" },
        { name: "Dermatology", desc: "Rash reviews and treatment plans with photo upload support.", wait: "1–2 days" },
        { name: "Mental health", desc: "Therapy and psychiatry consults with licensed clinicians.", wait: "Varies by state" },
        { name: "Urgent care", desc: "Colds, sinus issues, UTIs, and similar non-emergency needs.", wait: "Often within hours" },
        { name: "Women's health", desc: "Contraception consults and follow-up questions.", wait: "1–3 days" },
      ],
      pricing: [
        { name: "Urgent visit", price: "$59", period: "per visit", featured: false, points: ["15–20 minutes", "Message follow-up 24h", "Most states"] },
        { name: "Primary care", price: "$79", period: "per visit", featured: true, points: ["30 minutes", "Care plan summary", "Rx when appropriate"] },
        { name: "Specialty", price: "$99", period: "per visit", featured: false, points: ["Clinician matched", "Photo upload", "Referral letter option"] },
      ],
      contact: {
        heading: "Talk with CareLink support",
        blurb: "Billing, tech checks, and visit questions — our care desk replies on business days.",
        email: "support@carelink.virtual",
        phone: "+1 (555) 701-3300",
        hours: "Support: Mon–Fri 8am–8pm ET",
        coverage: "Availability varies by state and clinician license.",
      },
    },
    render(c, accent, brand, pageKey) {
      const home = () => `
        <section style="background:linear-gradient(180deg,#eef5fb 0%,#fff 70%);padding:100px 0 52px">
          <div class="wrap" style="text-align:center">
            <div class="eyebrow">${esc(brand)}</div>
            <h1 style="max-width:16ch;margin:0 auto">${esc(c.hero.title)}</h1>
            <p class="lead" style="margin:18px auto 0">${esc(c.hero.subtitle)}</p>
            <div style="margin-top:28px"><a class="btn" href="how-it-works.html">${esc(c.hero.ctaText)}</a></div>
          </div>
          <div class="wrap" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-top:48px">
            ${c.benefits.map((b: any) => `<div style="padding:22px;background:#fff;border:1px solid #d5e3f0;border-radius:14px;text-align:left"><h3 style="font-size:17px;font-weight:700;margin-bottom:6px">${esc(b.title)}</h3><p style="color:#55687a;font-size:14px">${esc(b.body)}</p></div>`).join("")}
          </div>
        </section>`;
      const how = () => `
        <section class="wrap"><div class="eyebrow">How it works</div><h2>${esc(c.how.heading)}</h2>
          <p class="lead">${esc(c.how.blurb)}</p>
          <div style="margin-top:36px;display:grid;gap:12px">
            ${c.how.steps.map((st: any, i: number) => `<div style="display:grid;grid-template-columns:64px 1fr;gap:16px;padding:22px;background:#f4f8fc;border-radius:14px"><div style="font-family:${MONO};font-size:24px;font-weight:800;color:${accent}">0${i + 1}</div><div><h3 style="font-size:18px;font-weight:700;margin-bottom:4px">${esc(st.title)}</h3><p style="color:#55687a">${esc(st.body)}</p></div></div>`).join("")}
          </div></section>`;
      const specialties = () => `
        <section class="wrap"><div class="eyebrow">Specialties</div><h2>Visit types we offer</h2>
          <div style="margin-top:32px;display:grid;gap:12px">
            ${c.specialties.map((s: any) => `<div style="padding:22px 24px;border:1px solid #d5e3f0;border-radius:14px;display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center"><div><h3 style="font-size:18px;font-weight:700;margin-bottom:4px">${esc(s.name)}</h3><p style="color:#55687a;font-size:15px">${esc(s.desc)}</p></div><div style="font-family:${MONO};font-size:12px;color:${accent};font-weight:700;white-space:nowrap">${esc(s.wait)}</div></div>`).join("")}
          </div></section>`;
      const pricing = () => `
        <section class="wrap" style="text-align:center"><div class="eyebrow">Pricing</div><h2>Transparent visit rates</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:36px;text-align:left">
            ${c.pricing.map((p: any) => `<div style="padding:26px;border:1px solid ${p.featured ? accent : "#d5e3f0"};border-radius:16px;background:${p.featured ? "#f4f8fc" : "#fff"}">${p.featured ? `<div style="font-family:${MONO};font-size:11px;color:${accent};font-weight:700;letter-spacing:.1em;margin-bottom:6px">POPULAR</div>` : ""}<h3 style="font-size:19px;font-weight:800">${esc(p.name)}</h3><div style="font-size:34px;font-weight:800;margin:10px 0;color:${accent}">${esc(p.price)}<span style="font-size:14px;color:#7a8794;font-weight:500"> ${esc(p.period)}</span></div><ul style="list-style:none;margin:14px 0 20px">${p.points.map((pt: string) => `<li style="padding:6px 0;color:#55687a;font-size:14px">— ${esc(pt)}</li>`).join("")}</ul><a class="btn" href="contact.html" style="display:block;text-align:center">Choose plan</a></div>`).join("")}
          </div></section>`;
      const contact = () => `
        <section class="wrap" style="max-width:660px"><div class="eyebrow">Contact</div><h2>${esc(c.contact.heading)}</h2>
          <p class="lead" style="margin-bottom:24px">${esc(c.contact.blurb)}</p>
          <div style="padding:26px;background:#f4f8fc;border-radius:16px;display:grid;gap:12px">
            <div><strong>Phone</strong><br>${esc(c.contact.phone)}</div>
            <div><strong>Email</strong><br><a style="color:${accent}" href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></div>
            <div><strong>Hours</strong><br>${esc(c.contact.hours)}</div>
            <div style="font-size:14px;color:#55687a">${esc(c.contact.coverage)}</div>
          </div></section>`;
      const map: Record<string, () => string> = {
        home,
        "how-it-works": how,
        specialties,
        pricing,
        contact,
      };
      return (map[pageKey] || home)();
    },
  },

  /* ---------- 7. Specialty — Apex Orthopedics ---------- */
  {
    id: "specialty",
    name: "Apex Orthopedics",
    category: "Specialty clinic (ortho)",
    tagline: "Orthopedic specialty care with clear treatment paths.",
    font: DISPLAY,
    previewImage:
      "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80",
    previewAccent: "#1F5C4D",
    pages: [
      { key: "home", label: "Home", slug: "index.html" },
      { key: "conditions", label: "Conditions", slug: "conditions.html" },
      { key: "treatments", label: "Treatments", slug: "treatments.html" },
      { key: "surgeons", label: "Surgeons", slug: "surgeons.html" },
      { key: "contact", label: "Contact", slug: "contact.html" },
    ],
    availablePageDesigns: [...COMMON_DESIGNS, "gallery", "careers"],
    schema: `{
 "hero":{"title":"","subtitle":"","ctaText":""},
 "focus":[{"title":"","body":""},{"title":"","body":""},{"title":"","body":""}],
 "conditions":[{"name":"","desc":"","area":""}, ...exactly 6 items],
 "treatments":[{"name":"","desc":"","path":""}, ...exactly 5 items],
 "surgeons":[{"name":"","role":"","focus":"","bio":""}, ...exactly 4 items],
 "contact":{"heading":"","blurb":"","email":"","phone":"","address":"","hours":""}
}`,
    fallback: {
      hero: {
        title: "Move with confidence again",
        subtitle:
          "Apex Orthopedics evaluates joints, sports injuries, and degenerative conditions with clear non-surgical and surgical options.",
        ctaText: "Request a consult",
      },
      focus: [
        { title: "Precise diagnosis", body: "Imaging and exam findings explained in plain language." },
        { title: "Conservative first", body: "Physical therapy and bracing considered before elective surgery." },
        { title: "Shared decisions", body: "You leave with a written plan, risks, and realistic recovery windows." },
      ],
      conditions: [
        { name: "Knee pain", desc: "Meniscus issues, arthritis, and instability evaluations.", area: "Knee" },
        { name: "Shoulder injuries", desc: "Rotator cuff, impingement, and instability care.", area: "Shoulder" },
        { name: "Hip arthritis", desc: "Mobility limits and joint replacement candidacy reviews.", area: "Hip" },
        { name: "Sports injuries", desc: "Sprains, fractures, and return-to-play planning.", area: "Sports" },
        { name: "Spine-related pain", desc: "Coordinated referrals for back and neck concerns.", area: "Spine" },
        { name: "Hand & wrist", desc: "Carpal tunnel, tendon issues, and fracture follow-up.", area: "Hand" },
      ],
      treatments: [
        { name: "Physical therapy plans", desc: "Home and clinic programs tailored to your goals.", path: "Non-surgical" },
        { name: "Injections", desc: "Guided options when appropriate for inflammation relief.", path: "Office-based" },
        { name: "Arthroscopy", desc: "Minimally invasive procedures for select joint problems.", path: "Surgical" },
        { name: "Joint replacement", desc: "Hip and knee arthroplasty with prehab and rehab pathways.", path: "Surgical" },
        { name: "Fracture care", desc: "Casting, bracing, and operative fixation when needed.", path: "Acute care" },
      ],
      surgeons: [
        { name: "Dr. Lena Ortiz", role: "Orthopedic surgeon", focus: "Knee & sports", bio: "Balances return-to-activity goals with durable joint health." },
        { name: "Dr. Michael Cho", role: "Orthopedic surgeon", focus: "Hip & joint replacement", bio: "Walks patients through every stage of elective joint care." },
        { name: "Dr. Aisha Rahman", role: "Orthopedic surgeon", focus: "Shoulder", bio: "Emphasizes therapy milestones before and after procedures." },
        { name: "Dr. Evan Cole", role: "Sports medicine", focus: "Injury recovery", bio: "Coordinates bracing, PT, and gradual activity progressions." },
      ],
      contact: {
        heading: "Schedule with Apex",
        blurb: "Bring prior imaging if you have it. New patient consults are available most weekdays.",
        email: "appointments@apexortho.clinic",
        phone: "+1 (555) 864-2200",
        address: "900 Summit Drive, Suite 300",
        hours: "Mon–Fri 7:30am–5pm",
      },
    },
    render(c, accent, brand, pageKey) {
      const home = () => `
        <section style="background:linear-gradient(175deg,#eef6f3 0%,#fff 68%);padding:100px 0 52px">
          <div class="wrap">
            <div class="eyebrow">${esc(brand)}</div>
            <h1 style="font-family:${DISPLAY};max-width:14ch">${esc(c.hero.title)}</h1>
            <p class="lead" style="margin-top:18px">${esc(c.hero.subtitle)}</p>
            <div style="margin-top:28px"><a class="btn" href="contact.html">${esc(c.hero.ctaText)}</a></div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-top:48px">
              ${c.focus.map((f: any) => `<div style="padding:22px;background:#fff;border:1px solid #d5e6df;border-radius:12px"><h3 style="font-family:${DISPLAY};font-size:20px;margin-bottom:6px">${esc(f.title)}</h3><p style="color:#55685f;font-size:14px">${esc(f.body)}</p></div>`).join("")}
            </div>
          </div>
        </section>`;
      const conditions = () => `
        <section class="wrap"><div class="eyebrow">Conditions</div><h2 style="font-family:${DISPLAY}">What we evaluate</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:32px">
            ${c.conditions.map((cond: any) => `<div style="padding:22px;border:1px solid #d5e6df;border-radius:14px;background:#f6faf8"><div style="font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${accent};font-weight:700">${esc(cond.area)}</div><h3 style="font-family:${DISPLAY};font-size:20px;margin:8px 0 6px">${esc(cond.name)}</h3><p style="color:#55685f;font-size:14px">${esc(cond.desc)}</p></div>`).join("")}
          </div></section>`;
      const treatments = () => `
        <section class="wrap"><div class="eyebrow">Treatments</div><h2 style="font-family:${DISPLAY}">Paths we discuss</h2>
          <div style="margin-top:32px;display:grid;gap:12px">
            ${c.treatments.map((t: any) => `<div style="padding:22px 24px;background:#f6faf8;border-radius:14px;border-left:4px solid ${accent};display:grid;grid-template-columns:1fr auto;gap:14px"><div><h3 style="font-family:${DISPLAY};font-size:20px;margin-bottom:6px">${esc(t.name)}</h3><p style="color:#55685f">${esc(t.desc)}</p></div><div style="font-family:${MONO};font-size:12px;color:${accent};font-weight:700;white-space:nowrap">${esc(t.path)}</div></div>`).join("")}
          </div></section>`;
      const surgeons = () => `
        <section class="wrap"><div class="eyebrow">Surgeons</div><h2 style="font-family:${DISPLAY}">Meet the team</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px;margin-top:36px">
            ${c.surgeons.map((s: any) => `<div style="padding-top:14px;border-top:3px solid ${accent}"><div style="font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${accent};font-weight:700">${esc(s.role)}</div><h3 style="font-family:${DISPLAY};font-size:22px;margin:8px 0 4px">${esc(s.name)}</h3><div style="color:#5f746c;font-size:14px;margin-bottom:10px">${esc(s.focus)}</div><p style="color:#444;font-size:15px">${esc(s.bio)}</p></div>`).join("")}
          </div></section>`;
      const contact = () => `
        <section class="wrap" style="max-width:680px"><div class="eyebrow">Contact</div><h2 style="font-family:${DISPLAY}">${esc(c.contact.heading)}</h2>
          <p class="lead" style="margin-bottom:24px">${esc(c.contact.blurb)}</p>
          <div style="display:grid;gap:12px;padding:28px;background:#1F5C4D;color:#f3faf7;border-radius:14px">
            <div>${esc(c.contact.phone)}</div>
            <div><a style="color:#a8e0c8" href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></div>
            <div>${esc(c.contact.address)}</div>
            <div>${esc(c.contact.hours)}</div>
          </div></section>`;
      const map: Record<string, () => string> = { home, conditions, treatments, surgeons, contact };
      return (map[pageKey] || home)();
    },
  },
];

export function getHealthcareTemplate(id: string) {
  return HEALTHCARE_TEMPLATES.find((t) => t.id === id);
}
