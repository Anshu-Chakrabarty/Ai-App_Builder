# Studio Prompts — Verified Cheat Sheet

Paste-ready prompts for **AppBuilder AI Studio**.  
Every example below was checked with an automated preview QA (`npm run qa:prompts:all`) — the edit must land in **config** and show in the **live HTML preview**.

**Tip:** Click the section in the preview first, then send the prompt. That sets a precise target.

**How to re-verify locally**

```bash
npm run qa:prompts:all
```

---

## 1. Copy & headlines

```text
Change the hero title to "Welcome to Fort Care"
Set the subtitle to "Same-week visits with a calm clinic feel."
Change the features heading to "Why patients stay"
Change the first feature title to "Online booking"
```

| Works when | Preview shows |
|------------|----------------|
| Hero / features selected or named | New title/subtitle text in the iframe |

---

## 2. Buttons & CTAs

```text
Make the hero CTA say "Book a visit"
Make the hero CTA say "Get started free"
Change the CTA to "Schedule online"
```

| Works when | Preview shows |
|------------|----------------|
| Home hero visible | Button label updates |

---

## 3. Brand

```text
Rename the site brand to "Fort Hospital"
```

| Works when | Preview shows |
|------------|----------------|
| Any page | Nav brand + footer name update |

---

## 4. Theme & colors

```text
Change the accent color to #0F766E
Set the primary brand color to teal
Change the background to #F8FAFC
Set the accent to navy
```

| Works when | Preview shows |
|------------|----------------|
| Site-wide | Buttons, links, accents, page background |

---

## 5. Styles, hover & motion

```text
Make nav links turn teal on hover with an underline
Add a hover lift animation on cards
Make buttons lift slightly on hover
```

| Works when | Preview shows |
|------------|----------------|
| Desktop preview | Hover styles / motion CSS injected |

---

## 6. Service cards (“Services at a glance”)

**Most important for Fort Hospital–style sites**

```text
make it 6 cards with images and text and align as 3 by 3 - Services at a glance
Show 8 service cards with photos
make it 3 cards - Services at a glance
Align Services at a glance into 3 columns
make it 6 cards with images and text - Services at a glance
```

| Works when | Preview shows |
|------------|----------------|
| Services / highlights section selected | Exact card count, images on cards, 3-column grid |

---

## 7. Layout (features & gallery)

```text
Put the feature icons in a 2-column grid
Put the gallery in a 3-column equal grid
Align this section in a 3-column row
```

| Works when | Preview shows |
|------------|----------------|
| Features or gallery selected | Column CSS on `.feature-icons` / `.photo-grid` |

---

## 8. Images

```text
Replace the hero background image with a modern clinic photo
Change the split section image
Update the first gallery card image
```

Upload an image in Studio, then:

```text
Use this image on the hero
Replace the Delivery gallery card with this photo
```

| Works when | Preview shows |
|------------|----------------|
| Image / gallery target | New `src` on hero, split, or gallery tile |

---

## 9. Sections (hide / show)

```text
Hide the gallery section on Home
Hide the features section
Show the features section again
Hide the split section
```

| Works when | Preview shows |
|------------|----------------|
| Section selected or named | Section gets `hidden` / `display:none` |

---

## 10. Forms

```text
Rewrite the form title to "Talk to our care team"
Change the form submit button to "Send message"
Change the form submit button to "Request a callback"
```

| Works when | Preview shows |
|------------|----------------|
| Home form / lead form visible | Form heading + submit label |

---

## 11. Pages

```text
Delete the Contact page
Remove the Blog page
```

| Works when | Preview shows |
|------------|----------------|
| Non-home page exists | Page removed from nav + site map |

> Adding a brand-new page may ask you to pick a design template in Studio.

---

## 12. Compound prompts (still reliable)

```text
in this area their are 4 cards ....make it 6 cards and also modify the cards with images and text and make it align as 3 by 3 - Services at a glance
```

```text
Change the accent to teal, make nav hover underline, and keep gallery images unchanged.
```

```text
On Home: rewrite hero title to "Care close to home" and CTA to "Book a visit".
```

---

## Prompt formula

```text
[Action] + [What] + [Where] + [Details]
```

**Good**

```text
Make it 6 service cards with images in 3 columns on Home.
Change the hero title to "Fort Hospital Care".
Hide the gallery section — don't touch the hero.
```

**Weak**

```text
Make it better
Fix this
Update the site
```

---

## Targeting cheat sheet

| Goal | Do this |
|------|---------|
| One section | Click it in preview, or say “in the hero / gallery / services” |
| Service cards | Select **Services at a glance**, then card-count prompt |
| One gallery tile | “first gallery card” / “Care gallery image” |
| Follow-up | “make it warmer”, “shorter”, “3 columns” (keeps last target) |
| New topic | “New request: …” or click a different section |

---

## QA status (automated)

| Category | Cases | Preview verified |
|----------|------:|:----------------:|
| Copy | 4 | ✅ |
| Buttons | 1 | ✅ |
| Brand | 1 | ✅ |
| Theme | 3 | ✅ |
| Styles | 2 | ✅ |
| Cards | 3 | ✅ |
| Layout | 3 | ✅ |
| Images | 3 | ✅ |
| Sections | 3 | ✅ |
| Forms | 2 | ✅ |
| Pages | 1 | ✅ |
| **Total** | **26** | **✅** |

Last run: `npm run qa:prompts:all` — **26/26 passed**.

---

## Related docs

- Broader narrative guide: [`website-prompt-guide.md`](./website-prompt-guide.md)
- QA scripts: `scripts/qa-all-prompts.ts`, `scripts/qa-prompts.ts`
