================================================================
STUDYTUBE
A local, distraction-free study player built around YouTube
================================================================

CONTENTS
  1. What this is
  2. How to run it
  3. Files in this project
  4. Features
  5. Appearance (themes, accent colors, motion)
  6. Focus Mode
  7. Keyboard shortcuts
  8. Where your data lives (privacy)
  9. What StudyTube does NOT do
  10. Known limitations
  11. Troubleshooting
  12. Changelog


----------------------------------------------------------------
1. WHAT THIS IS
----------------------------------------------------------------

StudyTube is a single-page app that wraps the official YouTube
embedded player in a calmer, distraction-minimizing interface for
watching lecture/tutorial content. Paste a link, it loads, you
study. That's the whole product.

It is plain HTML + CSS + JavaScript. No build step, no framework,
no backend, no account.


----------------------------------------------------------------
2. HOW TO RUN IT
----------------------------------------------------------------

YouTube's embedded player needs the page served over http(s) — it
will NOT work if you just double-click index.html and open it as
a file:// URL.

Option A — VS Code + Live Server
  1. Open this folder in VS Code.
  2. Right-click index.html.
  3. Choose "Open with Live Server".
  4. It opens at http://127.0.0.1:5500 (or similar).

Option B — Python's built-in server
  From this folder, run:
      python -m http.server 5500
  Then open:
      http://localhost:5500

If you edit the files while Live Server is running, stop and
restart it afterward — browsers (and Live Server) can serve a
cached copy of the old CSS/JS otherwise.


----------------------------------------------------------------
3. FILES IN THIS PROJECT
----------------------------------------------------------------

  index.html    Page structure: player, controls, Appearance
                panel, History/Favorites sidebar.
  style.css     All visual styling, including the theme system
                (CSS custom properties) and animations.
  script.js     All behavior: the YouTube player lifecycle, URL
                parsing, progress/resume, history/favorites,
                fullscreen, Focus Mode, and the Appearance panel.
  README.txt    This file.

There is no build step — editing these three files and refreshing
the browser is the entire workflow.


----------------------------------------------------------------
4. FEATURES
----------------------------------------------------------------

PLAYBACK
  - Paste any supported YouTube link and it loads — no page
    refresh needed between videos, ever.
  - Play/Pause, ±10s, seek bar, volume/mute, playback speed,
    picture quality, captions (on videos that have them), and a
    sleep timer (auto-pause after N minutes, or at the end of the
    current video).
  - Fullscreen with its own on-screen controls (since normal
    fullscreen hides everything outside the video).

SUPPORTED LINK FORMATS
  - youtube.com/watch?v=..., youtu.be/..., /shorts/..., /embed/...,
    /live/..., /playlist?list=...
  - A link with both a video AND a playlist (?v=...&list=...) —
    loads in playlist context so Previous/Next both work.
  - Timestamps: ?t=90, ?t=2m30s, ?t=1h2m10s, ?start=90
  - A bare video ID or playlist ID, pasted with no URL at all.
  - Anything else (wrong site, malformed, empty) shows a clear
    error and leaves whatever's currently playing untouched.

PLAYLISTS
  - Next / Previous, with buttons that correctly disable at the
    first/last item.

PROGRESS & RESUME
  - Every video remembers its own watch position (including each
    video inside a playlist) — switching away and back resumes
    where you left off.
  - A "Continue from 12:34?" prompt appears when reopening an
    unfinished video (configurable: always ask, always resume,
    or always start over).
  - "Mark Complete" lets you flag a video as done by hand,
    independent of playback position — rewinding a finished video
    to review it doesn't un-complete it.

HISTORY & FAVORITES
  - Recently watched videos and starred favorites, each showing
    live watch-percentage or a "Completed" badge.


----------------------------------------------------------------
5. APPEARANCE (THEMES, ACCENT COLORS, MOTION)
----------------------------------------------------------------

Click the "Appearance" button (top bar) to open the panel.

THEMES — pick the overall visual personality:
  - Midnight     dark, professional, violet-accented (default)
  - Sakura       dark, warm pink/plum, soft and cozy
  - Neon Forge   dark, cyan/violet, technical
  - Ocean Calm   dark, navy/teal, calm and clean
  - Sunset Bloom dark, warm coral/orange
  - Paper Study  LIGHT — cream background, ink-brown text, a
                 quiet academic/notebook feel. Deliberately the
                 most restrained theme — almost no decoration.
  - Princess Bloom LIGHT — blush/rose/lavender/champagne, with
                 tiny original sparkle decorations and a crown
                 accent. Deliberately the most "extra" theme —
                 not every theme needs equal decoration, and the
                 contrast between Paper Study's restraint and
                 Princess Bloom's sparkle is intentional. No
                 copied character artwork of any kind (see the
                 "Princess Bloom details" section below).

