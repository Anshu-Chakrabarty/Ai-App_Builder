# AI App Builder

AI-powered website builder: describe an idea, pick a visual template, generate a multi-page site, then edit anything in Studio with freeform AI prompts.

**Repository:** [Anshu-Chakrabarty/Ai-App_Builder](https://github.com/Anshu-Chakrabarty/Ai-App_Builder)

## Features

- **5-step wizard** — Idea → Features → Stack → Template → Generate
- **Visual template gallery** — browse previews, filter by category, pick a look
- **AI site generation** — multi-page HTML with forms, CTAs, imagery, and icons (Gemini)
- **Studio editor** — full-screen preview + “Apply AI change” for copy, images, sections, and new pages
- **AI-ready templates** — analyze once → `manifest` + `config` + `knowledge`; AI updates config only (template code stays safe)
- **ZIP / HTML ingest** — upload a starter or use the bundled Harbor Studio sample
- **Free tier** — first 5 website generations at $0 (Starter)

## Tech stack

- Next.js 14 (App Router)
- React 18 + TypeScript
- Google Gemini (`@google/genai`)
- JSZip + node-html-parser (template ingest)
- Deploy target: **Vercel**

## Quick start (local)

```bash
git clone https://github.com/Anshu-Chakrabarty/Ai-App_Builder.git
cd Ai-App_Builder
npm install
cp .env.example .env.local
```

Add your Gemini key to `.env.local`:

```env
GEMINI_API_KEY=your_key_here
```

Then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Flow:** Projects → New Project → Idea → Features → Stack → Template → Generate → Studio.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | **Yes** | Google AI Studio / Gemini API key for generation & Studio edits |
| `GEMINI_MODEL` | No | Override default Gemini model id |
| `GITHUB_TOKEN` | No | Higher rate limits for live Vercel/GitHub template catalogs |
| `ENVATO_PERSONAL_TOKEN` | No | ThemeForest catalog (optional marketplace) |

Copy from [`.env.example`](.env.example). **Never commit** `.env.local`.

Get a Gemini key: [Google AI Studio](https://aistudio.google.com/apikey).

## Deploy on Vercel (from GitHub)

### 1. Push this repo (if not already)

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/Anshu-Chakrabarty/Ai-App_Builder.git
git push -u origin main
```

### 2. Import in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. **Import** `Anshu-Chakrabarty/Ai-App_Builder`
3. Framework Preset: **Next.js** (auto-detected)
4. Root Directory: `.` (default)
5. Build Command: `next build` (default)
6. Install Command: `npm install` (default)
7. Node.js: **22.x** (set in `package.json` → `engines`)

### 3. Add environment variables in Vercel

Project → **Settings → Environment Variables**:

| Name | Value | Environments |
|------|--------|----------------|
| `GEMINI_API_KEY` | your key | Production, Preview, Development |

Optional: `GITHUB_TOKEN`, `ENVATO_PERSONAL_TOKEN`, `GEMINI_MODEL`.

### 4. Deploy

Click **Deploy**. Every push to `main` redeploys automatically.

## Project structure

```
app/                    # Next.js App Router (pages + API routes)
  api/appbuilder/       # build, modify-site, ingest-template, templates, …
  wizard/               # creation wizard
  studio/               # live preview + AI editor
  templates/            # visual template gallery
components/appbuilder/  # Shell, TemplateGallery, ProfileMenu, …
lib/
  template-ai/          # manifest / config / knowledge / ingest / agent
  appbuilder/           # catalog, billing, auth, remote templates
  templates-*.ts        # hardcoded site render templates
templates/samples/      # starter-agency.zip (AI-ready sample)
```

## Architecture (short)

1. **Phase 1** — Analyze template (or ingest ZIP/HTML) → editable IDs + default config  
2. **Phase 2** — Template knowledge (design system, components, variants, layout tokens)  
3. **Phase 3** — AI agent returns JSON updates by ID → merge into config → re-render  

Template source code is never rewritten by the agent.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local development |
| `npm run build` | Production build (same as Vercel) |
| `npm start` | Serve production build locally |
| `npm run lint` | Lint |

## License

Private / personal project unless otherwise stated.
