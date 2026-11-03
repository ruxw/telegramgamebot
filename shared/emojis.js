// Centralized Emoji Configuration
// Paste your Telegram Custom Emoji IDs into the customId fields below.
// How Telegram custom emojis work in messages: <tg-emoji emoji-id="123456789">🥊</tg-emoji>

export const EMOJIS = {
  // Combat & Action
  brawl: {
    name: 'Brawl Glove',
    fallback: '🥊',
    customId: '5377674666661924559' // <- Paste custom emoji ID here
  },
  fire: {
    name: 'Fire / Hype',
    fallback: '🔥',
    customId: '5256047523620995497'
  },
  swords: {
    name: 'Crossed Swords',
    fallback: '⚔️',
    customId: '5408935401442267103'
  },
  play: {
    name: 'Play Controller',
    fallback: '🎮',
    customId: '5467583879948803288'
  },
  zap: {
    name: 'Lightning Zap',
    fallback: '⚡',
    customId: '5456140674028019486'
  },

  // Social & Groups
  group: {
    name: 'Group / Friends',
    fallback: '👥',
    customId: '5453957997418004470'
  },
  plus: {
    name: 'Add / Plus',
    fallback: '➕',
    customId: '5397916757333654639'
  },
  share: {
    name: 'Share / Speaker',
    fallback: '📢',
    customId: '5260450573768990626'
  },

  // Ranks & Achievements
  crown: {
    name: 'Crown',
    fallback: '👑',
    customId: '5217822164362739968'
  },
  trophy: {
    name: 'Trophy',
    fallback: '🏆',
    customId: '4949893772201689775'
  },
  star: {
    name: 'Star',
    fallback: '⭐',
    customId: '5226928895189598791'
  },
  skull: {
    name: 'KO Skull',
    fallback: '💀',
    customId: '5470010106974314312'
  },

  // Arenas
  rooftop: {
    name: 'Rooftop City',
    fallback: '🏙️',
    customId: '6334830307786622887'
  },
  ring: {
    name: 'Boxing Ring',
    fallback: '🥊',
    customId: '5231406626228948265'
  },
  factory: {
    name: 'Factory Plant',
    fallback: '🏭',
    customId: '5264746606216904351'
  },
  trucks: {
    name: 'Highway Truck',
    fallback: '🚚',
    customId: '5256030416766246766'
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
