# Website Builder — Prompt Guide

**Turning natural language into structured site edits**  
Based on the Prompt Interpreter Layer pattern (NL → structured instruction → site agent → live preview).

Use this guide when chatting in **Studio**. Click a section in the preview first when you can — then prompt. That sets a clear target and makes edits more reliable.

---

## How the system thinks (website version)

```
User prompt
    → Natural Language (intent)
    → ★ Prompt Interpretation Layer (MIDDLE) → structured technical JSON
    → Design Planning (allowed IDs)
    → Website AI Agent (apply instruction — Gemini only if needed)
    → Validation (intended-only)
    → Live preview / download
```

The **Prompt Interpreter** always runs in the middle. It turns any natural-language request into structured actions (`copy_update`, `style_update`, `image_update`, `page_ops`, …) with constraints — so the editor never guesses from raw chat alone.

**Efficiency tip:** Clear prompts (page + section + action) often resolve **locally inside the interpreter** (no Gemini). Ambiguous prompts get a small interpreter LLM call, then a scoped edit.

**Context the interpreter uses**

| Context | What it means for you |
|--------|------------------------|
| Site structure | Pages: Home, About, Contact, … |
| Sections | Hero, features, split, gallery, CTA, form, cards |
| Editable IDs | `hero.title`, `media.gallery.2`, `styles.nav.hoverColor`, … |
| Styles channel | Colors, hover, transitions, animations (CSS-safe) |
| Chat + work log | Follow-ups like “make it warmer” stay on the same target |

**Golden rule:** Say **what** to change, **where**, and **how it should look/behave**. Vague “make it better” works only after you’ve selected a section or named it.

---

## Prompt formula (copy this shape)

```text
[Action] + [Component] + [on Page / in Section] + [details] + [constraints]
```

**Examples**

```text
Add a primary “Sign Up” button to the Home hero, under the subtitle.
Change the nav link hover to teal with an underline — don’t change images.
Rewrite the About page heading to “Our Story” and keep the current layout.
```

---

## 1. Buttons & links

### Add

```text
Add a “Sign Up” button to the Home hero.
Add a secondary “Skip” / “Learn more” text link below the hero subtitle.
Add a “Book a demo” CTA button in the sticky contact bar.
Add a ghost “View menu” button next to the primary CTA on Home.
Add a text-style “Learn more” link at the bottom of the features section.
```

### Change

```text
Make the hero CTA say “Get started free” instead of “Book now”.
Turn the secondary button into an outline style.
Make the Contact nav item look like a filled CTA pill.
```

### Remove

```text
Remove the Sign Up button from the hero.
Remove the secondary “Learn more” link under the features title.
```

---

## 2. Single input fields

```text
Add a search box under the Home hero title.
Add an email input field to the Home lead form.
Add a phone number field to the contact form.
Make the email field placeholder “you@company.com”.
```

---

## 3. Forms (multiple fields + submit)

```text
Add a contact form with name, email, and message on the Contact page.
Add a login-style form with email and password on a new Account page.
Add a signup form (name, email, password) below the Home CTA.
Add a feedback form with a rating field and a comment field on Home.
Add a newsletter form with only an email field and a “Subscribe” button in the footer area / CTA band.
Rewrite the form title to “Talk to our team” and the submit button to “Send message”.
```

### Remove

```text
Remove the contact form from the Contact page.
Hide the lead form on Home (don’t delete the page).
```

---

## 4. Cards

```text
Add a card summarizing our return policy on the Home page.
Add a stats card showing “1200+ orders” next to the features section.
Add three feature cards: Fast delivery, Fresh ingredients, Easy reorder — short body text for each.
Make the feature cards equal height with a soft hover lift.
Change the second feature card title to “Same-day delivery”.
```

### Remove

```text
Remove the return-policy card.
Hide the features section on Home.
```

---

## 5. Product / plan grids (website “cart-like” blocks)

Website equivalent of meal plans / catalog tiles:

```text
Add 4 meal plans to the Home gallery/cards area — each with a name, short description, and an “Add to Cart” / “Order” button label in the caption or CTA style.
Add a pricing section with 3 plans: Starter, Pro, Business — price and 3 bullets each.
Show 6 product cards in an equal 3-column grid on desktop, 1 column on mobile.
Rename the Delivery gallery card caption and swap its image.
```

