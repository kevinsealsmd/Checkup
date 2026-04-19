# Checkup! — PWA Spec

**A kid-friendly "medical kit" app for classroom use. v1 ships with one tool: a pretend pulse finder that uses the phone's camera with a cartoon vessel overlay and plays a synthesized doppler sound. Hosted by Dr. Thump, a friendly cartoon heart character in teal scrubs.**

---

## IMPORTANT: Before writing any code

Show me your plan and flag concerns before coding. I want to review:

1. Your proposed file/folder structure
2. Your approach to the PWA setup (manifest, service worker, icons)
3. Your approach to video asset loading and state swapping
4. Any concerns about iOS Safari quirks (camera permission, WebM alpha, autoplay, fullscreen PWA behavior)
5. Any ambiguity in this spec you want clarified before building

Do not start implementing until I approve the plan.

---

## Context and goals

I'm an interventional radiologist. I recently went to my daughter's preschool class for "doctor day" and did activities with the kids — dressing them up as surgeons, finding pulses with a doppler, listening with a stethoscope. It was a hit. This app recreates the magic digitally so parents and teachers can share it with the class.

**Audience.** Kids roughly ages 4–7. Parents or teachers will launch it; kids will use it.

**Distribution.** Installable PWA, delivered by shareable link. No App Store. No account system. No analytics. No telemetry.

**Non-goals.**
- Not a medical device. Nothing in this app should be interpreted as diagnostic.
- No user data collection. No storage of photos, video, audio, or scan results.
- No leaderboard, profiles, accounts, or persistent history of any kind.
- No social features, sharing buttons, or screenshots. (Parents can screenshot via OS if they want.)

---

## v1 scope (what we're building now)

One menu screen with one working tool and two "coming soon" placeholders. The working tool is the Pulse Finder.

**Pulse Finder flow:**
1. Kid arrives on the camera screen. Live camera feed fills the bottom panel. A cartoon vessel video loops across the frame, subtly pulsing in an idle state.
2. Top panel shows Dr. Thump (looping video), a speech bubble with a friendly prompt ("Point the camera at a wrist and tap Scan!"), and an empty BPM readout.
3. Kid taps the big **Scan** button.
4. A searching overlay appears over the camera for ~2.5 seconds (dashed spinning ring, dimmed backdrop). Dr. Thump's speech bubble updates to "Listening carefully..."
5. Searching ends. A one-shot sparkle burst plays. The vessel video swaps from idle loop to active loop (visible blood flow, pulsing glow). The BPM readout fills in with a randomized number in a plausible kid range (78–110). Synthesized doppler "whoosh-whoosh" audio begins, timed to the BPM.
6. Dr. Thump's video swaps to cheering for the duration of the burst, then to talking while the speech bubble shows a randomized encouraging phrase ("Wow, what a strong heart!").
7. Scan button changes to **Scan again**. Tapping it stops audio, resets to idle vessel, and re-runs the flow.
8. **Back** button returns to the menu. All audio and timers stop cleanly.

**Everything else on the menu is locked.** Stethoscope and Lung Listener buttons are visibly present with "Coming soon" labels and are non-interactive.

---

## Out of scope for v1

Explicitly not building:
- Stethoscope mode
- Lung Listener mode
- Temperature check, reflex test, or any other mode
- "Checkup report" summary screen
- Voice lines or TTS (speech bubbles are text only)
- Real pulse detection from the camera (this is theater — BPM is randomized)
- Wrist tracking, hand tracking, MediaPipe, or any computer vision
- Dragging the vessel overlay (vessel is full-frame, static position)
- Leaderboard, scan history, profiles, accounts
- Settings, preferences, onboarding flow
- Analytics, logging, error reporting to a server
- Multi-language support (English only for v1)
- Landscape orientation (portrait only; lock if possible)

---

## Branding and character

