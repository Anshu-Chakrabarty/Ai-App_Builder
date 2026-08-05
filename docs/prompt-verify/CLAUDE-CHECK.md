# Claude check pack — Fort Hospital prompt edits

You are verifying whether Studio edit prompts actually mutate website HTML.

## Site generation prompt
```
Fort Hospital — a modern multi-specialty clinic website.

Home Page with hero banner, emergency contact, specialties, featured doctors, testimonials, and CTAs.
Include a "Services at a glance" section with service cards.
About Us (Vision, Mission, Management).
Departments (Cardiology, Neurology, Orthopaedics, Pediatrics).

Brand: Fort Hospital
Tone: calm, trustworthy, clinical but warm
Accent: teal / deep blue
```

## Baseline metrics
```json
{
  "brandName": "Fort Hospital",
  "accent": "#1B4F72",
  "heroTitle": "Care for our community, every day",
  "serviceCount": 4,
  "serviceCardsInHtml": 4,
  "servicesWithImages": 0,
  "serviceColumns": null,
  "galleryHidden": false,
  "servicesHidden": false,
  "hasServicesHeading": true,
  "hasHeroTitleInHtml": true
}
```

## Baseline Services HTML snippet
```html
<section data-ai-section="services" data-ai-id="home.services" id="services" class="wrap services" style="padding-top:40px">
          <div class="eyebrow">Care pathways</div><h2>Services at a glance</h2>
          <div class="service-cards-grid">
      <a class="service-card" href="#" data-ai-id="services.0"><div class="service-card-body"><div class="service-card-name" data-ai-id="services.0.name">Patient Scheduling</div><div class="service-card-desc" data-ai-id="services.0.desc">Book visits online or by phone.</div></div></a><a class="service-card" href="#" data-ai-id="services.1"><div class="service-card-body"><div class="service-card-name" data-ai-id="services.1.name">Primary Care</div><div class="service-card-desc" data-ai-id="services.1.desc">Same-week appointments with continuity.</div></div></a><a class="service-card" href="#" data-ai-id="services.2"><div class="service-card-body"><div class="service-card-name" data-ai-id="services.2.name">Diagnostics</div><div class="service-card-desc" data-ai-id="services.2.desc">On-site labs and imaging.</div></div></a><a class="service-card" href="#" data-ai-id="services.3"><div class="service-card-body"><div class="service-card-name" data-ai-id="services.3.name">Care Navigation</div><div class="service-card-desc" data-ai-id="services.3.desc">Guidance from intake through recovery.</div></div></a>
    </div>
        </section>
```

## After: 01-six-cards-images-3col — PASS

Prompt: `in this area their are 4 cards ....make it 6 cards and also modify the cards with images and text and make it align as 3 by 3 - Services at a glance`

Metrics after: ```json
{
  "brandName": "Fort Hospital",
  "accent": "#1B4F72",
  "heroTitle": "Care for our community, every day",
  "serviceCount": 6,
  "serviceCardsInHtml": 6,
  "servicesWithImages": 6,
  "serviceColumns": 3,
  "galleryHidden": false,
  "servicesHidden": false,
  "hasServicesHeading": true,
  "hasHeroTitleInHtml": true
}
```

```html
<section data-ai-section="services" data-ai-id="home.services" id="services" class="wrap services" style="padding-top:40px">
          <div class="eyebrow">Care pathways</div><h2>Services at a glance</h2>
          <div class="service-cards-grid">
      <a class="service-card" href="#" data-ai-id="services.0"><img data-ai-id="services.0.image" src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1600&q=80" alt="" loading="lazy" ><div class="service-card-body"><div class="service-card-name" data-ai-id="services.0.name">Patient Scheduling</div><div class="service-card-desc" data-ai-id="services.0.desc">Book visits online or by phone.</div></div></a><a class="service-card" href="#" data-ai-id="services.1"><img data-ai-id="services.1.image" src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1600&q=80" alt="" loading="lazy" ><div class="service-card-body"><div class="service-card-name" data-ai-id="services.1.name">Primary Care</div><div class="service-card-desc" data-ai-id="services.1.desc">Same-week appointments with continuity.</div></div></a><a class="service-card" href="#" data-ai-id="services.2"><img data-ai-id="services.2.image" src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1600&q=80" alt="" loading="lazy" ><div class="service-card-body"><div class="service-card-name" data-ai-id="services.2.name">Diagnostics</div><div class="service-card-desc" data-ai-id="services.2.desc">On-site labs and imaging.</div></div></a><a class="service-card" href="#" data-ai-id="services.3"><img data-ai-id="services.3.image" src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1600&q=80" alt="" loading="lazy" ><div class="service-card-body"><div class="service-card-name" data-ai-id="services.3.name">Care Navigation</div><div class="service-card-desc" data-ai-id="services.3.desc">Guidance from intake through recovery.</div></div></a><a class="service-card" href="#" data-ai-id="services.4"><img data-ai-id="services.4.image" src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1600&q=80" alt="" loading="lazy" ><div class="service-card-body"><div class="service-card-name" data-ai-id="services.4.name">Patient portal</div><div class="service-card-desc" data-ai-id="services.4.desc">Records, messaging, and prescriptions in one place.</div></div></a><a class="service-card" href="#" data-ai-id="services.5"><img data-ai-id="services.5.image" src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1600&q=80" alt="" loading="lazy" ><div class="service-card-body"><div class="service-card-name" data-ai-id="services.5.name">Care navigation</div><div class="service-card-desc" data-ai-id="services.5.desc">Guidance from intake through recovery.</div></div></a>
    </div>
        </section>
```

