# Checkup!

A kid-friendly pretend medical kit PWA for classroom use. Hosted on Cloudflare Pages. Kids can find a (fake) heartbeat using the phone's camera, complete with a cartoon vessel overlay and synthesized doppler audio.

## Running locally

Camera access requires HTTPS. The easiest way to run locally:

```bash
# Option 1: npx serve (no install needed)
npx serve -s .

# Option 2: Python
python3 -m http.server 8000
```

For camera testing on a phone, you'll need HTTPS. Use a tool like [mkcert](https://github.com/FiloSottile/mkcert) or [ngrok](https://ngrok.com):

```bash
# ngrok (tunnels your local server with HTTPS)
npx serve -s . -l 3000
ngrok http 3000
```

Note: `localhost` is treated as a secure context by browsers, so camera works locally without HTTPS.

## Expected video assets

These files are generated separately and placed in `assets/video/`. The app works without them (SVG fallbacks render instead).

| File | Purpose |
|------|---------|
| `thump-idle.webm` / `.mp4` | Dr. Thump idle animation (menu + scan ready state) |
| `thump-talking.webm` / `.mp4` | Dr. Thump talking animation (searching + found states) |
| `thump-cheering.webm` / `.mp4` | Dr. Thump cheering animation (found state, first 1.5s) |

Dr. Thump videos should have cream (#FFF4E8) backgrounds baked in — no alpha channel needed.

The vessel overlay is implemented as an inline SVG with CSS animations, so no vessel video files are needed.

## Expected icon assets

| File | Size | Purpose |
|------|------|---------|
| `assets/icons/icon-192.png` | 192x192 | PWA icon |
| `assets/icons/icon-512.png` | 512x512 | PWA icon (maskable) |
| `assets/icons/apple-touch-icon.png` | 180x180 | iOS home screen icon |
| `assets/icons/favicon.ico` | 32x32 | Browser tab icon |

## Deploying on Railway

1. Push this repo to GitHub
2. Create a new Railway project, connect the repo
3. Railway will auto-detect a static site. If not, set the start command to: `npx serve -s .`
4. Ensure the domain is served over HTTPS (Railway does this by default)

## Architecture

- Single `index.html` with two screens (menu + scan), toggled by JS
- State-driven rendering: one `state` object, one `render()` function
- Web Audio API for doppler synthesis (no audio files)
- Inline SVG vessel with CSS animations (no vessel video files)
- SVG fallbacks for all video assets
- Cache-first service worker for offline support
