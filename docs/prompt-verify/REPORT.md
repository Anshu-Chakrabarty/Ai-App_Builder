# Prompt verification report

Generated: 2026-08-05T16:00:46.268Z
Template engine: `hospital` (Meridian General)

## Generation prompt

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

## Baseline (before any Studio edits)

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

Baseline Services snippet is in `baseline/services-snippet.html`.

## Edit prompts — did preview HTML actually change?

### ✅ PASS — 01-six-cards-images-3col

**Prompt:**

```
in this area their are 4 cards ....make it 6 cards and also modify the cards with images and text and make it align as 3 by 3 - Services at a glance
```

Resolved target: `home.services`
Update IDs: services, layout.serviceColumns, styles.patches.service-grid

| Metric | Before | After |
|--------|--------|-------|
| brandName | "Fort Hospital" | "Fort Hospital" |
| accent | "#1B4F72" | "#1B4F72" |
| heroTitle | "Care for our community, every day" | "Care for our community, every day" |
| serviceCount | 4 | 6 |
| serviceCardsInHtml | 4 | 6 |
| servicesWithImages | 0 | 6 |
| serviceColumns | null | 3 |
| galleryHidden | false | false |
| servicesHidden | false | false |
| hasServicesHeading | true | true |
| hasHeroTitleInHtml | true | true |

Files: `after-01-six-cards-images-3col/home.html`, `after-01-six-cards-images-3col/services-snippet.html`

### ✅ PASS — 02-remove-three-named

**Prompt:**

```
remove three cards from Services at a glance
```

Resolved target: `home.services`
Update IDs: services

| Metric | Before | After |
|--------|--------|-------|
| brandName | "Fort Hospital" | "Fort Hospital" |
| accent | "#1B4F72" | "#1B4F72" |
| heroTitle | "Care for our community, every day" | "Care for our community, every day" |
| serviceCount | 6 | 3 |
| serviceCardsInHtml | 6 | 3 |
| servicesWithImages | 6 | 3 |
| serviceColumns | null | null |
| galleryHidden | false | false |
| servicesHidden | false | false |
| hasServicesHeading | true | true |
| hasHeroTitleInHtml | true | true |

Files: `after-02-remove-three-named/home.html`, `after-02-remove-three-named/services-snippet.html`

### ✅ PASS — 03-remove-three-selected

**Prompt:**

```
remove three cards
```

Resolved target: `home.services`
Update IDs: services

| Metric | Before | After |
|--------|--------|-------|
| brandName | "Fort Hospital" | "Fort Hospital" |
| accent | "#1B4F72" | "#1B4F72" |
| heroTitle | "Care for our community, every day" | "Care for our community, every day" |
| serviceCount | 6 | 3 |
| serviceCardsInHtml | 6 | 3 |
| servicesWithImages | 6 | 3 |
| serviceColumns | null | null |
| galleryHidden | false | false |
| servicesHidden | false | false |
| hasServicesHeading | true | true |
| hasHeroTitleInHtml | true | true |

Files: `after-03-remove-three-selected/home.html`, `after-03-remove-three-selected/services-snippet.html`

### ✅ PASS — 04-align-3-columns-named

**Prompt:**

```
Align Services at a glance into 3 columns
```

Resolved target: `home.services`
Update IDs: layout.serviceColumns

| Metric | Before | After |
|--------|--------|-------|
| brandName | "Fort Hospital" | "Fort Hospital" |
| accent | "#1B4F72" | "#1B4F72" |
| heroTitle | "Care for our community, every day" | "Care for our community, every day" |
| serviceCount | 4 | 4 |
| serviceCardsInHtml | 4 | 4 |
| servicesWithImages | 0 | 0 |
| serviceColumns | null | 3 |
| galleryHidden | false | false |
| servicesHidden | false | false |
| hasServicesHeading | true | true |
| hasHeroTitleInHtml | true | true |

Files: `after-04-align-3-columns-named/home.html`, `after-04-align-3-columns-named/services-snippet.html`

### ✅ PASS — 05-hero-title-named

**Prompt:**

```
Change the hero title to "Care close to home"
```

Resolved target: `home.hero`
Update IDs: hero.title

| Metric | Before | After |
|--------|--------|-------|
| brandName | "Fort Hospital" | "Fort Hospital" |
| accent | "#1B4F72" | "#1B4F72" |
| heroTitle | "Care for our community, every day" | "Care close to home" |
| serviceCount | 4 | 4 |
| serviceCardsInHtml | 4 | 4 |
| servicesWithImages | 0 | 0 |
| serviceColumns | null | null |
| galleryHidden | false | false |
| servicesHidden | false | false |
| hasServicesHeading | true | true |
| hasHeroTitleInHtml | true | true |

Files: `after-05-hero-title-named/home.html`, `after-05-hero-title-named/services-snippet.html`

### ✅ PASS — 06-hide-gallery-named

**Prompt:**

```
hide the gallery section
```

Resolved target: `home.gallery`
Update IDs: home.gallery

| Metric | Before | After |
|--------|--------|-------|
| brandName | "Fort Hospital" | "Fort Hospital" |
| accent | "#1B4F72" | "#1B4F72" |
| heroTitle | "Care for our community, every day" | "Care for our community, every day" |
| serviceCount | 4 | 4 |
| serviceCardsInHtml | 4 | 4 |
| servicesWithImages | 0 | 0 |
| serviceColumns | null | null |
| galleryHidden | false | true |
| servicesHidden | false | false |
| hasServicesHeading | true | true |
| hasHeroTitleInHtml | true | true |

Files: `after-06-hide-gallery-named/home.html`, `after-06-hide-gallery-named/services-snippet.html`

### ✅ PASS — 07-accent-teal

**Prompt:**

```
Change the accent color to #0F766E
```

Resolved target: `(none)`
Update IDs: theme.primary, styles.tokens.primary

| Metric | Before | After |
|--------|--------|-------|
| brandName | "Fort Hospital" | "Fort Hospital" |
| accent | "#1B4F72" | "#0f766e" |
| heroTitle | "Care for our community, every day" | "Care for our community, every day" |
| serviceCount | 4 | 4 |
| serviceCardsInHtml | 4 | 4 |
| servicesWithImages | 0 | 0 |
| serviceColumns | null | null |
| galleryHidden | false | false |
| servicesHidden | false | false |
| hasServicesHeading | true | true |
| hasHeroTitleInHtml | true | true |

Files: `after-07-accent-teal/home.html`, `after-07-accent-teal/services-snippet.html`

## Summary

**7/7 prompts produced real config + HTML changes.**

## How to check in Claude

1. Open `baseline/services-snippet.html` and one `after-*/services-snippet.html`.
2. Paste both into Claude with: *"Did the edit prompt change the HTML as claimed?"*
3. Or paste this whole `REPORT.md` and ask Claude to confirm each PASS/FAIL row.
