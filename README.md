# CreateMeter

A macOS menu-bar app that tracks **creating vs consuming** time from the frontmost app — and, in browsers, the active tab’s hostname.

Students download a real **Apple Silicon** Mac app from GitHub Releases and sign in with an **Alpha School** or **Founders School** email plus a password stored only on that Mac. Create/consume totals stay local. No Google OAuth and no API keys.

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

If there is no Release yet, the latest CI run still has the same files: **Actions → Mac app → CreateMeter-mac-arm64**.

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

Use your school email and a password. There is no Google button.

| Allowed | Blocked |
| --- | --- |
| `@alpha.school` | Personal Gmail, other schools |
| `@founders.school` (coaches / staff) | Anything else |

**First time on this Mac:** enter email, choose a password (8+ characters), confirm it. CreateMeter stores a **hashed** password in this Mac’s keychain — never the password itself.

**Next time:** same email and password. Leave confirm blank.

Tracking does **not** start until you are signed in. Sign out from the menu or the Today window. Totals stay on disk; only the signed-in session is cleared. The account remains on this Mac so you can sign back in.

Passwords are local to **this** Mac. There is no email reset. If you forget yours, use **Reveal data folder…** and delete `accounts.bin` (that clears every local account on that Mac).

The menu shows **Signed in as you@alpha.school**. That identity never leaves this computer.

---

## For Nat

No Google Cloud project, OAuth client, or Actions secrets are required for sign-in. Students download and go.

### A. GitHub Releases (how students download)

CI is [`.github/workflows/mac-release.yml`](.github/workflows/mac-release.yml). It runs on **macos-14**, `npm test`, then `npm run dist` (electron-builder, **arm64** `.dmg` + `.zip`).

A green push to `main` publishes https://github.com/Founders-School/createmeter/releases from `package.json`’s version:

- `CreateMeter-1.2.0-arm64.dmg`
- `CreateMeter-1.2.0-arm64.zip`

The same files upload as the **CreateMeter-mac-arm64** Actions artifact.

Local package (on an Apple silicon Mac):

```bash
npm install
npm run dist
```

### B. Signing and notarization (later, so Gatekeeper is quiet)

This environment has no Apple Developer ID. Unsigned builds work after right-click Open.

When you have an **Apple Developer Program** account:

1. Create a **Developer ID Application** certificate.
2. Export a `.p12` and add Actions secrets:
   - `CSC_LINK` — base64 of the `.p12`
   - `CSC_KEY_PASSWORD`
   - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` (for notarization)
3. Unsigned CI **must not** export `CSC_LINK` / `CSC_KEY_PASSWORD` at all — including as empty strings.
4. After real cert secrets exist, export them only when non-empty, then set `mac.notarize: true`.

Packaged identity: `productName` CreateMeter, `appId` `com.foundersschool.createmeter`.

---

## Clone and run (development)

```bash
git clone https://github.com/Founders-School/createmeter.git
cd createmeter
cp .env.example .env   # optional CREATEMETER_DEV_USER for unpackaged testing
npm install
npm run start
```

### Preview the Today UI without a Mac

```bash
npm install
npm run preview:ui
```

Opens http://127.0.0.1:43147. Add `?gate=1` to preview the signed-out gate.

## Data & privacy

| File | Location |
| --- | --- |
| Daily totals | `~/Library/Application Support/CreateMeter/stats.json` |
| Rules | `~/Library/Application Support/CreateMeter/rules.json` |
| Signed-in session | `session.bin` (keychain via Electron `safeStorage`) |
| Local accounts | `accounts.bin` (scrypt password hashes, never plaintext) |

Nothing is uploaded. Menu → **Reveal data folder…** to inspect or delete files.

## Tests

```bash
npm test
```

Covers classification, the Alpha / Founders email allowlist, local password hashing, and the Today preview store.
