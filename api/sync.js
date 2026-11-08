// POST /api/sync { id, token, profile } → { ok }
// 上傳自己的公開資料（名稱、等級、層數、飛空艇外觀、主角外觀與戰鬥資料）給好友看、給好友雇用
const { sql, ensureTable, cors, send, body, ID_RE, hash } = require('./_lib');

const MAX_BYTES = 12000;

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const b = body(req);
  if (!ID_RE.test(b.id || '') || typeof b.token !== 'string' || !b.profile || typeof b.profile !== 'object') return send(res, 400, { error: 'bad' });
  const json = JSON.stringify(b.profile);
  if (json.length > MAX_BYTES) return send(res, 413, { error: 'size' });
  try {
    await ensureTable();
    const rows = await sql`UPDATE players SET profile = ${json}::jsonb, updated_at = now()
                           WHERE id = ${b.id} AND token_hash = ${hash(b.token)} RETURNING id`;
    if (!rows.length) return send(res, 403, { error: 'auth' });
    send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'server' });
  }
};
