// lib/site-widgets.ts — interactive forms / CTAs injected into generated HTML
import { iconHTML } from "./site-media";

const esc = (s: unknown): string =>
  String(s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type SiteWidget =
  | {
      type: "lead-form";
      title: string;
      blurb?: string;
      fields: { name: string; label: string; kind?: "text" | "email" | "tel" | "textarea" | "select"; options?: string[] }[];
      submitLabel?: string;
    }
  | {
      type: "cta-band";
      title: string;
      blurb?: string;
      primaryLabel: string;
      primaryHref?: string;
      secondaryLabel?: string;
      secondaryHref?: string;
    };

export function interactiveCSS(accent: string): string {
  return `
    .site-form{background:linear-gradient(180deg,#fff,#f6f8fb);border:1px solid #e6e9ef;border-radius:20px;padding:28px;margin-top:28px;max-width:560px;box-shadow:0 18px 50px rgba(16,24,40,.06)}
    .site-form h3{font-size:22px;font-weight:800;margin-bottom:8px;letter-spacing:-.02em;display:flex;align-items:center;gap:10px}
    .site-form p{color:#5b6472;margin-bottom:18px;font-size:15px}
    .site-form label{display:block;font-size:13px;font-weight:700;margin:0 0 6px;color:#2d3440}
    .site-form .field{margin-bottom:14px}
    .site-form input,.site-form select,.site-form textarea{
      width:100%;padding:12px 14px;border:1px solid #d5dae3;border-radius:10px;font:inherit;background:#fff;color:#1a1a1a
    }
    .site-form input:focus,.site-form select:focus,.site-form textarea:focus{outline:2px solid ${accent}55;border-color:${accent}}
    .site-form textarea{min-height:96px;resize:vertical}
    .site-form .form-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:8px}
    .site-form .hint{font-size:12px;color:#7a8494}
    .cta-band{margin:48px 0 0;padding:44px 32px;border-radius:22px;background:
      linear-gradient(135deg,${accent} 0%,${accent}cc 55%,#111827 140%);color:#fff;position:relative;overflow:hidden}
    .cta-band::after{content:"";position:absolute;right:-40px;top:-40px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.12)}
    .cta-band h3{font-size:clamp(22px,3vw,32px);font-weight:800;letter-spacing:-.02em;margin-bottom:8px;position:relative;z-index:1;display:flex;align-items:center;gap:10px}
    .cta-band p{opacity:.92;max-width:52ch;margin-bottom:18px;position:relative;z-index:1}
    .cta-band .btn-row{display:flex;gap:12px;flex-wrap:wrap;position:relative;z-index:1}
    .cta-band .btn-ghost{background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.35);padding:12px 20px;border-radius:10px;font-weight:700;display:inline-flex;align-items:center;gap:8px}
    .sticky-cta{position:fixed;bottom:16px;right:16px;z-index:40;display:flex;gap:8px}
    .sticky-cta a{box-shadow:0 10px 30px rgba(0,0,0,.18)}
    .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:12px 18px;border-radius:999px;font-size:14px;font-weight:600;opacity:0;pointer-events:none;transition:.25s;z-index:50}
    .toast.show{opacity:1}
  `;
}

export function interactiveScript(): string {
  return `<div class="toast" id="site-toast">Thanks — we’ll follow up shortly.</div>
<script>
(function(){
  function showToast(msg){
    var t=document.getElementById('site-toast');
    if(!t) return;
    if(msg) t.textContent=msg;
    t.classList.add('show');
    setTimeout(function(){ t.classList.remove('show'); }, 2200);
  }
  document.querySelectorAll('form[data-site-form]').forEach(function(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      showToast(form.getAttribute('data-success') || 'Thanks — we’ll follow up shortly.');
      form.reset();
    });
  });
})();
</script>`;
}

export function renderWidget(widget: SiteWidget, accent: string): string {
  if (widget.type === "cta-band") {
    return `<div class="wrap"><div class="cta-band">
      <h3>${iconHTML("spark")} ${esc(widget.title)}</h3>
      ${widget.blurb ? `<p>${esc(widget.blurb)}</p>` : ""}
      <div class="btn-row">
        <a class="btn" href="${esc(widget.primaryHref || "contact.html")}" style="background:#fff;color:${accent}">${iconHTML("calendar")} ${esc(widget.primaryLabel)}</a>
        ${
          widget.secondaryLabel
            ? `<a class="btn-ghost" href="${esc(widget.secondaryHref || "#")}">${iconHTML("phone")} ${esc(widget.secondaryLabel)}</a>`
            : ""
        }
      </div>
    </div></div>`;
  }

  const fields = widget.fields
    .map((f) => {
      const id = esc(f.name);
      if (f.kind === "textarea") {
        return `<div class="field"><label for="${id}">${esc(f.label)}</label><textarea id="${id}" name="${id}" required></textarea></div>`;
      }
      if (f.kind === "select") {
        const opts = (f.options || ["Option A", "Option B"])
          .map((o) => `<option>${esc(o)}</option>`)
          .join("");
        return `<div class="field"><label for="${id}">${esc(f.label)}</label><select id="${id}" name="${id}">${opts}</select></div>`;
      }
      const type = f.kind || "text";
      return `<div class="field"><label for="${id}">${esc(f.label)}</label><input id="${id}" name="${id}" type="${type}" required /></div>`;
    })
    .join("");

  return `<div class="wrap"><form class="site-form" data-site-form data-success="Submitted — thank you!">
    <h3>${iconHTML("mail")} ${esc(widget.title)}</h3>
    ${widget.blurb ? `<p>${esc(widget.blurb)}</p>` : ""}
    ${fields}
    <div class="form-actions">
      <button class="btn" type="submit">${iconHTML("check")} ${esc(widget.submitLabel || "Submit")}</button>
      <span class="hint">Demo form — wires to your backend when you deploy.</span>
    </div>
  </form></div>`;
}

export function defaultContactForm(brand: string): SiteWidget {
  return {
    type: "lead-form",
    title: `Contact ${brand}`,
    blurb: "Send a message and we’ll get back within one business day.",
    fields: [
      { name: "name", label: "Full name", kind: "text" },
      { name: "email", label: "Email", kind: "email" },
      { name: "phone", label: "Phone", kind: "tel" },
      { name: "message", label: "How can we help?", kind: "textarea" },
    ],
    submitLabel: "Send message",
  };
}

export function defaultHomeCta(brand: string): SiteWidget {
  return {
    type: "cta-band",
    title: `Ready to get started with ${brand}?`,
    blurb: "Book online in minutes — or tell us what you need and we’ll follow up.",
    primaryLabel: "Book now",
    primaryHref: "contact.html",
    secondaryLabel: "Talk to us",
    secondaryHref: "contact.html",
  };
}

export function defaultHomeLeadForm(): SiteWidget {
  return {
    type: "lead-form",
    title: "Request a callback",
    blurb: "Share a few details and we’ll reach out to confirm next steps.",
    fields: [
      { name: "name", label: "Name", kind: "text" },
      { name: "email", label: "Email", kind: "email" },
      { name: "phone", label: "Phone", kind: "tel" },
      {
        name: "interest",
        label: "I’m interested in",
        kind: "select",
        options: ["New appointment", "Insurance question", "General inquiry", "Partnership"],
      },
    ],
    submitLabel: "Request callback",
  };
}

/** Infer widgets from a natural-language studio instruction. */
export function widgetsFromInstruction(instruction: string): SiteWidget[] {
  const msg = instruction.toLowerCase();
  const out: SiteWidget[] = [];

  if (/\b(form|intake|questionnaire|signup|sign-up|registration)\b/.test(msg)) {
    const isInsurance = /\binsurance\b/.test(msg);
    const isBooking = /\b(book|appointment|schedule|visit)\b/.test(msg);
    out.push({
      type: "lead-form",
      title: isInsurance
        ? "Insurance information"
        : isBooking
          ? "Book an appointment"
          : "Get in touch",
      blurb: isInsurance
        ? "Share your plan details so we can verify coverage before your visit."
        : "Fill this out and we’ll confirm shortly.",
      fields: isInsurance
        ? [
            { name: "name", label: "Patient name", kind: "text" },
            { name: "dob", label: "Date of birth", kind: "text" },
            { name: "carrier", label: "Insurance carrier", kind: "text" },
            { name: "memberId", label: "Member ID", kind: "text" },
            { name: "group", label: "Group number", kind: "text" },
            { name: "notes", label: "Notes", kind: "textarea" },
          ]
        : isBooking
          ? [
              { name: "name", label: "Full name", kind: "text" },
              { name: "email", label: "Email", kind: "email" },
              { name: "phone", label: "Phone", kind: "tel" },
              { name: "preferred", label: "Preferred date/time", kind: "text" },
              { name: "reason", label: "Reason for visit", kind: "textarea" },
            ]
          : [
              { name: "name", label: "Name", kind: "text" },
              { name: "email", label: "Email", kind: "email" },
              { name: "message", label: "Message", kind: "textarea" },
            ],
      submitLabel: isInsurance ? "Submit insurance info" : isBooking ? "Request appointment" : "Submit",
    });
  }

  if (/\b(cta|call to action|banner|promo)\b/.test(msg) || (/\bemphasize\b/.test(msg) && /\bbook|cta\b/.test(msg))) {
    out.push({
      type: "cta-band",
      title: "Take the next step today",
      blurb: "Modern sites convert with clear CTAs — this one is ready for your offer.",
      primaryLabel: "Get started",
      primaryHref: "contact.html",
      secondaryLabel: "Learn more",
      secondaryHref: "#",
    });
  }

  return out;
}

/** True when the user wants a form/section on an existing page, not a brand-new page. */
export function isInlinePageEdit(instruction: string): boolean {
  const msg = instruction.toLowerCase();
  if (/\b(on|in|to|into|for)\s+(the\s+)?(home|homepage|landing|this)\b/.test(msg)) return true;
  if (/\b(home|homepage)\s+page\b/.test(msg) && /\b(form|section|cta|banner|headline|tone)\b/.test(msg)) {
    return true;
  }
  if (/\b(form|section|cta)\b/.test(msg) && !/\b(add|create|include)\b.{0,20}\bpage\b/.test(msg)) {
    // "add insurance form" without "page" → treat as inline
    if (/\bform\b/.test(msg) && !/\bpages?\b/.test(msg)) return true;
  }
  return false;
}
