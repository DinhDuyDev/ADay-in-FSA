// audio.js -- ported from audio.py. HTML5 Audio (runs off the render
// thread, so no FPS-tied crackle). SFX overlap via cloneNode.

const BGM_PATH = "audio/bgm.ogg";
const BGM_VOLUME = 0.35;
const SFX_VOLUME = 0.55;

const SFX_PATHS = {
  click: "audio/click.ogg",
  correct: "audio/correct.ogg",
  wrong: "audio/wrong.ogg",
  confetti: "audio/confetti.ogg",
};

// Any of these count as a genuine "user activation" that lets the browser play
// audible audio. We listen for all of them so the very first thing the user
// does -- tap, touch, key, or click, anywhere on the page -- unmutes the music.
const ACTIVATION_EVENTS = ["pointerdown", "touchend", "keydown", "click"];

class AudioManager {
  constructor() { this._sfx = {}; this._bgm = null; this._bgmStarted = false; this._unlocked = false; this._inited = false; }

  // Safe to call as early as possible (idempotent). Kicks off buffering of the
  // soundtrack + SFX right away so playback can begin the instant the user taps.
  init() {
    if (this._inited) return;
    this._inited = true;
    for (const [k, path] of Object.entries(SFX_PATHS)) {
      const a = new Audio(path);
      a.preload = "auto";
      a.volume = SFX_VOLUME;
      a.load();
      this._sfx[k] = a;
    }
    // Reuse the element the HTML head started buffering during page parse, if
    // present, so playback uses already-downloaded bytes with no second fetch.
    const pre = (typeof window !== "undefined") ? window.__bgmPreload : null;
    this._bgm = pre || new Audio(BGM_PATH);
    this._bgm.loop = true;
    this._bgm.volume = BGM_VOLUME;
    this._bgm.preload = "auto";
    if (!pre) this._bgm.load(); // fresh element: begin downloading now

    // Try to start the soundtrack right away (no tap needed). Browsers forbid
    // *audible* autoplay until the user interacts, so if that's refused we start
    // it MUTED instead -- muted autoplay is always allowed -- and the track is
    // then already rolling, becoming audible the instant the user first touches
    // the page, with no start-up delay.
    this._start_bgm_autoplay();

    // Unmute / ensure playing on the first genuine user activation of any kind.
    const unlock = () => {
      this._unlocked = true;
      if (this._bgm) {
        this._bgm.muted = false;
        if (this._bgm.paused) this._bgm.play().then(() => { this._bgmStarted = true; }).catch(() => {});
      }
      for (const ev of ACTIVATION_EVENTS) window.removeEventListener(ev, unlock);
    };
    for (const ev of ACTIVATION_EVENTS) window.addEventListener(ev, unlock, { passive: true });
  }

  _start_bgm_autoplay() {
    if (!this._bgm) return;
    this._bgm.muted = false;
    const p = this._bgm.play();
    if (p && p.then) {
      p.then(() => { this._bgmStarted = true; }).catch(() => {
        if (this._unlocked || !this._bgm) return; // user already interacted
        this._bgm.muted = true; // audible autoplay blocked -> roll it silently
        this._bgm.play().then(() => { this._bgmStarted = true; }).catch(() => {});
      });
    }
  }

  play_sfx(key) {
    const a = this._sfx[key];
    if (!a) return;
    try { const c = a.cloneNode(); c.volume = SFX_VOLUME; c.play().catch(() => {}); } catch (e) {}
  }
  play_minigame_result(id, ok) { this.play_sfx(ok ? "correct" : "wrong"); }

  play_bgm() {
    if (!this._bgm) return;
    this._bgm.muted = false; // make sure it's audible (may have been muted-prerolled)
    if (this._bgm.paused) this._bgm.play().then(() => { this._bgmStarted = true; }).catch(() => {});
    else this._bgmStarted = true;
  }
  stop_bgm() { if (this._bgm) { this._bgm.pause(); this._bgmStarted = false; } }
  set_bgm_volume(v) { if (this._bgm) this._bgm.volume = Math.max(0, Math.min(1, v)); }
}

export const audio = new AudioManager();