---

## 6. Hero / banner / split sections

```text
Rewrite the Home hero title to “Dinner that arrives hot”.
Shorten the hero subtitle to one sentence.
Change the hero background image.
Change only the split-section photo (right column) — not the hero.
Update the inner-page banner image on About.
Make the hero CTA group stack on mobile (full-width buttons).
```

---

## 7. Gallery / photo grid

```text
Change the Delivery card image.
Update gallery card 3 with a warmer food photo.
Align the gallery into 3 equal columns.
Switch gallery layout to equal grid (not featured/masonry).
Add captions under each gallery shot if missing.
```

**Tip:** Name the card (“Delivery”, “Menu”, “Dining”) so the agent hits `media.gallery.N` — not the nav “menu”.

---

## 8. Navigation & pages

```text
Add a Pricing page with hero, pricing cards, FAQ, and CTA.
Add an About page using the same design language as Home.
Delete the Blog page (keep Home).
Rename the Services page label to “Offerings”.
Make nav links underline on hover in the brand accent color.
Make the active nav link bold and accent-colored.
Don’t change gallery images — only nav hover styles.
```

---

## 9. Colors, theme, CSS, motion

```text
Change the site accent to teal (#0d9488).
Set the page background to soft cream.
Make nav links underline on hover with a smooth 200ms transition.
Add a gentle hover lift to buttons and feature cards.
Fade-in sections on load (respect reduced-motion).
Make button hover scale slightly (1.04) with brightness boost.
Add custom CSS: softer card shadows and 16px radius on buttons.
```

---

## 10. Copy & tone

```text
Make the Home hero warmer and more conversational.
Shorten every feature card body to one line.
Rewrite the CTA band to “Ready when you are” with button “Order tonight”.
Keep brand name unchanged; only rewrite headlines.
```

---

## 11. Layout & structure

```text
Put the gallery in a 3-column equal grid.
Make feature icons 2 columns on tablet, 1 on phone.
Hide the split section on Home.
Show the CTA band again.
Move emphasis to the form — make the form title larger, keep images as-is.
```

---

## 12. Remove / undo / scope control

```text
Remove the Sign Up button.
Remove the contact form.
Hide the gallery section (don’t delete the page).
Undo the last change.
Only change the hero — leave gallery and nav alone.
This is a new request (ignore previous target): update the Contact page heading.
```

---

## 13. Multi-step / compound prompts (interpreter-friendly)

These map cleanly to structured actions:

```text
Make the Home page look more modern: rounder cards, softer shadows, and add a Google-style “Continue with Google” button under the lead form — keep existing navigation and don’t touch the backend/form field names beyond labels.
```

```text
On Contact: add a form with name, email, message; primary submit “Send”; secondary text link “Prefer to call? See hours” below — keep page banner image.
```

```text
Home gallery: 4 meal plans with name + short description each; equal 2×2 grid; Order button styling via CTA color; don’t rewrite the hero.
```

---

## Structured instruction shape (what good prompts become)

The interpreter turns your words into something like:

```json
{
  "page": "home",
  "target": { "id": "home.hero", "kind": "section" },
  "actions": [
    {
      "type": "ui_update",
      "id": "styles.cards.hoverLift",
      "value": true
    },
    {
      "type": "copy_update",
      "id": "hero.cta",
      "value": "Sign Up"
    },
    {
      "type": "style_patch",
      "id": "styles.patches.nav-hover",
      "value": "nav .links a:hover{...}"
    }
  ],
  "constraints": [
    "Maintain existing navigation structure",
    "Do not modify unrelated gallery images",
    "Keep site responsive on mobile"
  ]
}
```

You don’t write JSON yourself — write clear prompts; the pipeline builds this.

---

## Targeting cheat sheet

| You want… | Say / do this |
|-----------|----------------|
| One section | Click it in preview, or say “in the hero / gallery / CTA” |
| One gallery tile | “Delivery card”, “third gallery image” |
| Whole site look | “site accent”, “all buttons”, “nav hover” |
| One page | “on the About page”, “Contact page only” |
| Follow-up | “make it shorter”, “warmer”, “try again” |
| New topic | “Now separately…”, “New request: …” |

---

## Do / Don’t

**Do**

