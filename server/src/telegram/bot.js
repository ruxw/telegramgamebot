// Minimal Telegram bot with Bot API 9.4 colored buttons, custom emoji icons & group broadcasts
import { tgEmoji } from '../../../shared/emojis.js';
import { GroupBroadcastService } from './broadcast.js';

let globalBroadcastService = null;
export function getBroadcastService() {
  return globalBroadcastService;
}

export async function startBot({ token, publicUrl, onUsername }) {
  const api = async (method, body) => {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(65000)
    });
    const j = await res.json();
    if (!j.ok) throw new Error(`${method}: ${j.description}`);
    return j.result;
  };

  const me = await api('getMe');
  const username = me.username;
  onUsername?.(username);

  globalBroadcastService = new GroupBroadcastService(api, publicUrl, username);

  await api('deleteWebhook').catch(() => {});
  await api('setMyCommands', {
    commands: [
      { command: 'play', description: 'Start brawl in this group' },
      { command: 'fight', description: 'Join group brawl' },
      { command: 'start', description: 'Open Gang Beasts' }
    ]
  }).catch(() => {});

  await api('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: `${tgEmoji('brawl', true)} Play`,
      web_app: { url: publicUrl }
    }
  }).catch(() => {});

  console.log(`Telegram bot @${username} polling for Gang Beasts (Bot API 9.4 enabled)`);

  const groupParam = id => 'g_' + String(id).replace(/-/g, 'n');

  async function onMessage(m) {
    const text = (m.text || '').trim();
    const cmd = text.split(/\s|@/)[0].toLowerCase();
    if (cmd !== '/start' && cmd !== '/play' && cmd !== '/fight') return;
    if (text.includes('@') && !text.toLowerCase().includes('@' + username.toLowerCase())) return;

    if (m.chat.type === 'private') {
      await api('sendMessage', {
        chat_id: m.chat.id,
        parse_mode: 'HTML',
        text: `${tgEmoji('brawl')} <b>GANG BEASTS</b>\nMultiplayer ragdoll brawler with 10 game modes, AI champions & custom avatars.\n\nAdd to a group &amp; send <code>/play</code> to fight friends.`,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Play Solo / PvP',
                web_app: { url: publicUrl },
                style: 'primary',
                icon_custom_emoji_id: '5467583879948803288'
              }
            ],
            [
              {
                text: 'Add to Group',
                url: `https://t.me/${username}?startgroup=botstart`,
                style: 'success',
                icon_custom_emoji_id: '5397916757333654639'
              }
            ]
          ]
        }
      });
    } else {
      const gid = groupParam(m.chat.id);
      await api('sendMessage', {
        chat_id: m.chat.id,
        parse_mode: 'HTML',
        text: `${tgEmoji('brawl')} <b>GANG BEASTS</b>\nLobby ready for <b>${escapeHtml(m.chat.title || 'Group')}</b>.`,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Join Brawl',
                url: `https://t.me/${username}?startapp=${gid}`,
                style: 'primary',
                icon_custom_emoji_id: '5256047523620995497'
              },
              {
                text: 'Watch Live',
                url: `https://t.me/${username}?startapp=watch_live_${gid}`,
                style: 'success'
              }
            ]
          ]
        }
      });
    }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  let offset = 0;
  (async function poll() {
    for (;;) {
      try {
        const ups = await api('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] });
        for (const u of ups) {
          offset = u.update_id + 1;
          if (u.message) onMessage(u.message).catch(e => console.error('bot', e.message));
        }
      } catch (e) {
        console.error('poll', e.message);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  })();
}
