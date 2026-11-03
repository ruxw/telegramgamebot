// Minimal Telegram bot (long polling, zero external dependencies). Sends Play buttons for groups & DMs.
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

  await api('deleteWebhook').catch(() => {});
  await api('setMyCommands', {
    commands: [
      { command: 'play', description: 'Start a Gang Beasts brawl in this group' },
      { command: 'fight', description: 'Join or host a Gang Beasts brawl' },
      { command: 'start', description: 'Open Gang Beasts Telegram Mini App' }
    ]
  }).catch(() => {});

  await api('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: '🥊 Play Gang Beasts',
      web_app: { url: publicUrl }
    }
  }).catch(() => {});

  console.log(`Telegram bot @${username} polling for Gang Beasts`);

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
        text: '🥊 <b>GANG BEASTS (Telegram Edition)</b>\n\nSilly gelatinous ragdoll fighters with physics-based combat!\nPunch, grab, lift, and throw your friends off rooftops, wrestling rings, and factory ledges!\n\n👥 <b>Play with friends in groups:</b>\n1. Add this bot to any Telegram group.\n2. Send <code>/play</code> in that group.\n3. Everyone taps <b>Join Brawl</b> to jump directly into the group match!',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 Play Gang Beasts Solo/PVP', web_app: { url: publicUrl } }],
            [{ text: '➕ Add to Group Chat', url: `https://t.me/${username}?startgroup=botstart` }]
          ]
        }
      });
    } else {
      const gid = groupParam(m.chat.id);
      await api('sendMessage', {
        chat_id: m.chat.id,
        parse_mode: 'HTML',
        text: `🥊 <b>GANG BEASTS BRAWL</b>\n\nA fight lobby is ready for <b>${escapeHtml(m.chat.title || 'this group')}</b>!\nTap below to jump into the arena. 2–6 beasts can enter!`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔥 Join Group Brawl', url: `https://t.me/${username}?startapp=${gid}` }]
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
