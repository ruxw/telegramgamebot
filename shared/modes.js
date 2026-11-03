// Centralized Game Modes, Titles, Collectibles, Outfits, Cosmetics, and Progression System
export const GAME_MODES = {
  classic: {
    id: 'classic',
    name: 'Classic Brawl',
    desc: 'Standard chaotic brawl. Punch, grab & throw off platforms!',
    icon: '🥊',
    minPlayers: 2,
    maxPlayers: 4,
    scoring: 'knockouts',
    rules: 'Last standing or highest KOs wins when timer expires.'
  },
  lms: {
    id: 'lms',
    name: 'Last Man Standing',
    desc: 'One life. No respawns. Only the ultimate survivor wins.',
    icon: '💀',
    minPlayers: 2,
    maxPlayers: 4,
    scoring: 'survival',
    rules: 'Fall off once and you are out! Last beast alive takes glory.'
  },
  team: {
    id: 'team',
    name: 'Team Knockout',
    desc: '2v2 Tag-team rumble. Coordinate grabs and throws!',
    icon: '👥',
    minPlayers: 4,
    maxPlayers: 4,
    scoring: 'team_score',
    rules: 'Team with most knockouts combined wins.'
  },
  king: {
    id: 'king',
    name: 'King of the Arena',
    desc: 'Hold the elevated center zone to rack up points!',
    icon: '👑',
    minPlayers: 2,
    maxPlayers: 4,
    scoring: 'zone_time',
    rules: 'Stay in the center platform to gain points every second.'
  },
  survival: {
    id: 'survival',
    name: 'Survival Rush',
    desc: 'Survive relentless waves of aggressive AI fighters!',
    icon: '🔥',
    minPlayers: 1,
    maxPlayers: 4,
    scoring: 'waves_survived',
    rules: 'Defeat incoming beasts before they overrun the platform.'
  },
  tournament: {
    id: 'tournament',
    name: 'Knockout Tournament',
    desc: 'Bracket-style elimination. Win your round to advance!',
    icon: '🏆',
    minPlayers: 2,
    maxPlayers: 6,
    scoring: 'tournament_bracket',
    rules: 'Consecutive knockout rounds until 1 champion remains.'
  },
  crown: {
    id: 'crown',
    name: 'Capture the Crown',
    desc: 'Grab the golden crown and hold it for 30 seconds!',
    icon: '💎',
    minPlayers: 2,
    maxPlayers: 4,
    scoring: 'crown_seconds',
    rules: 'Being punched drops the crown! Catch it and keep moving.'
  },
  elimination: {
    id: 'elimination',
    name: 'Elimination Challenge',
    desc: 'Every 20 seconds, the beast with lowest damage dealt drops!',
    icon: '⏱️',
    minPlayers: 3,
    maxPlayers: 6,
    scoring: 'countdown_survival',
    rules: 'Keep fighting aggressively or face sudden elimination.'
  },
  chaos: {
    id: 'chaos',
    name: 'Chaos Arena',
    desc: 'Low gravity, 2x speed, hyper bounce & frequent bombs!',
    icon: '⚡',
    minPlayers: 2,
    maxPlayers: 4,
    scoring: 'chaos_points',
    rules: 'Physics turned to maximum absurdity. Pure pandemonium.'
  },
  boss: {
    id: 'boss',
    name: 'Boss Battle',
    desc: 'Cooperate against a gigantic, heavyweight Titan Beast bot!',
    icon: '👹',
    minPlayers: 1,
    maxPlayers: 3,
    scoring: 'boss_damage',
    rules: 'Team up to stagger and yeet the Mega Boss off the platform!'
  }
};

export const AI_DIFFICULTIES = {
  beginner: {
    id: 'beginner',
    name: 'Beginner',
    reactionMs: 450,
    predictMovement: false,
    dodgeBombs: false,
    useHazards: false,
    comboAttacks: false,
    jumpRecovery: false,
    xpMultiplier: 0.5
  },
  intermediate: {
    id: 'intermediate',
    name: 'Intermediate',
    reactionMs: 300,
    predictMovement: false,
    dodgeBombs: true,
    useHazards: false,
    comboAttacks: false,
    jumpRecovery: true,
    xpMultiplier: 0.8
  },
  advanced: {
    id: 'advanced',
    name: 'Advanced',
    reactionMs: 180,
    predictMovement: true,
    dodgeBombs: true,
    useHazards: true,
    comboAttacks: true,
    jumpRecovery: true,
    xpMultiplier: 1.0
  },
  expert: {
    id: 'expert',
    name: 'Expert',
    reactionMs: 110,
    predictMovement: true,
    dodgeBombs: true,
    useHazards: true,
    comboAttacks: true,
    jumpRecovery: true,
    xpMultiplier: 1.4
  },
  nightmare: {
    id: 'nightmare',
    name: 'Nightmare',
    reactionMs: 65,
    predictMovement: true,
    dodgeBombs: true,
    useHazards: true,
    comboAttacks: true,
    jumpRecovery: true,
    xpMultiplier: 1.8
  },
  champion: {
    id: 'champion',
    name: 'Champion',
    reactionMs: 40,
    predictMovement: true,
    dodgeBombs: true,
    useHazards: true,
    comboAttacks: true,
    jumpRecovery: true,
    xpMultiplier: 2.2
  }
};