- Name the page + section.
- Separate UI style from content when needed (“colors only — don’t change copy”).
- Use concrete labels: Sign Up, Skip, Learn more, Add to Cart.
- Prefer one job per message for surgical edits; use compound prompts when the changes belong together.

**Don’t**

- Say only “fix the menu” (ambiguous: nav vs Menu card vs food menu page).
- Ask to “change the CSS file” — ask for the **effect** (hover underline, fade-in, accent teal).
- Mix unrelated edits without saying “and also…” clearly.

---

## Mega catalog — paste-ready prompts

### Buttons & CTAs

1. `Add a primary “Sign Up” button to the Home hero under the subtitle.`
2. `Add a secondary outline “Skip for now” button next to the hero CTA.`
3. `Add a text-style “Learn more” link at the bottom of the features section.`
4. `Change the hero button label to “Start free trial”.`
5. `Make the Contact nav link a solid CTA pill.`
6. `Remove the Sign Up button from Home.`

### Inputs & forms

7. `Add a search box under the Home page title.`
8. `Add an email input to the Home lead form.`
9. `Add a contact form with name, email, and message on Contact.`
10. `Add a signup form with name, email, and password below the Home CTA.`
11. `Add a feedback form with a 1–5 rating field and a comment field.`
12. `Add a newsletter signup (email + Subscribe) in the CTA band.`
13. `Remove the contact form.`
14. `Hide the Home lead form.`

### Cards & stats

15. `Add a card summarizing our return policy on Home.`
16. `Add a stats card showing total orders: “1,200+ fulfilled”.`
17. `Add three benefit cards with icons: Speed, Quality, Support.`
18. `Make feature cards hover-lift with a soft shadow.`
19. `Remove the return-policy card.`

### Catalog / plans / “cart” patterns

20. `Add 4 meal plans on Home — name, short description, and “Add to Cart” style CTA each.`
21. `Add a pricing block with Starter / Pro / Business and monthly prices.`
22. `Put product cards in an equal 3-column gallery grid.`

### Images & media

23. `Change the Delivery gallery card image.`
24. `Update the hero background photo — leave split and gallery alone.`
25. `Change only the split-section right image.`
26. `Refresh the About page banner image.`

### Copy

27. `Rewrite the Home hero title to be shorter and bolder.`
28. `Make all feature descriptions one sentence.`
29. `Set the CTA band title to “Ready when you are” and button to “Order tonight”.`

### Nav & pages

30. `Add a Pricing page with hero, plans, FAQ, and CTA.`
31. `Delete the unused Blog page; keep Home.`
32. `Rename Services to Offerings in the nav.`
33. `Nav links: accent color + underline on hover; smooth transition.`

### Style / motion / theme

34. `Set site accent to #0d9488.`
35. `Cream page background; keep text readable.`
36. `Fade-in sections on load; respect reduced motion.`
37. `Button hover: slight scale + brightness; 200ms ease.`
38. `Custom CSS: 16px radius on cards and buttons; softer shadows.`

### Layout

39. `Align gallery into 3 equal columns.`
40. `Stack hero buttons full-width on mobile.`
41. `Hide the split section on Home.`
42. `Show the features section again.`

### Scoped / compound

43. `Only update nav hover styles — do not change any images or copy.`
44. `Modernize Home: rounder cards, softer shadows, add “Continue with Google” under the form — keep nav and gallery images.`
45. `New request: on Contact only — add name/email/message form with Send button.`

---

## Quick reference — component vocabulary (website)

| Intent | Words that work well |
|--------|----------------------|
| Button | primary button, secondary button, CTA, outline, ghost, text link |
| Field | input, email field, search box, placeholder |
| Form | contact form, signup form, lead form, submit, fields |
| Card | card, stats card, feature card, policy card |
| Media | hero image, split photo, banner, gallery card, Delivery card |
| Chrome | nav, footer, sticky CTA, page tab |
| Style | hover, active, underline, transition, animation, accent, radius, shadow |
| Structure | section, page, hide, show, remove, add page |

---

## Related architecture

This guide matches the **Prompt Interpreter Layer** idea: natural language → structured technical instruction → accurate site updates → live preview — adapted for **multi-page websites** (pages/sections/config/styles) rather than mobile screens/React Native.

For Studio chat: prefer the paste-ready lines above, or the formula  
`[Action] + [Component] + [Page/Section] + [Details] + [Constraints]`.
