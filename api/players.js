// GET /api/players?ids=AB12CD3,XY98ZW7 → { players: [{ id, name, profile, updatedAt }] }
// 查好友的公開資料（最多 50 個）；不存在的 ID 不會出現在結果裡
const { sql, ensureTable, cors, send, ID_RE } = require('./_lib');

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return send(res, 405, { error: 'method' });
  const ids = String(req.query.ids || '').toUpperCase().split(',').map(s => s.trim()).filter(s => ID_RE.test(s)).slice(0, 50);
  if (!ids.length) return send(res, 200, { players: [] });
  try {
    await ensureTable();
    const rows = await sql`SELECT id, name, profile, updated_at FROM players WHERE id = ANY(${ids})`;
    send(res, 200, { players: rows.map(r => ({ id: r.id, name: r.name, profile: r.profile, updatedAt: r.updated_at })) });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'server' });
  }
};
