# CreateMeter

A macOS menu bar app that tracks **creating vs consuming** time from the frontmost app — and, in browsers, the active tab’s hostname.

No account. No cloud. No telemetry. Totals stay on disk under Application Support.

The menu bar shows a compact readout:

`C 1h12m · V 42m`

**C** is creating. **V** is consuming (viewing). Click the icon for today’s breakdown, what is in front right now, pause, and a link to the rules file.

## Clone and run (Mac, Apple Silicon)

Founders School students: this repo is public. You need a Mac, Node 20+, and npm.

```bash
git clone https://github.com/Founders-School/createmeter.git
cd createmeter
npm install
npm run start
```

That launches Electron in the menu bar. While developing, a **Today** window also opens so you can see the live breakdown. In a packaged build the dock icon stays hidden (`LSUIElement`); use **Open Today…** from the menu if you want the window.

macOS will ask CreateMeter (or **Electron** during `npm run start`) to control Safari/Chrome. Click **OK**. Details are in [Permissions](#permissions) below.

To package a local Apple Silicon `.app`:

```bash
npm run dist
```

The build is unsigned. First launch: right-click the app → Open, or `xattr -cr /path/to/CreateMeter.app` if Gatekeeper blocks it.

### Preview the Today UI without a Mac

```bash
npm install
npm run preview:ui
```

Opens the Today dashboard on `http://127.0.0.1:43147` with a simulated day (Cursor, GitHub, YouTube, Slack, idle). Classification and rules are the same code the Mac app uses.

## Permissions

CreateMeter samples every ~1.5 seconds. What it needs:

| Capability | Why | Permission |
| --- | --- | --- |
| Frontmost app name / bundle id | Classify Cursor vs Safari vs Slack | Usually **none**. Uses `lsappinfo`. Falls back to System Events (Accessibility) if that fails. |
| Active tab URL | Treat `github.com` as creating and `youtube.com` as consuming | **Automation** (Apple Events) for Safari, Chrome, Arc, Brave, Edge, and similar. Firefox uses Accessibility to read the address bar. |
| Idle + lock | Stop counting after ~2.5 minutes without input, and while the Mac is locked or on the screen saver | None. Uses `ioreg` / `HIDIdleTime`. |

### Grant Automation

The first time CreateMeter asks a browser for its URL, macOS shows:

> “CreateMeter” wants access to control “Safari”.

Click **OK**. Repeat for Chrome / Arc / Brave / Edge if you use them.

If you declined, or sites always classify as consuming:

1. Menu → **Grant Automation…**
2. System Settings → Privacy & Security → Automation
3. Enable CreateMeter (or **Electron** while running `npm run start`) for each browser.

### Grant Accessibility

Needed if `lsappinfo` cannot see the front app, or you want Firefox host detection.

1. Menu → **Grant Accessibility…**
2. System Settings → Privacy & Security → Accessibility
3. Enable **CreateMeter**. In `npm run start`, the process is named **Electron** — enable that.

CreateMeter keeps tracking apps if a browser URL is denied. Unknown browser hosts default to **consuming**.

## How classification works

1. Read the frontmost app.
2. If it is a browser, resolve the active tab URL via AppleScript (or Accessibility for Firefox).
3. If a **host rule** matches, that wins (so Chrome + `docs.google.com` is creating).
4. Else an **app rule** wins (Cursor is creating; browsers without a URL are consuming).
5. Else unknown apps are **neutral**; unknown browser hosts are **consuming**.

Time is added only when the Mac is unlocked, not idle, and tracking is not paused. Sleep / lid-close gaps over 10 seconds are dropped so overnight lock time is not counted as creating.

### Defaults (founder / writer / coder)

**Creating** — Cursor, VS Code, Xcode, Terminal, iTerm, Warp, Notion, Figma, Sketch, Final Cut, Logic, GarageBand, Pages, Keynote, Numbers, TextEdit, Obsidian, Bear, Ulysses, Word, Notes, Zed, JetBrains IDEs, plus browser hosts `docs.google.com`, `notion.so`, `figma.com`, `canva.com`, `github.com`, `localhost`, `vercel.app`, `linear.app`, `claude.ai`, `chatgpt.com`.

**Consuming** — Browsers unless a creating host matches. YouTube, Netflix, X/Twitter, Instagram, Reddit, TikTok, HN, major news, LinkedIn, Twitch, and similar.

**Neutral** — Finder, System Settings, Preview, Calculator, Calendar, **Mail**, **Slack / Discord / Messages** and other chat, Zoom / Meet, launchers (Raycast, Alfred). Mail and chat are treated as coordination, not deep create/consume work. Change the rules if you want Mail or Slack to count as consuming.

Idle threshold defaults to **150 seconds**.

## Edit rules without recompiling

Menu → **Open rules…**

That opens:

`~/Library/Application Support/CreateMeter/rules.json`

Save the file. CreateMeter reloads it within a second or two.

```json
{
  "pollIntervalMs": 1500,
  "idleThresholdSeconds": 150,
  "browsers": ["Safari", "Google Chrome", "Arc"],
  "apps": [
    { "match": "Cursor", "category": "creating" },
    { "match": "Mail", "category": "neutral" }
  ],
  "hosts": [
    { "host": "github.com", "category": "creating" },
    { "host": "youtube.com", "category": "consuming" },
    { "host": "linkedin.com", "pathPrefix": "/feed", "category": "consuming" }
  ],
  "defaults": {
    "unknownApp": "neutral",
    "unknownBrowserHost": "consuming"
  }
}
```

`match` is an app name or bundle id (case-insensitive). Short names like `Arc` use word boundaries so Archive Utility does not match. Host rules match the hostname or a suffix (`youtube.com` also matches `www.youtube.com`). Optional `pathPrefix` limits a host rule to a path.

A commented copy of the shipped defaults lives in [`resources/default-rules.json`](resources/default-rules.json). First launch copies that into Application Support if no rules file exists.

## Data & privacy

| File | Location |
| --- | --- |
| Daily totals | `~/Library/Application Support/CreateMeter/stats.json` |
| Rules | `~/Library/Application Support/CreateMeter/rules.json` |

Only local date keys and millisecond totals are stored. The last 90 days are kept. Menu → **Reveal data folder…** to inspect or delete them. Nothing is uploaded.

## Menu

- Today: Creating / Consuming / Neutral durations
- This week (sum of the last 7 local days)
- Now: app, host if any, category
- Pause tracking
- Open Today…
- Open rules…
- Reveal data folder…
- Grant Accessibility… / Grant Automation… (when needed)
- Quit

## Tests

```bash
npm test
```

Covers classification (Cursor, browsers + hosts, Slack/Mail as neutral, suffix hosts) and duration formatting.

## Notes

- Firefox URL detection is best-effort and needs Accessibility. Safari / Chromium-family browsers are the reliable path.
- In development, Privacy & Security lists the app as **Electron**, not CreateMeter.
- This repo is developed on Linux too; live sampling is macOS-only. Other platforms run a local simulator so the Today window still works.
