// Group Match Broadcast & Live Spectator Service
// Posts live updates, knockouts, winners, and spectator deep-links into Telegram Groups.
import { tgEmoji } from '../../../shared/emojis.js';
import { db } from '../db.js';

export class GroupBroadcastService {
  constructor(apiClient, publicUrl, botUsername) {
    this.api = apiClient;
    this.publicUrl = publicUrl;
    this.botUsername = botUsername;
    this.activeMatches = new Map(); // roomCode -> match metadata
    this.lastAnnouncementTime = new Map(); // chatId -> timestamp
  }

  getSpectatorLink(roomCode) {
    return `https://t.me/${this.botUsername}?startapp=watch_${roomCode}`;
  }

  async onMatchStart(room) {
    if (!room.groupId || !this.api) return;
    const chatId = room.groupId;

    const playerList = [...room.players.values()]
      .map(p => `• ${p.isAI ? '🤖' : '🟣'} <b>${escapeHtml(p.name)}</b> (Lv.${p.level || 1})`)
      .join('\n');

    const msg = `🥊 <b>GANG BEASTS — MATCH STARTED!</b>\n\n` +
      `⚔️ <b>Mode:</b> ${room.modeName || 'Classic Brawl'}\n` +
      `🏟 <b>Arena:</b> ${room.map?.name || 'Rooftop'}\n\n` +
      `<b>Fighters:</b>\n${playerList}\n\n` +
      `<i>💥 The brawl is live! Tap below to watch live or join the next queue.</i>`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '👁 Watch Live', url: this.getSpectatorLink(room.code), style: 'primary', icon_custom_emoji_id: '5467583879948803288' },
          { text: '📊 Match Stats', url: `https://t.me/${this.botUsername}?startapp=stats_${room.code}`, style: 'success' }
        ]
      ]
    };

    try {
      const res = await this.api('sendMessage', {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: msg,
        reply_markup: keyboard
      });
      this.activeMatches.set(room.code, {
        chatId,
        messageId: res?.message_id,
        startTime: Date.now(),
        kos: []
      });
    } catch (e) {
      console.warn('Group match start broadcast failed:', e.message);
    }
  }

  async onKnockout(room, victimName, killerName) {
    if (!room.groupId || !this.api) return;
    const match = this.activeMatches.get(room.code);
    if (!match) return;

    // Rate limit intermediate event broadcasts to avoid spamming the group
    const now = Date.now();
    const last = this.lastAnnouncementTime.get(match.chatId) || 0;
    if (now - last < 5000) return;
    this.lastAnnouncementTime.set(match.chatId, now);

    const txt = killerName
      ? `💥 <b>KNOCKOUT!</b>\n🥊 <b>${escapeHtml(killerName)}</b> yeeted <b>${escapeHtml(victimName)}</b> out of the arena!`
      : `💀 <b>ELIMINATED!</b>\n<b>${escapeHtml(victimName)}</b> plummeted into the abyss!`;

    try {
      await this.api('sendMessage', {
        chat_id: match.chatId,
        parse_mode: 'HTML',
        text: txt,
        reply_markup: {
          inline_keyboard: [
            [{ text: '👁 Watch Live', url: this.getSpectatorLink(room.code), style: 'primary' }]
          ]
        }
      });
    } catch {}
  }

  async onMatchFinish(room, winner) {
    if (!room.groupId || !this.api) return;
    const match = this.activeMatches.get(room.code);
    const chatId = room.groupId;

    const winnerName = winner ? winner.name : 'Nobody (Draw)';
    const durationSec = Math.round((Date.now() - (match?.startTime || Date.now())) / 1000);

    const msg = `🏆 <b>MATCH FINISHED!</b>\n\n` +
      `⚔️ <b>Mode:</b> ${room.modeName || 'Classic Brawl'}\n` +
      `🥇 <b>Winner:</b> <b>${escapeHtml(winnerName)}</b>\n` +
      `⏱ <b>Duration:</b> ${Math.floor(durationSec / 60)}m ${durationSec % 60}s\n\n` +
      `🔥 Who will step up to challenge the champion?`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '⚔️ Rematch', url: `https://t.me/${this.botUsername}?startapp=g_${String(chatId).replace(/-/g, 'n')}`, style: 'success', icon_custom_emoji_id: '5256047523620995497' },
          { text: '🏆 Group Rankings', url: `https://t.me/${this.botUsername}?startapp=ranks_${String(chatId).replace(/-/g, 'n')}`, style: 'primary' }
        ]
      ]
    };

    try {
      await this.api('sendMessage', {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: msg,
        reply_markup: keyboard
      });
    } catch (e) {
      console.warn('Match finish announcement failed:', e.message);
    }

    this.activeMatches.delete(room.code);
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
