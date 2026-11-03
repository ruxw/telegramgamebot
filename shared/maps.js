// Shared map definitions (server collision + client drawing). Centre-based rectangles.
export const WORLD = { w: 1280, h: 720 };

export const MAPS = {
  rooftop: {
    id: 'rooftop',
    name: 'Rooftop Rumble',
    theme: 'city',
    killY: 880,
    killX: 350,
    platforms: [
      { x: 640, y: 560, w: 720, h: 42, color: '#32254e', topColor: '#ff5c8a' }, // Main roof
      { x: 230, y: 440, w: 240, h: 26, color: '#251b3d', topColor: '#4dd2ff' }, // Left vent platform
      { x: 1050, y: 440, w: 240, h: 26, color: '#251b3d', topColor: '#4dd2ff' }, // Right vent platform
      { x: 640, y: 340, w: 260, h: 24, color: '#2b1e47', topColor: '#ffd23f' }  // Billboard catwalk
    ],
    spawns: [
      { x: 440, y: 508 },
      { x: 840, y: 508 },
      { x: 570, y: 508 },
      { x: 710, y: 508 }
    ]
  },
  ring: {
    id: 'ring',
    name: 'Wrestling Ring',
    theme: 'arena',
    killY: 880,
    killX: 300,
    platforms: [
      { x: 640, y: 570, w: 640, h: 46, color: '#243447', topColor: '#ffd23f' }, // Ring canvas floor
      { x: 320, y: 460, w: 30, h: 180, color: '#e0245e', topColor: '#ffffff' }, // Left ring post
      { x: 960, y: 460, w: 30, h: 180, color: '#e0245e', topColor: '#ffffff' }, // Right ring post
      { x: 640, y: 450, w: 610, h: 14, color: '#17bf63', topColor: '#7cff6b' }  // Middle rope platform
    ],
    spawns: [
      { x: 450, y: 518 },
      { x: 830, y: 518 },
      { x: 560, y: 518 },
      { x: 720, y: 518 }
    ]
  },
  factory: {
    id: 'factory',
    name: 'Meat Factory',
    theme: 'industrial',
    killY: 860,
    killX: 300,
    platforms: [
      { x: 380, y: 540, w: 340, h: 36, color: '#3d312a', topColor: '#f08236' }, // Left conveyor
      { x: 900, y: 540, w: 340, h: 36, color: '#3d312a', topColor: '#f08236' }, // Right conveyor (hazard chute in center!)
      { x: 640, y: 380, w: 300, h: 26, color: '#4a3c34', topColor: '#ffd23f' }, // Overhead grinder rail
      { x: 200, y: 390, w: 180, h: 24, color: '#302621', topColor: '#ff4d6d' }, // Left pipe catwalk
      { x: 1080, y: 390, w: 180, h: 24, color: '#302621', topColor: '#ff4d6d' } // Right pipe catwalk
    ],
    spawns: [
      { x: 340, y: 488 },
      { x: 940, y: 488 },
      { x: 440, y: 488 },
      { x: 840, y: 488 }
    ]
  },
  trucks: {
    id: 'trucks',
    name: 'Highway Trucks',
    theme: 'highway',
    killY: 880,
    killX: 320,
    platforms: [
      { x: 440, y: 550, w: 380, h: 48, color: '#1c2738', topColor: '#00d4ff' }, // Left truck roof
      { x: 840, y: 550, w: 380, h: 48, color: '#2c1e30', topColor: '#ff3366' }, // Right truck roof (deadly road gap between!)
      { x: 640, y: 360, w: 220, h: 22, color: '#334155', topColor: '#38ef7d' }  // Overhead highway gantry sign
    ],
    spawns: [
      { x: 360, y: 498 },
      { x: 920, y: 498 },
      { x: 480, y: 498 },
      { x: 800, y: 498 }
    ]
  }
};