export const AI_ARCHETYPES = {
  aggressive: { id: 'aggressive', name: 'Aggressor', punchFreq: 0.8, grabFreq: 0.2, chaseDistance: 600 },
  defensive: { id: 'defensive', name: 'Guardian', punchFreq: 0.3, grabFreq: 0.4, chaseDistance: 250 },
  grappler: { id: 'grappler', name: 'Yeeter', punchFreq: 0.2, grabFreq: 0.85, chaseDistance: 450 },
  counter: { id: 'counter', name: 'Counter-Striker', punchFreq: 0.6, grabFreq: 0.5, chaseDistance: 320 },
  chaos: { id: 'chaos', name: 'Madman', punchFreq: 0.7, grabFreq: 0.7, chaseDistance: 800 },
  tactical: { id: 'tactical', name: 'Strategist', punchFreq: 0.5, grabFreq: 0.5, chaseDistance: 400 }
};

export const TITLES = [
  { id: 'brawler', name: 'Street Brawler', icon: '🥊', rarity: 'common', reqWins: 0 },
  { id: 'rookie', name: 'Ring Rookie', icon: '🌱', rarity: 'common', reqWins: 1 },
  { id: 'puncher', name: 'Knockout Artist', icon: '💥', rarity: 'common', reqWins: 3 },
  { id: 'yeeter', name: 'Yeet Enthusiast', icon: '🚀', rarity: 'common', reqWins: 5 },
  { id: 'rooftop', name: 'Rooftop Wrecker', icon: '🏙️', rarity: 'rare', reqWins: 8 },
  { id: 'heavyweight', name: 'Heavyweight Menace', icon: '🏋️', rarity: 'rare', reqWins: 12 },
  { id: 'chaos', name: 'Chaos Bringer', icon: '⚡', rarity: 'rare', reqWins: 16 },
  { id: 'iron_fist', name: 'Iron Fist', icon: '🥊', rarity: 'rare', reqWins: 20 },
  { id: 'lms_master', name: 'Last Man Standing', icon: '💀', rarity: 'epic', reqWins: 25 },
  { id: 'gladiator', name: 'Arena Gladiator', icon: '⚔️', rarity: 'epic', reqWins: 30 },
  { id: 'unstoppable', name: 'Unstoppable Force', icon: '🌪️', rarity: 'epic', reqWins: 38 },
  { id: 'crowd_fav', name: 'Crowd Favourite', icon: '📣', rarity: 'epic', reqWins: 45 },
  { id: 'boss_slayer', name: 'Titan Slayer', icon: '👹', rarity: 'epic', reqWins: 55 },
  { id: 'apex', name: 'Apex Brawler', icon: '👑', rarity: 'legendary', reqWins: 70 },
  { id: 'nightmare_slayer', name: 'Nightmare Conqueror', icon: '🔥', rarity: 'legendary', reqWins: 85 },
  { id: 'jelly_god', name: 'Jelly Divinity', icon: '✨', rarity: 'legendary', reqWins: 100 },
  { id: 'champion', name: 'Grand Champion', icon: '🏆', rarity: 'legendary', reqWins: 120 },
  { id: 'mythic', name: 'Mythic Beast', icon: '🐉', rarity: 'legendary', reqWins: 150 },
  { id: 'immortal', name: 'The Immortal', icon: '💎', rarity: 'legendary', reqWins: 200 },
  { id: 'phantom', name: 'Phantom King', icon: '🌌', rarity: 'legendary', reqWins: 250 }
];

export const IN_GAME_COLLECTIBLES = [
  { id: 'frost_crown', name: 'Frost Crown Gift', icon: '❄️', rarity: 'legendary', glow: '#4dd2ff', desc: 'Rare frozen jewel of the arena' },
  { id: 'golden_star', name: 'Golden Star Trophy', icon: '⭐', rarity: 'rare', glow: '#ffd23f', desc: 'Awarded for supreme group dominance' },
  { id: 'diamond_shard', name: 'Diamond Shard NFT', icon: '💎', rarity: 'epic', glow: '#a259ff', desc: 'Crystalline fragment of victory' },
  { id: 'cyber_orb', name: 'Cyber Core Fragment', icon: '🔮', rarity: 'epic', glow: '#00f5d4', desc: 'Pulsing mechanical heart' },
  { id: 'flame_badge', name: 'Ignited Crest', icon: '🔥', rarity: 'rare', glow: '#ff5c8a', desc: 'Burns with unyielding fight spirit' }
];

