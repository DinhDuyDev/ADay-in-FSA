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

// ---- synthesised speech blips (Deltarune / Tomodachi-Life style) ----
// Pitches are quantised to a major-pentatonic scale so the babble comes out
// musical and soft rather than random and harsh -- the key to it sounding nice.
const PENTA = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3];
// Per-character "voices": a comfortable base pitch (Hz) + how far each blip
// glides down (adds a warm, vocal "bo" shape). Kept in a mellow mid range.
const VOICES = {
  player: { base: 300, glide: 0.94 }, // the player -- neutral, mid
  boss:   { base: 168, glide: 0.92 }, // low + steady, a touch of authority
  lan:    { base: 356, glide: 0.95 }, // bright and light
  hung:   { base: 232, glide: 0.93 }, // warmer, lower
  npc:    { base: 272, glide: 0.94 }, // default for anyone else
};

class AudioManager {
  constructor() {
    this._sfx = {}; this._bgm = null; this._bgmStarted = false; this._unlocked = false; this._inited = false;
    this._actx = null; this._blipBus = null; this._lastBlip = 0; // speech-blip synth
  }

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
      this._ensure_synth(); // warm up the speech-blip context on the same gesture
      if (this._actx && this._actx.state === "suspended") this._actx.resume();
      for (const ev of ACTIVATION_EVENTS) window.removeEventListener(ev, unlock);
    };
    for (const ev of ACTIVATION_EVENTS) window.addEventListener(ev, unlock, { passive: true });
  }

  // Lazily build the Web-Audio graph for speech blips: a shared gain bus into a
  // gentle lowpass (warmth) into the speakers. Created on demand / on first tap.
  _ensure_synth() {
    if (this._actx) return;
    const AC = (typeof window !== "undefined") && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    try {
      const ctx = new AC();
      const bus = ctx.createGain();
      bus.gain.value = 0.16; // gentle overall level -- blips stay soft under the music
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 2600; lp.Q.value = 0.6; // shave harsh highs
      bus.connect(lp); lp.connect(ctx.destination);
      this._actx = ctx; this._blipBus = bus;
    } catch (e) { this._actx = null; }
  }

  // Play one short, soft speech blip for a spoken character. Letters/digits only
  // (spaces & punctuation fall through as natural little pauses).
  speak(ch, opts = {}) {
    if (!ch || !/[a-z0-9]/i.test(ch)) return;
    this._ensure_synth();
    const ctx = this._actx;
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    if (now - this._lastBlip < 0.05) return; // throttle -> soft, even cadence
    this._lastBlip = now;

    const v = VOICES[opts.voice] || VOICES.npc;
    const code = ch.toLowerCase().charCodeAt(0);
    const step = PENTA[code % PENTA.length];       // melodic pitch from the letter
    const lift = (code % 7 === 0) ? 2 : 1;          // occasional octave hop for life
    const freq = v.base * step * lift;
    const dur = 0.09;

    const osc = ctx.createOscillator();
    osc.type = "triangle"; // warm, rounded tone (not a harsh square/saw)
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(50, freq * v.glide), now + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.9, now + 0.006); // soft fast attack
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur); // smooth decay

    osc.connect(g); g.connect(this._blipBus);
    osc.start(now); osc.stop(now + dur + 0.03);
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
