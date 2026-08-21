# A Day in FSA.STIL — JavaScript edition

A full rewrite of the PyGame game in **vanilla JavaScript + HTML5 Canvas**
(no framework, no build step, no pygbag/WASM runtime). It loads in a
fraction of the time the pygbag build did, because there's no ~15 MB
CPython/pygame runtime to download — just the ~1 MB of assets and a few
small `.js` files.

## Run it

It's static files, so any web server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` via `file://` won't work — ES modules need
`http(s)://`.)

## Deploy to GitHub Pages

1. Put the **contents of this folder** at the root of a repo (or in `/docs`).
2. GitHub → **Settings → Pages → Deploy from a branch → `main` / root** (or `/docs`).
3. Open `https://<you>.github.io/<repo>/`.

No build step. What you commit is what runs.

## Project layout

```
index.html          canvas + loading screen + pixel @font-face
audio/ sprites/ fonts/   the game assets (shared with the Python version)
js/
  settings.js       constants, theme, map data
  utils.js          math helpers
  pathfind.js       A* grid pathfinder
  entities.js       Player, NPC, AmbientNPC
  gfx.js            Canvas helpers (offscreen canvases, scaling, text, bounds)
  draw_order.js     painter's-algorithm depth sort
  audio.js          HTML5 Audio (BGM + SFX, unlocked on first tap)
  dialogue_data.js  all spoken lines
  minigame_data.js  minigame content
  ui.js             Button, DialogueBox, ConversationScene, ComputerTransition,
                    ConfettiEffect, FeedbackOverlay, placeholders
  minigames.js      OrderingGame, QuizGame, CharacterCreatorGame, VideoTrimGame
  story.js          the stage/state machine
  main.js           isometric sprite-stacking renderer + game loop + input
```

## How it maps to the original

- `pygame.Surface` / `blit` → `<canvas>` / `drawImage`
- `pygame.transform.rotate/scale` → offscreen-canvas rotate/scale helpers
- immediate-mode blitting → same, on the 2D context
- baked behind/front world layers → offscreen canvases, rebaked on camera/zoom change
- audio → HTML5 `Audio` (runs off the render thread, so no FPS-tied crackle)
- fixed 60 Hz update via an accumulator; `requestAnimationFrame` for rendering

## Controls

- **Drag** on the office (free-roam): rotate the camera / look up–down.
- **Tap**: advance dialogue, pick answers, drag minigame elements, press buttons.

## Notes

- Internal render resolution is 432×768 (9:16); the canvas is CSS-scaled to
  fit any screen with `image-rendering: pixelated` for crisp pixels.
- Audio starts on the first tap/click (browser autoplay policy).
