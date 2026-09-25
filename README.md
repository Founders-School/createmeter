# CreateMeter

A macOS menu-bar app that tracks **creating vs consuming** time from the frontmost app — and, in browsers, the active tab’s hostname.

Students download a real **Apple Silicon** Mac app from GitHub Releases and sign in with an **Alpha School** Google account. Create/consume totals stay on this Mac. Sign-in only stores who is using the app.

The menu bar shows a compact readout:

`C 1h12m · V 42m`

**C** is creating. **V** is consuming (viewing). Click the icon for today’s breakdown, who is signed in, pause, and a link to the rules file.

**Public repo:** https://github.com/Founders-School/createmeter

---

## For students

You need a **MacBook Air / Pro with Apple silicon** (M1–M4). This build is `arm64` only.

### 1. Download the app

1. Open **[Releases](https://github.com/Founders-School/createmeter/releases)**.
2. Download **`CreateMeter-<version>-arm64.dmg`** (or the `.zip` if you prefer).
3. Open the disk image and drag **CreateMeter** to Applications — or unzip and move `CreateMeter.app` there.

Do **not** use `npm start` unless you are hacking on the code.

If there is no Release yet, the latest CI run still has the same files: **Actions → Mac app → CreateMeter-mac-arm64**. Ask Nat to publish a Release from a `v*` tag.

### 2. Open it (Gatekeeper)

The first student builds may be **unsigned**. macOS will say the app cannot be opened because it is from an unidentified developer.

**Right-click** `CreateMeter.app` → **Open** → **Open**. That is a one-time exception.

If it is still blocked:

```bash
xattr -cr /Applications/CreateMeter.app
```

Then right-click → Open again.

After Nat adds a Developer ID and notarizes (see below), this step goes away.

### 3. Grant Automation and Accessibility

CreateMeter lives in the menu bar (no Dock icon). The first time it asks a browser for the current tab, macOS shows:

> “CreateMeter” wants access to control “Safari”.

Click **OK**. Repeat for Chrome / Arc / Brave / Edge if you use them.

If you declined:

1. Menu bar icon → **Grant Automation…** and **Grant Accessibility…**
2. Or System Settings → Privacy & Security → **Automation** and **Accessibility**
3. Enable **CreateMeter** (packaged builds show that name, not “Electron”).

### 4. Sign in

Use **Sign in with Google** and pick your school account.

| Allowed | Blocked |
| --- | --- |
| `@alpha.school` | Personal Gmail, other schools |
| `@founders.school` (same org / coaches) | Unverified Google emails |

Tracking does **not** start until you are signed in. Sign out from the menu or the Today window. Your local totals stay on disk; only the Google session is cleared.

The menu shows **Signed in as you@alpha.school**. That identity never leaves this Mac except the Google sign-in request itself.

---

## For Nat (one-time setup)

Two things still need a human in Google Cloud and (later) Apple Developer. The app, CI, and allowlist are already in this repo.

### A. Google OAuth (required before students can sign in)

CreateMeter uses **Sign in with Google** in the Electron main process (PKCE + loopback `http://127.0.0.1:<port>`). There is no backend. The client ID is baked into the packaged app at build time.

1. [Google Cloud Console](https://console.cloud.google.com/) → new project **CreateMeter** (or reuse the Alpha Workspace project).
2. **APIs & Services → OAuth consent screen**
   - Prefer **Internal** if this project is in the Alpha School Workspace.
   - App name: `CreateMeter`. Support email: yours.
   - Scopes: `openid`, `email`, `profile`.
   - If the screen must be External, add student test users or publish after verification.
3. **Credentials → Create credentials → OAuth client ID → Desktop app**.
   - Name: `CreateMeter macOS`.
   - Desktop clients already allow loopback redirects (`http://127.0.0.1`). Do not add a web redirect unless you change the code.
4. Copy the **Client ID** (`….apps.googleusercontent.com`) and the **Client secret** (Desktop clients have one; it is treated as public-in-the-app).
5. Restrict usage to the school Workspace if you can. The app still **rejects any email that is not** `@alpha.school` or `@founders.school` after Google’s tokeninfo check. `hd=alpha.school` is sent as a hint so the account picker prefers Alpha.
6. Repo **Settings → Secrets and variables → Actions** add:
   - `GOOGLE_CLIENT_ID` (required)
   - `GOOGLE_CLIENT_SECRET` (recommended for Desktop clients)
7. For local `npm start`, copy [`.env.example`](.env.example) to `.env` and paste the same values. Never commit `.env`.
8. Re-run **Mac app** (or push a `v*` tag) so the Release build contains the client ID.

Until that secret exists, students see a clear “Google sign-in is not configured” state. Unpackaged testing can set `CREATEMETER_DEV_USER=you@alpha.school` (ignored inside `CreateMeter.app`).

### B. GitHub Releases (how students download)

CI is [`.github/workflows/mac-release.yml`](.github/workflows/mac-release.yml). It runs on **macos-14**, `npm test`, then `npm run dist` (electron-builder, **arm64** `.dmg` + `.zip`).

**Publish a student build**

```bash
git tag v1.1.0
git push origin v1.1.0
```

That creates https://github.com/Founders-School/createmeter/releases with:

- `CreateMeter-1.1.0-arm64.dmg`
- `CreateMeter-1.1.0-arm64.zip`

Every push to `main` also uploads the same files as a workflow artifact named **CreateMeter-mac-arm64**. You can also run the workflow manually and check **Create a GitHub Release**.

Local package (on an Apple silicon Mac):

```bash
npm install
# optional: export GOOGLE_CLIENT_ID=…
npm run dist
```

Artifacts land in [`release/`](release/). This Linux agent cannot produce a `.app`; GitHub Actions is the real builder.

### C. Signing and notarization (later, so Gatekeeper is quiet)

This environment has no Apple Developer ID. Unsigned builds work after right-click Open.

When you have an **Apple Developer Program** account:

1. Create a **Developer ID Application** certificate.
2. Export a `.p12` and add Actions secrets:
   - `CSC_LINK` — base64 of the `.p12`
   - `CSC_KEY_PASSWORD`
   - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` (for notarization)
3. Unsigned CI **must not** export `CSC_LINK` / `CSC_KEY_PASSWORD` at all — including as empty strings. electron-builder treats any defined `CSC_LINK` as a cert path; `""` resolves to the repo directory and fails with `createmeter not a file`. The Mac workflow unsets those variables and sets `mac.identity: null` plus `CSC_IDENTITY_AUTO_DISCOVERY=false`.
4. After real cert secrets exist, export them only when non-empty, then set `mac.notarize: true` in [`electron-builder.yml`](electron-builder.yml).

Packaged identity (already set so System Settings does **not** say “Electron”):

| Field | Value |
| --- | --- |
| `productName` | CreateMeter |
| `appId` / `CFBundleIdentifier` | `com.foundersschool.createmeter` |
| `CFBundleName` / `CFBundleDisplayName` | CreateMeter |
| Menu bar extra | `LSUIElement` |

`npm start` still appears as **Electron** in Privacy settings. That is expected for unpackaged dev.

---

## Clone and run (development)

Mac, Node 20+, npm:

```bash
git clone https://github.com/Founders-School/createmeter.git
cd createmeter
cp .env.example .env   # add GOOGLE_CLIENT_ID, or CREATEMETER_DEV_USER
npm install
npm run start
```

`npm install` also generates the menu-bar icons. While developing, a **Today** window opens. In a packaged build the Dock icon stays hidden; use **Open Today…**.

### Preview the Today UI without a Mac

```bash
npm install
npm run preview:ui
```

Opens http://127.0.0.1:43147 with a simulated day (Cursor, GitHub, YouTube, Slack, idle). Add `?gate=1` to preview the signed-out Alpha School gate.

## Permissions

CreateMeter samples every ~1.5 seconds. What it needs:

| Capability | Why | Permission |
| --- | --- | --- |
| Frontmost app name / bundle id | Classify Cursor vs Safari vs Slack | Usually **none**. Uses `lsappinfo`. Falls back to System Events (Accessibility) if that fails. |
| Active tab URL | Treat `github.com` as creating and `youtube.com` as consuming | **Automation** (Apple Events) for Safari, Chrome, Arc, Brave, Edge, and similar. Firefox uses Accessibility to read the address bar. |
| Idle + lock | Stop counting after ~2.5 minutes without input, and while the Mac is locked or on the screen saver | None. Uses `ioreg` / `HIDIdleTime`. |

CreateMeter keeps tracking apps if a browser URL is denied. Unknown browser hosts default to **consuming**.

## How classification works

1. Read the frontmost app.
2. If it is a browser, resolve the active tab URL via AppleScript (or Accessibility for Firefox).
3. If a **host rule** matches, that wins (so Chrome + `docs.google.com` is creating).
4. Else an **app rule** wins (Cursor is creating; browsers without a URL are consuming).
5. Else unknown apps are **neutral**; unknown browser hosts are **consuming**.

Time is added only when someone is signed in, the Mac is unlocked, not idle, and tracking is not paused. Sleep / lid-close gaps over 10 seconds are dropped so overnight lock time is not counted as creating.

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

Shipped defaults live in [`src/shared/default-rules.ts`](src/shared/default-rules.ts). First launch writes them into Application Support if no rules file exists.

## Data & privacy

| File | Location |
| --- | --- |
| Daily totals | `~/Library/Application Support/CreateMeter/stats.json` |
| Rules | `~/Library/Application Support/CreateMeter/rules.json` |
| Google session | `session.bin` (macOS keychain via Electron `safeStorage`) or `session.json` if encryption is unavailable |

Only local date keys and millisecond totals are stored. The last 90 days are kept. The session file holds the signed-in email and Google tokens so the app can stay signed in. Nothing about create/consume time is uploaded. Menu → **Reveal data folder…** to inspect or delete files.

## Menu

- Signed in as …
- Today: Creating / Consuming / Neutral durations
- This week (sum of the last 7 local days)
- Now: app, host if any, category
- Pause tracking
- Open Today…
- Open rules…
- Reveal data folder…
- Grant Accessibility… / Grant Automation… (when needed)
- Sign out
- Quit

Signed-out menu: **Sign in with Google…** only. Tracking stays off.

## Tests

```bash
npm test
```

Covers classification, duration formatting, the Alpha / Founders email allowlist, and the Today preview store (including the signed-out gate).

## Notes

- Firefox URL detection is best-effort and needs Accessibility. Safari / Chromium-family browsers are the reliable path.
- In development, Privacy & Security lists the app as **Electron**, not CreateMeter. Packaged `CreateMeter.app` uses the CreateMeter name.
- This repo is developed on Linux too; live sampling is macOS-only. Other platforms run a local simulator so the Today window still works.