MODE — Light / Dark / System, independent of which theme you like:
  - Dark    always uses whichever DARK theme you last picked
            (one of the 5 above; Midnight by default)
  - Light   always uses whichever LIGHT theme you last picked
            (Paper Study or Princess Bloom; Paper Study by default)
  - System  follows your operating system's light/dark setting —
            and actually keeps following it live: if you change
            your OS setting while StudyTube is open in System
            mode, the theme flips immediately, no reload needed
  Clicking a theme card directly (e.g. "Neon Forge") is treated as
  an explicit choice and turns System mode off, same as clicking
  "Dark" or "Light" directly — this matches how "follow system"
  settings work in most operating systems and apps.

ACCENT COLOR — independent of theme and mode. Pick any of Violet,
  Blue, Cyan, Green, Pink, or Orange with any theme (e.g. "Ocean
  Calm" theme with a "Pink" accent is a perfectly normal
  combination).

MOTION — four levels, replacing the old single on/off switch:
  - Off         no decorative animation at all, everything instant
  - Minimal     short hover/press feedback only; no entrance
                animations, no sparkles/petals
  - Standard    the normal, default level of polish (fades, hover
                lifts, theme personality touches shown but static)
  - Expressive  adds a LITTLE more — Sakura's petals and Princess
                Bloom's sparkles actually drift/twinkle instead of
                sitting still, and the brand mark gets a slow
                breathing glow. Still nowhere near disruptive.
  Your OS's own "reduce motion" accessibility setting always wins,
  regardless of which of the 4 levels you've picked here.

RESET APPEARANCE — puts theme/mode/accent/motion back to the
  default (Dark mode, Midnight, Violet, Standard motion). It only
  resets appearance — it cannot touch your history, favorites, or
  progress.

First-visit behavior: before you've ever chosen anything, StudyTube
starts in System mode, so your very first impression already
matches your OS's light/dark setting. The moment you pick anything
yourself in the Appearance panel, that becomes an explicit choice
and StudyTube stops auto-following your OS for you — until you
deliberately switch back to "System" yourself.

If you used an earlier version of StudyTube and already had a
theme/accent/"Reduce Animation" choice saved, it's migrated
automatically and safely the first time you open this version —
your old theme becomes the new Dark-or-Light + Mode combination
that reproduces the same look, and "Reduce Animation: on" becomes
"Motion: Off". This happens once, silently, and your choice is
preserved either way.

Switching theme, mode, accent, or motion never reloads the page,
never recreates the video player, and never touches your study
data — it only changes colors/animation.

PRINCESS BLOOM DETAILS: the sparkle decorations are Unicode star
glyphs (✦ ✧) rendered in the theme's own color — not an image, not
copied artwork, just text characters, which sidesteps any
licensing question entirely. There is no Hello Kitty, Sanrio, or
any other branded character anywhere in this theme or project —
the crown next to its name in the Appearance panel is a plain 👑
emoji, rendered by your device's own font, same as any other emoji
in this document. Every color in the palette was checked against
WCAG contrast requirements before shipping (see the Changelog).


----------------------------------------------------------------
6. FOCUS MODE
----------------------------------------------------------------

The "Focus Mode" button hides everything except the video and its
core controls — the URL box, sidebar, Appearance button, and Clear
Data button all disappear, and any decorative sparkles/petals from
the current theme are hidden too, so the lecture is the only thing
on screen regardless of which theme you have active.

Getting out is never a dead end, by design (three independent ways):
  1. The "Exit Focus Mode" button stays visible the entire time.
  2. Pressing Esc exits Focus Mode.
  3. Focus Mode never turns itself back on automatically — every
     fresh page load starts in Normal Mode, full stop, even if you
     had Focus Mode on the last time you used the app.

