// Centralized Emoji Configuration
// Paste your Telegram Custom Emoji IDs into the customId fields below.
// How Telegram custom emojis work in messages: <tg-emoji emoji-id="123456789">🥊</tg-emoji>

export const EMOJIS = {
  // Combat & Action
  brawl: {
    name: 'Brawl Glove',
    fallback: '🥊',
    customId: '' // <- Paste custom emoji ID here
  },
  fire: {
    name: 'Fire / Hype',
    fallback: '🔥',
    customId: ''
  },
  swords: {
    name: 'Crossed Swords',
    fallback: '⚔️',
    customId: ''
  },
  play: {
    name: 'Play Controller',
    fallback: '🎮',
    customId: ''
  },
  zap: {
    name: 'Lightning Zap',
    fallback: '⚡',
    customId: ''
  },

  // Social & Groups
  group: {
    name: 'Group / Friends',
    fallback: '👥',
    customId: ''
  },
  plus: {
    name: 'Add / Plus',
    fallback: '➕',
    customId: ''
  },
  share: {
    name: 'Share / Speaker',
    fallback: '📢',
    customId: ''
  },

  // Ranks & Achievements
  crown: {
    name: 'Crown',
    fallback: '👑',
    customId: ''
  },
  trophy: {
    name: 'Trophy',
    fallback: '🏆',
    customId: ''
  },
  star: {
    name: 'Star',
    fallback: '⭐',
    customId: ''
  },
  skull: {
    name: 'KO Skull',
    fallback: '💀',
    customId: ''
  },

  // Arenas
  rooftop: {
    name: 'Rooftop City',
    fallback: '🏙️',
    customId: ''
  },
  ring: {
    name: 'Boxing Ring',
    fallback: '🥊',
    customId: ''
  },
  factory: {
    name: 'Factory Plant',
    fallback: '🏭',
    customId: ''
  },
  trucks: {
    name: 'Highway Truck',
    fallback: '🚚',
    customId: ''
  }
};

/**
 * Formats an emoji for Telegram messages or inline buttons.
 * @param {string} key - The emoji key from EMOJIS (e.g. 'brawl', 'fire', 'play')
 * @param {boolean} isButton - If true, returns string for button labels
 * @returns {string} Formatted string with custom emoji if available
 */
export function tgEmoji(key, isButton = false) {
  const item = EMOJIS[key];
  if (!item) return '';

  if (item.customId) {
    if (isButton) {
      // In inline keyboard buttons, Telegram displays the character
      return item.fallback;
    }
    // In HTML messages, Telegram renders custom emoji via <tg-emoji>
    return `<tg-emoji emoji-id="${item.customId}">${item.fallback}</tg-emoji>`;
  }

  return item.fallback;
}

/**
 * Returns plain fallback emoji string
 */
export function getEmoji(key) {
  return EMOJIS[key]?.fallback || '';
}