## After: 02-remove-three-named — PASS

Prompt: `remove three cards from Services at a glance`

Metrics after: ```json
{
  "brandName": "Fort Hospital",
  "accent": "#1B4F72",
  "heroTitle": "Care for our community, every day",
  "serviceCount": 3,
  "serviceCardsInHtml": 3,
  "servicesWithImages": 3,
  "serviceColumns": null,
  "galleryHidden": false,
  "servicesHidden": false,
  "hasServicesHeading": true,
  "hasHeroTitleInHtml": true
}
```

```html
<section data-ai-section="services" data-ai-id="home.services" id="services" class="wrap services" style="padding-top:40px">
          <div class="eyebrow">Care pathways</div><h2>Services at a glance</h2>
          <div class="service-cards-grid">
      <a class="service-card" href="#" data-ai-id="services.0"><img data-ai-id="services.0.image" src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=900&q=80&auto=format&fit=crop" alt="" loading="lazy" ><div class="service-card-body"><div class="service-card-name" data-ai-id="services.0.name">Service 1</div><div class="service-card-desc" data-ai-id="services.0.desc">Description for service 1</div></div></a><a class="service-card" href="#" data-ai-id="services.1"><img data-ai-id="services.1.image" src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=900&q=80&auto=format&fit=crop" alt="" loading="lazy" ><div class="service-card-body"><div class="service-card-name" data-ai-id="services.1.name">Service 2</div><div class="service-card-desc" data-ai-id="services.1.desc">Description for service 2</div></div></a><a class="service-card" href="#" data-ai-id="services.2"><img data-ai-id="services.2.image" src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=900&q=80&auto=format&fit=crop" alt="" loading="lazy" ><div class="service-card-body"><div class="service-card-name" data-ai-id="services.2.name">Service 3</div><div class="service-card-desc" data-ai-id="services.2.desc">Description for service 3</div></div></a>
    </div>
        </section>
```

## After: 03-remove-three-selected — PASS

Prompt: `remove three cards`

Metrics after: ```json
{
  "brandName": "Fort Hospital",
  "accent": "#1B4F72",
  "heroTitle": "Care for our community, every day",
  "serviceCount": 3,
  "serviceCardsInHtml": 3,
  "servicesWithImages": 3,
  "serviceColumns": null,
  "galleryHidden": false,
  "servicesHidden": false,
  "hasServicesHeading": true,
  "hasHeroTitleInHtml": true
}
```

```html
<section data-ai-section="services" data-ai-id="home.services" id="services" class="wrap services" style="padding-top:40px">
          <div class="eyebrow">Care pathways</div><h2>Services at a glance</h2>
          <div class="service-cards-grid">
      <a class="service-card" href="#" data-ai-id="services.0"><img data-ai-id="services.0.image" src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=900&q=80&auto=format&fit=crop" alt="" loading="lazy" ><div class="service-card-body"><div class="service-card-name" data-ai-id="services.0.name">Service 1</div><div class="service-card-desc" data-ai-id="services.0.desc">Description for service 1</div></div></a><a class="service-card" href="#" data-ai-id="services.1"><img data-ai-id="services.1.image" src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=900&q=80&auto=format&fit=crop" alt="" loading="lazy" ><div class="service-card-body"><div class="service-card-name" data-ai-id="services.1.name">Service 2</div><div class="service-card-desc" data-ai-id="services.1.desc">Description for service 2</div></div></a><a class="service-card" href="#" data-ai-id="services.2"><img data-ai-id="services.2.image" src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=900&q=80&auto=format&fit=crop" alt="" loading="lazy" ><div class="service-card-body"><div class="service-card-name" data-ai-id="services.2.name">Service 3</div><div class="service-card-desc" data-ai-id="services.2.desc">Description for service 3</div></div></a>
    </div>
        </section>
```

## Ask Claude

For each edit: did service card count / images / columns / heading visibility change vs baseline? Answer PASS or FAIL with evidence from the HTML.