# Decisions

Non-obvious choices made during implementation.

## Vessel is SVG, not video

The spec calls for vessel-idle and vessel-active video files. We replaced these with an inline SVG featuring CSS-animated blood cells and a pulsing glow. This sidesteps the iOS alpha transparency problem entirely — WebM alpha isn't supported on iOS, and HEVC-alpha MP4s require specialized tooling to produce. The SVG approach is simpler, lighter, and works identically on all platforms. If HEVC-alpha videos are produced later, the SVG can be swapped back out.

## Dr. Thump videos use baked cream backgrounds

Instead of relying on alpha-channel video (which iOS doesn't support via WebM), Dr. Thump videos are expected to have the cream (#FFF4E8) app background baked into them. The video elements sit on cream-colored panels, so the edges blend seamlessly. No alpha channel needed.

## Three separate video elements for Thump states

Rather than swapping `src` on a single `<video>` element (which causes a visible reload/flash), we pre-declare three `<video>` elements (idle, talking, cheering) and toggle their `hidden` attribute. This makes state transitions instant since all videos are preloaded and looping in the background.

## Service worker caches videos individually

The spec says cache-first with `cache.addAll()`. We use `addAll()` for the app shell (HTML/CSS/JS) but cache video/icon assets individually with `try/catch` per file. This way, missing video assets during development don't prevent the service worker from installing.

## No landscape handling

The spec mentions portrait-only. The manifest sets `"orientation": "portrait"` (works for installed PWA). We don't add a "please rotate" overlay in the browser — it would be a worse experience for kids than a slightly-weird landscape layout.

## Sparkle burst is CSS-only

The burst animation uses an inline SVG with a CSS scale+fade keyframe animation, rather than the burst.webm/mp4 video files from the spec. This avoids another alpha-transparency concern and is simpler to implement. If a richer burst effect is desired later, the video can be layered in.

## Audio drift accepted

The doppler loop uses `setInterval` which can drift over time. For a kids' toy where scans last under a minute, this is imperceptible. A Web Audio API scheduling approach with lookahead would eliminate drift but adds significant complexity for no user-visible benefit.

## Camera requested on Scan tap, not screen entry

Per spec. This is less jarring than requesting camera permission the moment the scan screen appears. The scan flow still works if camera is denied — it just shows a friendly message instead of a camera feed.
