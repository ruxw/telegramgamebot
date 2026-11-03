import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.resolve(__dirname, '../../../data/gang_beasts_db.json');

// Ensure directory exists
try {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
} catch {}

class Database {
  constructor() {
    this.data = {
      players: {},       // key -> player profile
      groups: {},        // group_id -> group history, settings, stats
      leaderboards: {},  // mode -> top entries
      matches: []        // recent match logs
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('DB load warning:', e.message);
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('DB save error:', e.message);
    }
  }

  getPlayer(key, defaultData = {}) {
    if (!this.data.players[key]) {
      this.data.players[key] = {
        key,
        name: defaultData.name || 'Beast',
        username: defaultData.username || '',
        pfpUrl: defaultData.pfpUrl || '',
        isPremium: !!defaultData.isPremium,
        title: defaultData.title || 'Street Brawler',
        xp: defaultData.xp || 2450,
        trophies: defaultData.trophies || 185,
        gamesPlayed: defaultData.gamesPlayed || 128,
        wins: defaultData.wins || 74,
        kos: defaultData.kos || 96,
        equipped: {
          skin: '#8a4fff',
          headwear: 'crown',
          face: 'cool',
          outfit: 'none',
          neck: 'none',
          hands: 'none',
          pose: 'flex',
          collectibles: ['frost_crown', 'diamond_shard', 'golden_star']
        },
        inventory: ['crown', 'shades', 'cap', 'beanie', 'gloves', 'gold_chain', 'frost_crown', 'diamond_shard', 'golden_star'],
        created: Date.now()
      };
      this.save();
    }
    return this.data.players[key];
  }

  updatePlayer(key, patch) {
    const p = this.getPlayer(key);
    Object.assign(p, patch);
    if (patch.equipped) {
      p.equipped = { ...p.equipped, ...patch.equipped };
    }
    this.save();
    return p;
  }

  recordMatchResult(match) {
    this.data.matches.unshift(match);
    if (this.data.matches.length > 100) this.data.matches.pop();

    // Update group-specific records if originating from a group
    if (match.groupId) {
      const g = this.getGroup(match.groupId);
      g.matches.unshift(match);
      if (g.matches.length > 50) g.matches.pop();
      if (match.winnerKey) {
        g.stats.wins[match.winnerKey] = (g.stats.wins[match.winnerKey] || 0) + 1;
      }
    }

    // Update mode leaderboard
    const mode = match.mode || 'classic';
    if (!this.data.leaderboards[mode]) this.data.leaderboards[mode] = [];
    if (match.winnerKey) {
      const existing = this.data.leaderboards[mode].find(e => e.key === match.winnerKey);
      if (existing) {
        existing.wins = (existing.wins || 0) + 1;
        existing.score = (existing.score || 0) + (match.winnerScore || 100);
      } else {
        this.data.leaderboards[mode].push({
          key: match.winnerKey,
          name: match.winnerName,
          wins: 1,
          score: match.winnerScore || 100
        });
      }
      this.data.leaderboards[mode].sort((a, b) => b.score - a.score);
      this.data.leaderboards[mode] = this.data.leaderboards[mode].slice(0, 50);
    }

    this.save();
  }

  getGroup(groupId, title = '') {
    if (!this.data.groups[groupId]) {
      this.data.groups[groupId] = {
        id: groupId,
        title: title || 'Brawl Group',
        broadcastsEnabled: true,
        matches: [],
        stats: { wins: {}, kos: {} }
      };
      this.save();
    }
    return this.data.groups[groupId];
  }

  getModeLeaderboard(mode = 'classic') {
    return this.data.leaderboards[mode] || [];
  }
}

export const db = new Database();
