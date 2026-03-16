# ⚾ Diamond Manager — PLL Field Scheduler

Cross-division field scheduling for Plymouth Little League. Picks up where GameChanger leaves off — manages the **facility** while GC manages the **game**.

## What It Does

- **Week / Day / List views** across all 7 PLL fields × 10 divisions
- **Conflict detection** — prevents double-booking a field
- **Smart field recommendations** — each division knows its home field
- **Rain-out tracking** with one-tap conversion
- **GameChanger CSV export** — formatted for GC's Bulk Schedule Importer
- **Calendar export** (.ics) for Apple, Google, Outlook
- **PWA** — installable on iPhone/Android home screens
- **Supabase backend** — shared data across all board members' devices

## Quick Start

### 1. Create a Supabase project (free)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Open the **SQL Editor** in your dashboard
3. Paste the contents of `supabase-schema.sql` and run it
4. Go to **Settings → API** and copy your **Project URL** and **anon public key**

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and paste your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...your-key-here
```

### 3. Install and run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173/diamond-manager/](http://localhost:5173/diamond-manager/)

### 4. Deploy to GitHub Pages

```bash
# First, create a GitHub repo called "diamond-manager"
# Then push your code:
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/diamond-manager.git
git push -u origin main

# Deploy:
npm run build
npm run deploy
```

Your app will be live at `https://YOUR_USERNAME.github.io/diamond-manager/`

> **Note:** If your repo name is different from `diamond-manager`, update the
> `base` path in `vite.config.js` to match: `base: "/your-repo-name/"`.

### 5. Install as PWA

On your phone, visit the deployed URL and:
- **iPhone**: Tap Share → "Add to Home Screen"
- **Android**: Tap the browser menu → "Install app" or "Add to Home Screen"

## GameChanger Integration

Diamond Manager exports a CSV formatted for GameChanger's Bulk Schedule Import:

1. In Diamond Manager, tap **📤 → GameChanger CSV**
2. Go to [web.gc.com](https://web.gc.com)
3. Select your Organization → Schedule tab
4. Use the **Bulk Schedule Import** tool to upload the CSV

The CSV includes: date, start_time, duration, home_team, away_team, location.

## Project Structure

```
diamond-manager/
├── public/
│   └── favicon.svg          # Diamond field logo
├── src/
│   ├── main.jsx             # React entry point
│   ├── DiamondManager.jsx   # Main app component (all UI)
│   ├── storage.js           # Supabase + localStorage adapter
│   └── supabaseClient.js    # Supabase connection config
├── supabase-schema.sql      # Database table setup
├── vite.config.js           # Vite + PWA config
├── .env.example             # Environment template
└── package.json
```

## Tech Stack

- **React 19** — UI
- **Vite 6** — build tool
- **Supabase** — Postgres database (free tier)
- **vite-plugin-pwa** — service worker + installability
- **gh-pages** — GitHub Pages deployment

## License

MIT — Built for Plymouth Little League and the thousands of leagues like it.