export const COSMETICS = {
  skins: [
    { id: '#8a4fff', name: 'Deep Violet', rarity: 'common' },
    { id: '#ff4d6d', name: 'Neon Coral', rarity: 'common' },
    { id: '#4dd2ff', name: 'Aqua Cyan', rarity: 'common' },
    { id: '#ffd23f', name: 'Gold Yellow', rarity: 'common' },
    { id: '#7cff6b', name: 'Lime Green', rarity: 'common' },
    { id: '#ff7b00', name: 'Tangerine', rarity: 'rare' },
    { id: '#1a1829', name: 'Shadow Charcoal', rarity: 'rare' },
    { id: '#00f5d4', name: 'Cyber Mint', rarity: 'legendary' }
  ],
  headwear: [
    { id: 'none', name: 'None', icon: '🚫' },
    { id: 'crown', name: 'Crown', icon: '👑', rarity: 'legendary' },
    { id: 'shades', name: 'Sunglasses', icon: '🕶️', rarity: 'common' },
    { id: 'cap', name: 'Baseball Cap', icon: '🧢', rarity: 'common' },
    { id: 'beanie', name: 'Beanie', icon: '🧶', rarity: 'common' },
    { id: 'headphones', name: 'Headphones', icon: '🎧', rarity: 'rare' },
    { id: 'cowboy', name: 'Cowboy Hat', icon: '🤠', rarity: 'rare' },
    { id: 'viking', name: 'Viking Helmet', icon: '🪖', rarity: 'rare' },
    { id: 'tophat', name: 'Top Hat', icon: '🎩', rarity: 'epic' },
    { id: 'halo', name: 'Angel Halo', icon: '😇', rarity: 'legendary' },
    { id: 'bunny', name: 'Bunny Ears', icon: '🐰', rarity: 'rare' },
    { id: 'bow', name: 'Ribbon Bow', icon: '🎀', rarity: 'common' }
  ],
  face: [
    { id: 'normal', name: 'Normal', icon: '🙂' },
    { id: 'cool', name: 'Cool Shades', icon: '😎' },
    { id: 'smirk', name: 'Smirk', icon: '😏' },
    { id: 'shocked', name: 'Shocked', icon: '😮' },
    { id: 'sleepy', name: 'Sleepy', icon: '😴' },
    { id: 'angry', name: 'Angry', icon: '😠' },
    { id: 'laughing', name: 'Laughing', icon: '😄' },
    { id: 'tongue', name: 'Tongue Out', icon: '😛' },
    { id: 'evil', name: 'Evil Grin', icon: '😈' },
    { id: 'determined', name: 'Determined', icon: '😤' }
  ],
  outfits: [
    { id: 'none', name: 'None', icon: '🚫' },
    { id: 'streetwear', name: 'Streetwear Hoodie', icon: '👕', rarity: 'rare' },
    { id: 'tracksuit', name: 'Retro Tracksuit', icon: '🏃', rarity: 'rare' },
    { id: 'boxer', name: 'Boxing Shorts', icon: '🥊', rarity: 'epic' },
    { id: 'wrestler', name: 'Wrestler Singlet', icon: '🤼', rarity: 'epic' },
    { id: 'tuxedo', name: 'Formal Tuxedo', icon: '🤵', rarity: 'legendary' },
    { id: 'ninja', name: 'Shadow Gi', icon: '🥷', rarity: 'legendary' }
  ],
  neck: [
    { id: 'none', name: 'None', icon: '🚫' },
    { id: 'gold_chain', name: 'Gold Chain', icon: '⛓️', rarity: 'rare' },
    { id: 'silver_chain', name: 'Silver Chain', icon: '🔗', rarity: 'common' },
    { id: 'medal', name: 'Champion Medal', icon: '🏅', rarity: 'epic' },
    { id: 'scarf', name: 'Winter Scarf', icon: '🧣', rarity: 'common' },
    { id: 'diamond_pendant', name: 'Diamond Pendant', icon: '💎', rarity: 'legendary' }
  ],
  hands: [
    { id: 'none', name: 'None', icon: '🚫' },
    { id: 'gloves', name: 'Boxing Gloves', icon: '🥊', rarity: 'rare' },
    { id: 'wraps', name: 'Gym Hand Wraps', icon: '🩹', rarity: 'common' },
    { id: 'bracelets', name: 'Gold Bands', icon: '✨', rarity: 'epic' },
    { id: 'gauntlets', name: 'Fire Gauntlets', icon: '🔥', rarity: 'legendary' }
  ],
  poses: [
    { id: 'stand', name: 'Confident Stand', icon: '🧍' },
    { id: 'flex', name: 'Biceps Flex', icon: '💪' },
    { id: 'victory', name: 'Victory Fist Pump', icon: '🙋' },
    { id: 'double_flex', name: 'Double Flex', icon: '🏋️' },
    { id: 'boxing', name: 'Boxing Stance', icon: '🥊' },
    { id: 'dab', name: 'Dab Celebration', icon: '🕺' }
  ]
};

// Calculate level and XP progress
export function calcLevel(xp = 0) {
  let level = 1;
  let needed = 500;
  let remaining = xp;
  while (remaining >= needed) {
    remaining -= needed;
    level++;
    needed = Math.floor(500 * Math.pow(level, 1.25));
  }
  return {
    level,
    currentXP: remaining,
    nextXP: needed,
    progress: Math.min(100, Math.round((remaining / needed) * 100))
  };
}