**Product name:** Checkup! (with the exclamation mark — it's part of the brand).

**Mascot:** Dr. Thump, a cartoon heart character in teal scrubs.

**Character description (for implementation and fallback SVG):**
- Chibi-proportioned 3D character
- Body is a rounded heart shape in warm coral pink
- Simple face: two black dot eyes, small rounded mouth, soft pink cheek blush
- Wearing soft teal short-sleeved scrub top (V-neck) and matching teal scrub pants
- Coral/pink cuff accents at sleeves
- Warm yellow stethoscope around neck with silver chestpiece
- Small "Dr. Thump" name tag on chest
- Small white gloves and white shoes

The canonical reference image is `assets/reference/thump-reference-v1.png` — refer to it for styling fallbacks and icon sourcing.

---

## Technical architecture

### Stack

- **Plain HTML / CSS / vanilla JavaScript.** No React, no build step, no bundler. One `index.html`, one `styles.css`, one `app.js`. This is a simple enough app that a framework is overhead, and a no-build setup is easier for me to inspect, edit, and deploy.
- **PWA scaffolding:** `manifest.json`, `service-worker.js`, icon files.
- **Web Audio API** for synthesized doppler sound. No audio files.
- **`getUserMedia()`** for the camera feed.
- **HTML5 `<video>`** elements for Dr. Thump and vessel animations, with looping and playback state controlled by JS.

### Target platforms

- **Primary:** iOS Safari (iPhone), PWA installed to home screen.
- **Secondary:** Android Chrome, PWA installed.
- **Tertiary:** Desktop Chrome/Safari for development.

Portrait orientation only.

### Hosting

Will deploy on Railway (or similar static host). Needs to be served over HTTPS for camera access to work.

---

## File structure

```
checkup/
├── index.html
├── styles.css
├── app.js
├── manifest.json
├── service-worker.js
├── assets/
│   ├── reference/
│   │   └── thump-reference-v1.png        (canonical character sheet)
│   ├── video/
│   │   ├── thump-idle.webm
│   │   ├── thump-idle.mp4
│   │   ├── thump-talking.webm
│   │   ├── thump-talking.mp4
│   │   ├── thump-cheering.webm
│   │   ├── thump-cheering.mp4
│   │   ├── vessel-idle.webm
│   │   ├── vessel-idle.mp4
│   │   ├── vessel-active.webm
│   │   ├── vessel-active.mp4
│   │   ├── burst.webm
│   │   └── burst.mp4
│   └── icons/
│       ├── icon-192.png
│       ├── icon-512.png
│       ├── apple-touch-icon.png  (180x180)
│       └── favicon.ico
└── README.md
```

**Assets are video files I will generate separately with Nano Banana Pro + Veo/Kling.** Claude Code should:
- Write the code assuming these files exist at the paths above
- Include a graceful fallback for missing videos (see Asset loading section below) so the app still runs during development before all assets are finalized
- Include a note in README.md listing the expected assets and their purposes

### Asset loading and fallbacks

Provide both WebM (VP9, alpha channel for transparency) and MP4 versions of each video. Use `<video><source>` tags with both, browser picks the best supported.

If a video fails to load or is missing, fall back to an inline SVG placeholder approximating Dr. Thump in the correct pose state (simple cartoon heart with teal scrub top accent) or a simple SVG vessel. This lets me ship and test the app even if I'm still iterating on a particular video asset.

Preload all videos on app init so state swaps are instant. Mute all videos (required for autoplay on iOS). Use `playsinline` attribute (required for iOS inline video).

---

## Design system

### Color palette

The palette is organized into three functional groups:

**Warm pinks — biological/body elements** (heart, vessel, BPM number)
| Name | Hex | Usage |
|------|-----|-------|
| Soft pink | `#F4C0D1` | Tool card accents, Dr. Thump fill |
| Coral pink | `#D4537E` | BPM number, vessel main color, primary buttons |
| Deep rose | `#993556` | Titles, accent text |
| Dark rose | `#4B1528` | Primary text on pink backgrounds |
| Muted rose | `#72243E` | Secondary text |

**Cool teals — UI chrome / app shell** (buttons, speech bubble accents, navigation)
| Name | Hex | Usage |
|------|-----|-------|
| Scrub teal | `#7FC9BF` | Primary UI accent, top bar, Dr. Thump's scrubs |
| Light teal | `#B8E0DB` | Hover/secondary teal surfaces |
| Deep teal | `#4A8A82` | Text on teal backgrounds, stronger accents |

**Warm neutrals — background and celebration**
| Name | Hex | Usage |
|------|-----|-------|
| Cream | `#FFF4E8` | Main app background |
| Warm peach | `#FFE4CE` | Secondary panels, disabled tool cards |
| Warm yellow | `#FAC775` | Success/celebration accents (matches stethoscope) |
| Dark amber | `#412402` | Text on yellow |
| Camera dark | `#2C2C2A` | Fallback behind camera feed |

**Important design principle:** warm pinks are for body/biological content. Cool teals are for app chrome. Warm yellow is for celebration moments. Don't mix these functions — a pink button or a teal vessel would break the system.

### Typography

- System sans-serif font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
- Two weights: 400 regular, 500 medium. No bold/700.
- Sizes: 22px titles, 16px body, 14px secondary, 13px bubble text, 11px labels.
- Sentence case everywhere. No ALL CAPS.

### Components

- **Buttons:** Pill-shaped, `border-radius: 999px`. Primary = coral pink with white text. Secondary = white with dark rose text. Tool-select buttons use teal accent when active.
- **Cards:** Rounded corners (`border-radius: 18px`).
- **Tap targets:** Minimum 44px height. Kids have imprecise taps.
- **Active state:** `transform: scale(0.96)` on tap for tactile feedback.

### Motion

- Idle heart animation on inline SVG fallback: `heartbeat` keyframe, duration dynamically set to match BPM interval (`60000 / bpm` ms).
- Vessel idle → active: cross-fade glow and opacity over ~800ms. Don't just snap on.
- Sparkle burst: scale + fade over ~900ms, one-shot.
- All transitions ease-in-out or ease-out, never linear.

---

## Screen-by-screen spec

### Menu screen

**Layout:**
- Top bar: "Checkup!" title centered (teal background), hamburger icon top-right (non-functional in v1), back button top-left hidden.
- Large animated Dr. Thump video (idle loop) or SVG fallback, ~96px square, centered.
- Title: "Dr. Thump's Kit"
- Subtitle: "Pick a tool to try!"
- Three tool buttons stacked vertically:
  1. **Pulse finder** (active) — soft pink background, pulse icon, "Find a heartbeat with the camera". Tapping enters scan screen.
  2. **Stethoscope** (disabled) — warm peach background, stethoscope icon, "Coming soon". Not tappable.
  3. **Lung listener** (disabled) — warm peach background, lungs icon, "Coming soon". Not tappable.

### Scan screen

**Layout — top panel (~35% of viewport):**
- Cream background.
- Row: Dr. Thump video (52px square) on left, speech bubble on right.
- Below row: centered BPM number (46px, coral pink) with small "BPM" label.

**Layout — bottom panel (~65% of viewport):**
- Live camera feed fills the panel (behind everything). Use `environment` facing camera if available, fall back to `user` facing.
- Decorative pink corner brackets in all four corners (pure visual, no function).
- Vessel video layered over camera, spanning full panel width, vertically centered, ~90px tall, `pointer-events: none`.
- Searching overlay (when active): dim backdrop + spinning dashed ring (teal color).
- Sparkle burst (one-shot): centered over everything, above camera and vessel.
- Action bar at bottom: **Back** (secondary white/dark rose) on left, **Scan** / **Scan again** (primary coral pink) on right.

### States (within scan screen)

| State | Dr. Thump | Speech bubble | BPM | Vessel | Audio | Scan button |
|-------|-----------|---------------|-----|--------|-------|-------------|
| **Ready** | Idle loop | "Point the camera at a wrist and tap Scan!" | `--` | Idle loop, gentle pulse | Silent | "Scan" (enabled) |
| **Searching** | Talking loop | "Listening carefully..." | `--` | Idle loop | Silent | "Scan" (disabled) |
| **Found** | Cheering (one-shot, ~1.5s) → talking loop | Random cheer phrase | Number (78–110) | Active loop | Whoosh-whoosh at BPM interval | "Scan again" (enabled) |

### Speech bubble phrases

Randomize from these pools. Categorize by BPM to keep feedback plausible:

```
BPM > 105:  "Zoom! Fast like a bunny!"
            "Super speedy heart!"
            "That heart is racing!"

BPM 90–105: "Wow, what a strong heart!"
            "A happy, healthy thump!"
            "Great beat! High five!"

BPM < 90:   "Calm and steady, nice job!"
            "A cool, chill heartbeat!"
            "Relaxed and strong!"
```

---

## Doppler audio synthesis

Use Web Audio API. No audio files. Two staggered "whoosh" pulses per beat, synthesized from filtered white noise:

**Whoosh 1 (the "lub"):**
- Duration: 280ms
- White noise buffer, enveloped with a sine-squared shape
- Bandpass filter at 180Hz, Q=2
- Gain envelope: 0 → 0.6 (attack 40ms) → 0 (release 200ms)

**Whoosh 2 (the "dub"):**
- Starts 180ms after Whoosh 1
- Duration: 200ms
- Bandpass filter at 135Hz (slightly lower pitch)
- Gain envelope: 0 → 0.4 → 0

**Loop interval:** `60000 / bpm` milliseconds between Whoosh 1 onsets.

Audio context must be initialized after a user gesture (the tap on Scan, or on the menu's Pulse finder button). Suspended context must be resumed.

---

## Camera handling

- Request camera permission on first tap of "Scan" (not on app load — that's jarring).
- Use `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`. Fall back to `facingMode: 'user'` if rear camera is unavailable.
- If permission is denied or unavailable, show a friendly message in the camera panel ("Dr. Thump needs your camera to find a pulse! Tap the camera icon in your address bar to turn it on.") with the vessel video playing over the message backdrop. Scan button should still work — scans still produce a fake BPM, the vessel animates, audio plays. Camera is enhancement, not gate.
- Stop the camera stream when leaving the scan screen (`stream.getTracks().forEach(t => t.stop())`).
- No photo capture. No recording. Ever.

---

## PWA setup

### manifest.json

```json
{
  "name": "Checkup!",
  "short_name": "Checkup!",
  "description": "A fun pretend medical kit for kids",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#FFF4E8",
  "theme_color": "#7FC9BF",
  "icons": [
    { "src": "/assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

### service-worker.js

Minimal cache-first service worker. Cache the app shell (HTML, CSS, JS) and all video/icon assets on install. Serve from cache, fall back to network. Keep it simple — no fancy strategies.

Version the cache name so I can bump it to force a refresh during iteration.

### index.html head

- `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no">` (no pinch-zoom — kids will accidentally zoom)
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="default">`
- `<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">`
- `<link rel="manifest" href="/manifest.json">`
- Theme color meta for Android (`#7FC9BF`)
- `<title>Checkup!</title>`

---

## Behavior details and edge cases

- **Audio context must resume on every user gesture** in case iOS suspends it.
- **Videos must be muted and have `playsinline`** or iOS will refuse to autoplay.
- **Pause videos when screen is hidden** (`visibilitychange` event) to save battery.
- **Stop audio and timers cleanly on screen change, visibility change, or back navigation.** No zombie audio playing after leaving a screen.
- **Disable text selection and tap highlights** on the whole app (`user-select: none`, `-webkit-tap-highlight-color: transparent`). Kids mashing the screen shouldn't select text.
- **Disable pull-to-refresh** on the main container (`overscroll-behavior: contain`).
- **No alert/prompt/confirm dialogs.** If something needs to be communicated, use in-app UI.
- **The whole app must work offline** after first load (service worker handles this).
- **Fresh BPM every scan.** No memory between scans.

---

## Testing checklist

Before I consider v1 done:

- [ ] Opens on iPhone Safari, installs to home screen, launches full-screen from home screen
- [ ] "Checkup!" name and teal theme color visible in PWA install experience and top bar
- [ ] Camera permission prompt appears on first Scan tap, not app load
- [ ] Denying camera permission still allows scanning (fake BPM, vessel, audio all work)
- [ ] Approving camera shows rear-facing live feed behind vessel
- [ ] Vessel idle loop visible, subtly animating, before scan
- [ ] Scan button triggers searching overlay, then sparkle burst, then active vessel + audio + BPM
- [ ] Audio whoosh-whoosh rate matches displayed BPM
- [ ] Dr. Thump video playback syncs correctly with state changes (idle → talking → cheering → talking)
- [ ] "Scan again" produces a new random BPM each time
- [ ] Back to menu stops audio and camera stream cleanly
- [ ] Coming Soon buttons are visibly present but not tappable
- [ ] App works offline after first load
- [ ] All SVG fallbacks render correctly if video assets are missing
- [ ] No console errors, no network requests after initial asset load, no requests to any analytics or tracking endpoint ever
- [ ] Screen doesn't accidentally zoom, select text, or pull-to-refresh

---

## Code quality preferences

- **Clear over clever.** I'll be reading this code and tweaking it.
- **Comments where non-obvious** — especially anything iOS-quirk-related. When you do something weird because Safari requires it, leave a `// Safari requires X because Y` comment.
- **Pure functions where possible** for things like `pickCheerPhrase(bpm)`, `generateBpm()`, etc.
- **State managed as a single JS object** (e.g., `const state = { screen: 'menu', scanPhase: 'ready', bpm: null }`) with a single `render()` function that reads state and updates the DOM. No scattered DOM mutations across handlers.
- **CSS variables for all colors.** Define once in `:root`, reference everywhere. Organize CSS variables by the three-group palette structure (biological-pinks, ui-teals, warm-neutrals).
- **No dependencies.** Zero `npm install`. Zero CDN scripts. Everything ships with the repo.

---

## Deliverables from this spec

1. Complete working PWA in `~/Projects/Checkup/` (flag if you'd prefer a different path)
2. All files per the file structure above
3. README.md with:
   - How to run locally (which probably means "start a local HTTPS server because camera requires it" — include the exact command)
   - List of expected video assets with their paths and purposes
   - Deployment notes for Railway
4. A `DECISIONS.md` capturing any non-obvious choices you made while building (especially anywhere you deviated from this spec, and why)

---

## Reminder

**Show me your plan and flag concerns before coding.**
