// ════════════════════════════════════════════════════════════════════════════
// 好友系統後端共用工具（Vercel Serverless + Neon Postgres）
// 檔名開頭底線 = 不會變成 API 路徑
// ════════════════════════════════════════════════════════════════════════════
const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

// 第一次呼叫時建表（之後就跳過）
let ready = null;
function ensureTable() {
  if (!ready) {
    ready = sql`CREATE TABLE IF NOT EXISTS players (
      id          text PRIMARY KEY,
      name        text NOT NULL,
      token_hash  text NOT NULL,
      profile     jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    )`.catch(e => { ready = null; throw e; });
  }
  return ready;
}

// 遊戲從 file://（雙擊 index.html）打開時也要能連 → 允許所有來源；寫入靠 token 驗證
function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

function send(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(body));
}

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

// 名稱寬度：中日韓全形字算 2，其他算 1；上限 20（= 10 個中文字 ≈ 20 個英文字）
const NAME_MAX = 20;
// 用字碼範圍判斷（不在原始碼裡放特殊字元，避免換行字元把正規表示式弄壞）
const WIDE = [[0x1100, 0x115f], [0x2e80, 0xa4cf], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff00, 0xff60], [0xffe0, 0xffe6], [0x20000, 0x3fffd]];
const BAD = [[0x0, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff], [0x3c, 0x3c], [0x3e, 0x3e]];   // 控制字元、零寬字元、< >
const inRanges = (cp, ranges) => ranges.some(([a, b]) => cp >= a && cp <= b);
function nameWidth(s) {
  let w = 0;
  for (const ch of s) w += inRanges(ch.codePointAt(0), WIDE) ? 2 : 1;
  return w;
}
function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const s = Array.from(raw.normalize('NFC')).filter(ch => !inRanges(ch.codePointAt(0), BAD)).join('').trim().replace(/\s+/g, ' ');
  if (!s || nameWidth(s) > NAME_MAX) return null;
  return s;
}

// 遊戲 ID：7 碼英文＋數字（拿掉容易看錯的 0 O 1 I L），一定同時有英文和數字
const ID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genId() {
  for (;;) {
    const b = crypto.randomBytes(7);
    const id = Array.from(b, x => ID_CHARS[x % ID_CHARS.length]).join('');
    if (/[A-Z]/.test(id) && /[0-9]/.test(id)) return id;
  }
}
const ID_RE = /^[A-Z0-9]{7}$/;
const hash = s => crypto.createHash('sha256').update(s).digest('hex');

module.exports = { sql, ensureTable, cors, send, body, cleanName, nameWidth, genId, ID_RE, hash, NAME_MAX };
