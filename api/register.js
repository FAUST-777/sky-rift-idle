// POST /api/register { name } → { id, token }
// 建立冒險者：產生 7 碼遊戲 ID 和只給本人的 token（之後同步資料要帶 token）
const crypto = require('crypto');
const { sql, ensureTable, cors, send, body, cleanName, genId, hash } = require('./_lib');

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const name = cleanName(body(req).name);
  if (!name) return send(res, 400, { error: 'name' });
  try {
    await ensureTable();
    const token = crypto.randomBytes(24).toString('hex');
    for (let i = 0; i < 5; i++) {
      const id = genId();
      const rows = await sql`INSERT INTO players (id, name, token_hash) VALUES (${id}, ${name}, ${hash(token)})
                             ON CONFLICT (id) DO NOTHING RETURNING id`;
      if (rows.length) return send(res, 200, { id, token, name });
    }
    send(res, 500, { error: 'id' });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'server' });
  }
};
