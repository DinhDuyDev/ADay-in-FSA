// entities.js -- Player, NPC, AmbientNPC. Ported from entities.py.
import { pathfind } from "./pathfind.js";
import { dist, pointDirection, lerp, rad } from "./utils.js";
import { TILESIZE, PLAYER_MOVE_SPEED, NPC_MOVE_SPEED } from "./settings.js";

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.real_x = x; this.real_y = y;
    this.dest_x = x; this.dest_y = y;
    this.move_path = [];
    this.move_speed = PLAYER_MOVE_SPEED;
    this._frames = {};        // state -> [img]
    this._single = null;
    this.state = "idle";
    this.anim_fps = 6;
    this._anim_t = 0;
  }
  set_sprite(s) { this._single = s; }
  set_frames(f) { this._frames = f; }

  _get_frame() {
    const frames = this._frames[this.state] || this._frames["idle"];
    if (frames && frames.length) {
      const idx = Math.floor(this._anim_t * this.anim_fps) % frames.length;
      return frames[idx];
    }
    return null;
  }
  calc_movement(gx, gy, tiles) {
    this.dest_x = gx; this.dest_y = gy;
    this.move_path = pathfind(
      Math.floor(this.x / TILESIZE), Math.floor(this.y / TILESIZE),
      Math.floor(gx / TILESIZE), Math.floor(gy / TILESIZE), tiles);
    if (!this.move_path.length) { this.dest_x = this.x; this.dest_y = this.y; }
  }
  move_to(gx, gy, tiles) { this.calc_movement(gx, gy, tiles); }
  has_arrived() { return this.move_path.length === 0; }
  is_moving() { return this.move_path.length > 0; }

  movement() {
    if (this.move_path.length === 0) {
      this.dest_x = this.real_x; this.dest_y = this.real_y;
    } else {
      const [tx, ty] = this.move_path[0];
      const px = tx * TILESIZE + 16, py = ty * TILESIZE + 16;
      if (dist(this.real_x, this.real_y, px, py) > 5) {
        const d = pointDirection(this.x, this.y, px, py);
        this.real_x += Math.cos(rad(d)) * this.move_speed;
        this.real_y -= Math.sin(rad(d)) * this.move_speed;
      } else {
        this.move_path.shift();
      }
    }
    this.x = lerp(this.x, this.real_x, 0.1);
    this.y = lerp(this.y, this.real_y, 0.1);
    if (this.is_moving()) { this.state = "walk"; }
    else if (this.state === "walk") { this.state = "idle"; }
    this._anim_t += 1 / 60;
  }
  bob_offset() {
    if ((this._single === null && !Object.keys(this._frames).length) || !this.is_moving()) return 0;
    return Math.sin(this._anim_t * 8) * 3;
  }
  surf() {
    const f = this._get_frame();
    if (f) return f;
    if (this._single) return this._single;
    return null; // invisible until a role is chosen
  }
}

export class NPC {
  constructor(x, y, surface) {
    this.x = x; this.y = y;
    this.real_x = x; this.real_y = y;
    this.move_path = [];
    this.surface = surface;
    this.move_speed = NPC_MOVE_SPEED;
  }
  movement() {
    if (this.move_path.length === 0) return;
    const [tx, ty] = this.move_path[0];
    const px = tx * TILESIZE + 16, py = ty * TILESIZE + 16;
    if (dist(this.real_x, this.real_y, px, py) > 5) {
      const d = pointDirection(this.x, this.y, px, py);
      this.real_x += Math.cos(rad(d)) * this.move_speed;
      this.real_y -= Math.sin(rad(d)) * this.move_speed;
    } else { this.move_path.shift(); }
    this.x = lerp(this.x, this.real_x, 0.1);
    this.y = lerp(this.y, this.real_y, 0.1);
  }
  surf() { return this.surface; }
}

export class AmbientNPC {
  constructor(x, y, surface) { this.x = x; this.y = y; this.surface = surface; }
  surf() { return this.surface; }
}
