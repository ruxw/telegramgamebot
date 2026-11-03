import crypto from 'crypto';

// Validates Telegram Mini App initData (HMAC-SHA256 per Telegram docs). Returns {id,name,startParam} or null.
export function validateInitData(initData, botToken, maxAgeSec = 86400) {
  if (typeof initData !== 'string' || !initData || initData.length > 4096 || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete('hash');
  const dcs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calc = crypto.createHmac('sha256', secret).update(dcs).digest();
  if (!crypto.timingSafeEqual(calc, Buffer.from(hash, 'hex'))) return null;
  const age = Math.floor(Date.now() / 1000) - Number(params.get('auth_date'));
  if (!Number.isFinite(age) || age > maxAgeSec || age < -300) return null;
  try {
    const u = JSON.parse(params.get('user'));
    if (!u || !Number.isInteger(u.id)) return null;
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Player';
    return { id: u.id, name, startParam: params.get('start_param') || '' };
  } catch { return null; }
}
