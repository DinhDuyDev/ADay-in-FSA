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

class AudioManager {
  constructor() { this._sfx = {}; this._bgm = null; this._bgmStarted = false; this._unlocked = false; }

  init() {
    for (const [k, path] of Object.entries(SFX_PATHS)) {
      const a = new Audio(path);
      a.preload = "auto";
      a.volume = SFX_VOLUME;
      this._sfx[k] = a;
    }
    this._bgm = new Audio(BGM_PATH);
    this._bgm.loop = true;
    this._bgm.volume = BGM_VOLUME;
    this._bgm.preload = "auto";
    // browsers block audio until a user gesture -> unlock on first tap
    const unlock = () => {
      this._unlocked = true;
      this.play_bgm();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: false });
    window.addEventListener("keydown", unlock, { once: false });
  }

  play_sfx(key) {
    const a = this._sfx[key];
    if (!a) return;
    try { const c = a.cloneNode(); c.volume = SFX_VOLUME; c.play().catch(() => {}); } catch (e) {}
  }
  play_minigame_result(id, ok) { this.play_sfx(ok ? "correct" : "wrong"); }

  play_bgm() {
    if (!this._bgm || this._bgmStarted) return;
    this._bgm.play().then(() => { this._bgmStarted = true; }).catch(() => {});
  }
  stop_bgm() { if (this._bgm) { this._bgm.pause(); this._bgmStarted = false; } }
  set_bgm_volume(v) { if (this._bgm) this._bgm.volume = Math.max(0, Math.min(1, v)); }
}

export const audio = new AudioManager();
