// settings.js -- ported from settings.py. All tunables + map data.

// window (internal render resolution, 9:16). Canvas is CSS-scaled to fit.
export const WINDOW_WIDTH = 432;
export const WINDOW_HEIGHT = 768;

export const FPS = 60;

// tiles
export const TILESIZE = 32;
export const FLOOR_COVERAGE = 0.94;

// view
export const ZOOM = 1.5;
export const UP_OFFSET = 48;

// story / script
export const DIALOGUE_TEXT_SPEED = 0.5;      // chars revealed per frame
export const DIALOGUE_PAUSE_FRAMES = 120;   // hold a finished line before auto-advance

export const STORY_ID_DESK_TILE = [2, 3];
export const STORY_TEAMMATE1_DESK_TILE = [10, 7];
export const STORY_TEAMMATE2_DESK_TILE = [3, 11];

// fonts (loaded via FontFace in main.js)
// Toggle: true = pixel font (GameFont), false = plain fallback font everywhere.
export const USE_PIXEL_FONT = false;
export const FONT_FAMILY = "GameFont";              // custom pixel font
export const FONT_FALLBACK = "Helvetica, Arial, sans-serif";//"Tahoma, Segoe UI, Arial, sans-serif";
export const BASE_FONT_SIZE = 16;
export const MIN_FONT_SIZE = 10;
export const DIALOGUE_BASE_FONT_SIZE = 22;
export const DIALOGUE_MIN_FONT_SIZE = 14;

export const PLAYER_MOVE_SPEED = 4.2;
export const NPC_MOVE_SPEED = 3;

export const UI_TEXT = {
  next: "Next >",
  continue: "Continue >",
  submit: "Check",
  again: "Try Again",
  save: "Save",
  trim: "Trim Video",
  generate: "Generate Character",
  end_day: "End the Day",
  drag_hint: "Drag to reorder",
};

// ---- theme (neutral warm office) ----
export const THEME = {
  BG: "rgb(255,255,255)",
  BG_ALT: "rgb(250,242,235)",
  BORDER: "rgb(255,197,156)",
  TEXT: "rgb(45,35,30)",
  TEXT_MUTED: "rgb(150,130,120)",
  PRIMARY: "rgb(255,122,41)",
  PRIMARY_HOVER: "rgb(255,145,72)",
  PRIMARY_LIGHT: "rgb(255,214,179)",
  PRIMARY_DARK: "rgb(196,88,26)",
  PRIMARY_DARK_HOVER: "rgb(222,108,40)",
  SURFACE_DARK: "rgb(30,25,22)",
  SCREEN_DARK: "rgb(44,32,24)",
  SUCCESS: "rgb(95,173,97)",
  ERROR: "rgb(222,84,66)",
  TEXT_ON_DARK: "rgb(255,209,60)",
  WORLD_BG: "rgb(238,234,227)",
  CARD_RADIUS: 18,
  BUTTON_RADIUS: 14,
};

// procedural neutral-office palette (floor/desks/walls) -- [r,g,b]
export const THEME_FLOOR_A = [200, 194, 184];
export const THEME_FLOOR_B = [211, 206, 197];
export const THEME_FLOOR_SEAM = [190, 184, 173];
export const THEME_FLOOR_GRAIN = 5;
export const THEME_DESK_TOP = [188, 180, 168];
export const THEME_DESK_EDGE = [163, 154, 141];
export const THEME_WALL_WASH = [206, 202, 195, 95]; // rgba

export const COMPUTER_DESK_LIFT = 4;
export const COMPUTER_Y_OFFSET = 14;

export const AMBIENT_NPC_COLORS = [
  [150, 130, 120], [170, 140, 115], [140, 150, 165], [165, 125, 130],
];

// MAP: [x, y, textureIndex, height, heightnum]  (tex 1 = computer table)
export const allTiles = [
  // column 1 (left bank)
  [2, 3, 1, 0, 10], [3, 3, 1, 0, 10],
  [2, 7, 1, 0, 10], [3, 7, 1, 0, 10],
  [2, 11, 1, 0, 10], [3, 11, 1, 0, 10],
  // column 2 (right bank)
  [10, 3, 1, 0, 10], [11, 3, 1, 0, 10],
  [10, 7, 1, 0, 10], [11, 7, 1, 0, 10],
  [10, 11, 1, 0, 10], [11, 11, 1, 0, 10],
];