(An earlier version of this app had a bug where Focus Mode could
trap you with no way out. It's fixed — see the Changelog.)


----------------------------------------------------------------
7. KEYBOARD SHORTCUTS
----------------------------------------------------------------

  Space          Play / Pause
  ← / →          Seek 5 seconds back / forward
  Shift + ← / →  Seek 10 seconds back / forward
  ↑ / ↓          Volume up / down
  M              Mute
  F              Fullscreen
  Esc            Exit Focus Mode (or close the Appearance panel,
                 or dismiss the resume prompt — whichever is open)

Shortcuts are automatically disabled while you're typing into any
text field, so they won't fire by accident.


----------------------------------------------------------------
8. WHERE YOUR DATA LIVES (PRIVACY)
----------------------------------------------------------------

Everything StudyTube remembers is stored in your browser's
localStorage — on your device only. Nothing is uploaded anywhere;
there is no server, no account, no analytics.

This means:
  - It's specific to one browser on one device. Chrome on your
    laptop and Chrome on your phone do NOT share this data — it's
    not "cloud sync," it's local storage.
  - Clearing your browser's site data for this page clears it too.

What's stored, and in separate places so one can never corrupt
another:
  - Watch history, favorites, and per-video progress/resume state
  - Your Resume-behavior preference
  - Your Appearance choices (theme, accent, motion) — kept
    completely separate from the study data above, specifically so
    "Reset Appearance" and "Clear Data" can never affect each other


----------------------------------------------------------------
9. WHAT STUDYTUBE DOES NOT DO
----------------------------------------------------------------

  - It does not remove, block, or bypass YouTube ads.
  - It does not bypass playback restrictions, region locks, or a
    video owner's decision to disable embedding.
  - It does not download or store video/audio content.
  - It does not offer alternate audio-track selection — YouTube's
    embedded player API doesn't reliably expose that for arbitrary
    videos, so rather than fake a control that wouldn't really
    work, it's simply not there.

StudyTube is a calmer interface built ON TOP OF the official
YouTube embedded player — not a replacement for it, and not a way
around any of YouTube's own rules.


----------------------------------------------------------------
10. KNOWN LIMITATIONS
----------------------------------------------------------------

  - A pasted link with both a video and a playlist, but no
    explicit position marker in the URL, starts the playlist from
    the beginning rather than jumping to that exact video (knowing
    the exact position would require a paid YouTube API call).
  - There's no visible per-video progress bar in the player itself
    yet, and no playlist-wide "3 of 12 completed" summary.
  - No "Background Effects", "Glass", "Density", or "Text Size"
    controls, and no custom accent-color picker beyond the 6
    presets. These were scoped out deliberately rather than
    attempted half-verified: each would need its own token
    infrastructure and real visual testing across every theme, and
    I don't have a real browser to check them in from here. Adding
    several at once, unverified, risks shipping a broken control
    rather than a working one.
  - No dedicated Home/hero screen exists separately from the player
    page — StudyTube is a single-page app, so "hero" decoration
    lives on the one page there is (the petals/sparkles), not a
    separate landing screen.
  - Only 2 light themes so far (Paper Study, Princess Bloom) versus
    5 dark ones.
  - Every other theme still uses its color palette + a subtle
    ambient glow as its "personality" — only Sakura (petals) and
    Princess Bloom (sparkles) have dedicated decorative elements so
    far. A Neon Forge grid-line texture was considered and
    deliberately left out: it requires layering multiple CSS
    background images with careful z-index/stacking-order math that
    I could reason through but not actually see render, and getting
    it subtly wrong would look like a bug, not a feature.
  - The decorative petals/sparkles are positioned with math I
    verified logically (percentage offsets safely inside the page's
    own padding, given the project's box-sizing:border-box), but I
    have not visually confirmed them in an actual browser at every
    screen size — see section 11 below.


----------------------------------------------------------------
11. TROUBLESHOOTING
----------------------------------------------------------------

"Video won't load / blank player"
  - Make sure you're running this through Live Server or a local
    HTTP server (see section 2), not opening index.html directly.
  - The video may have embedding disabled by its owner, or be
    private/removed — StudyTube will show a specific error message
    for this rather than a blank screen.

"Nothing happens when I paste a link"
  - Check it's an actual YouTube link/ID — unsupported sites and
    malformed links show an error message rather than doing
    nothing silently.

"I changed the files but nothing looks different"
  - Stop and restart Live Server (or your local server) after
    editing files, and hard-refresh the browser tab.

"Focus Mode got stuck" — this was a real bug in an earlier version
  and is fixed (section 6 explains the three separate safety nets
  now in place). If you still see it, you're loading an old cached
  copy of the files — replace all three files and restart your
  local server.

"My theme/appearance didn't save"
  - Make sure your browser allows localStorage for this page
    (private/incognito windows sometimes restrict or clear it).

A note on verification limits: everything in this project has been
checked with real tests I can actually run from here — JavaScript
syntax checks, CSS brace-balance checks, cross-referencing every
element ID the JS looks up against the HTML, HTML tag-balance
checks, WCAG contrast math for every new color pair, and a
from-scratch simulation of the appearance/migration logic against
13 scenarios (fresh visit, OS light/dark, legacy data migration,
corrupted data, System-mode live-following, invalid input, reset).
What I have NOT done — because I don't have an actual browser to
open here — is visually look at the rendered result, click through
it by hand, or test on a real phone. If something looks visually
off despite passing all of the above, that's the category of issue
most likely to have slipped through; please report it.


----------------------------------------------------------------
12. CHANGELOG
----------------------------------------------------------------

v1  Initial player: play/pause, seek, volume, speed, playlists,
    fullscreen, keyboard shortcuts, Focus Mode, local
    history/favorites.

v2  Reliability pass:
    - Fixed a race condition where pasting a new video quickly
      after another could leave stale state on screen.
    - Rebuilt fullscreen as a proper state manager synced to the
      browser's actual fullscreen state, with its own on-screen
      controls (previously some controls became unreachable in
      fullscreen).
    - Hardened URL parsing (all supported link formats, timestamps,
      video+playlist combos, malformed-input safety).

v3  Progress & resume:
    - Per-video watch position, resume prompts, Mark Complete,
      live watch-percentage in History/Favorites.
    - Added Quality, Captions, and Sleep Timer controls.

v4  Fixed a real bug where the Play/seek/volume/etc. controls could
    stay permanently disabled after the first video loaded (an
    internal state check was running before the video ID had
    actually been recorded). Added subtle, reduced-motion-aware
    animation polish (fades, hover lifts, button press feedback) —
    cosmetic only, no behavior changed.

v5  Fixed a real Focus Mode bug: it could trap you with the URL bar
    hidden and no visible way out, because the Exit button lived
    inside the very element the CSS hid. Three independent fixes
    now prevent this permanently (section 6).

v6  Added the Appearance system: 4 themes (Midnight, Sakura, Neon
    Forge, Ocean Calm), 6 accent colors, Reduce Animation, and
    Reset Appearance — all stored separately from study data and
    verified to never touch player state.

v7  Added 2 more themes — Sunset Bloom and Paper Study (the first
    genuinely light theme, contrast-checked against WCAG AA). Fixed
    several UI elements (Favorite star, Mark Complete, CC button,
    badges, button gradients) that were hardcoded to violet
    regardless of the chosen accent color. Added a one-time smart
    default theme based on OS light/dark preference for first-time
    visitors. Restructured this README.

v8  (this version)
      Light / Dark / System Mode control, independent of theme:
      System mode actually keeps following your OS setting while
      the app is open, with no reload. Picking a theme directly
      still works exactly as before and now also sets Mode
      correctly underneath.
    - Replaced the single "Reduce Animation" on/off switch with a
      4-level Motion system (Off / Minimal / Standard / Expressive).
      Old saved preferences (from either the theme-only version or
      the mode/motion version) migrate automatically and safely —
      verified with a 13-scenario simulation covering fresh visits,
      OS light/dark detection, legacy migration, corrupted data,
      live System-mode switching, and invalid input, all before
      shipping.
    - Added Princess Bloom: a second light theme (blush pink, rose,
      lavender, champagne), deliberately the most decorative theme
      in the set — small twinkling star decorations (✦ ✧, plain
      Unicode glyphs, not artwork) and a 👑 emoji in its theme-card
      preview. No character mascot was added on purpose (see
      "Known limitations"). Every color in its palette was checked
      against WCAG contrast before shipping.
    - Found and fixed a real, pre-existing accessibility bug while
      building Princess Bloom's palette: Sakura's default button
      text was only 1.81:1 contrast against its own accent color
      (should be 4.5:1) — fixed by darkening Sakura's default pink
      slightly, which also improved the shared "Pink" accent preset
      used by every theme.
    - Rewrote the Appearance panel's Motion control from a checkbox
      to a proper 4-option segmented control, and added a new Mode
      segmented control (Light / Dark / System) alongside it.

v9  (this version) First real-browser QA pass. A local Chrome binary
    plus puppeteer-core was found available in this environment, so
    for the first time this round was verified by actually rendering
    the app and interacting with it — not just static code checks.
    - Found and fixed a real layout bug: the 4-button Motion control
      (Off/Minimal/Standard/Expressive) overflowed the 280px
      Appearance panel by ~1px, with "Expressive" clipping past the
      rounded corner. Fixed by wrapping it into a 2x2 grid instead of
      forcing 4-in-a-row — robust regardless of font-metric
      differences across browsers, unlike a small padding tweak
      would have been. Re-measured after the fix: -21px of margin
      (comfortably contained), confirmed at both 1280px and 375px.
    - Found and fixed a real inconsistency: "Princess Bloom"'s theme
      label wrapped to two lines while every other theme's name fit
      on one — caused by the 👑 emoji glyph's rendering width, not
      the text itself. Fixed by moving the crown onto the theme's
      swatch preview (as a centered ::after) and leaving the label
      as plain text, matching every other theme card.
    - Verified live System-mode OS-following actually works, using a
      technique that isolates real application behavior from testing
      -tool limitations: intercepted window.matchMedia before the
      app initialized, captured the exact MediaQueryList object the
      app's own change-listener is attached to (confirmed via
      addEventListener interception, not guessed), and dispatched a
      synthetic change event on that precise object. Result: theme
      correctly resolved from Midnight to Princess Bloom with no
      reload, --bg/--text tokens updated correctly, and explicit
      Dark/Light choices correctly ignored a simulated OS change.
      (A naive first attempt at this test gave a false failure,
      because matchMedia() returns a new object on every call and
      the test was dispatching on the wrong one — worth recording
      since it's an easy mistake to repeat.)
    - Confirmed via real rendering: Motion levels correctly gate
      Princess Bloom's sparkles (Off/Minimal: hidden; Standard:
      visible but static; Expressive: visible and animating). Focus
      Mode correctly hides sparkles and the Appearance button while
      keeping the Exit button reachable; Esc correctly exits it.
      Appearance persists correctly across a real reload. No
      horizontal overflow at 375px or 1280px. No StudyTube console
      errors or exceptions (only the expected network-blocked
      YouTube API call and a harmless missing favicon).
    - Not verified: real video playback during theme switching
      (this sandbox has no internet access, so the YouTube IFrame
      API cannot load at all — window.YT never exists here). Also
      not verified: real mobile hardware, real OS-level theme
      switching end-to-end (vs. the object-level proof above), and
      any browser other than this Chrome build.

v10 (this version) Release validation pass — wider, more rigorous
    real-browser regression (four viewports: 320/375/768/1280px,
    both decorated themes, 39-width geometry sweep from 320px to
    1920px) plus a proper before-and-after-code-changes automated
    run (18 logic tests + 64 browser assertions, all passing both
    times). Two more real bugs surfaced and fixed:
    - The Appearance panel could render partly outside the browser
      viewport at in-between widths — clipped up to 91px off the
      left edge below ~400px, and up to 91px off the right edge
      between ~500-720px (the old CSS only special-cased <=480px,
      assuming the Appearance button stayed put, but the top bar
      re-flows at <=720px and the button moves). Fixed by making
      the panel un-anchor from the button below 720px and pin to
      the page's own gutters instead. Re-swept all 39 widths after
      the fix: 0 out-of-viewport cases (was 17).
    - Sakura's top-right petal sat 11px into the Clear Data
      button's clickable area at desktop width (petals have
      pointer-events:none, so nothing was ever un-clickable, but a
      decoration should not sit on top of a control at all). Moved
      it clear, and additionally hid it below 720px, where the same
      re-flow that affected the Appearance panel would have moved
      it into the same corner as the button again. Confirmed via a
      39-width x 2-theme sweep: 0 overlaps, nearest approach 1.8px
      (Sakura's other petal, near the URL input, at 1920px — a
      near-miss, not a hit).
    Also newly checked, all passing: exact bounding-box containment
    (not just page-level overflow) for every Appearance control at
    every tested width; decoration pointer-events:none confirmed
    plus a real hit-test proving nothing overlays the URL input;
    keyboard Tab focus lands with a visible outline and matches
    :focus-visible.


----------------------------------------------------------------
A note on how this project is maintained: every change is verified
against the actual code (JavaScript syntax checks, CSS
brace-balance checks, and cross-checking that every element ID the
JavaScript looks up actually exists in the HTML) before being
called done. As of v9, a real headless Chrome browser became
available in the build environment, so the Appearance system has
also been verified by actually rendering it, clicking through it,
and measuring real layout — not just reading the source. See v9
above for exactly what was and wasn't covered that way.
----------------------------------------------------------------