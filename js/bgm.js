// ════════════════════════════════════════════════════════════════════════════
// 背景音樂（第 170 輪）：全部用 Web Audio 即時合成的原創 8-bit 曲，不用任何音檔
//   → 版權屬於作者、商用不用標註；file:// 也能播。tools/bgm-preview.html 共用這支。
//   遊戲裡：船艙分頁→home、層主戰→boss、30 層以上→battle、其他→climb，換曲淡入淡出。
// ════════════════════════════════════════════════════════════════════════════
window.G = window.G || {};
(function () {
// ── 曲譜 ─────────────────────────────────────────────────────────────
// 每小節 8 格（8 分音符）。旋律：音名＋八度＝起音、「-」＝延長、「.」＝休止、「|」只是小節分隔方便閱讀。
// 和弦：每小節一個。bass／arp／drums 依和弦自動產生。
const SONGS = [
  { id: 'climb', name: '晴空爬塔', desc: '平常爬塔掛機用・明亮輕快・C 大調 108 BPM',
    bpm: 108, shift: -12, lead: 'pulse25', bass: 'walk', arp: 'up', drums: 'pop',
    chords: 'C G Am F C G Am F',
    melody: `E5 . G5 . C6 - B5 A5 | G5 - - . D5 . G5 . | A5 . C6 . E6 - D6 C6 | A5 - - - . . . . |
             E5 . G5 . C6 - D6 E6 | D6 - B5 . G5 . A5 B5 | C6 - A5 . E5 . G5 A5 | F5 . A5 . G5 - - .` },
  { id: 'battle', name: '裂洞激戰', desc: '戰鬥／高樓層・緊張推進・A 小調 150 BPM',
    bpm: 150, shift: -12, lead: 'square', bass: 'pump', arp: 'up16', drums: 'rock',
    chords: 'Am F G Em Am F G E',
    melody: `A5 . A5 C6 B5 . A5 . | C6 - - A5 F5 . A5 . | B5 . B5 D6 C6 . B5 . | G5 - - - E5 . . . |
             A5 . E6 . D6 C6 B5 A5 | C6 - A5 - F5 - A5 - | D6 . C6 . B5 . G5 . | G#5 - - - B5 - - -` },
  { id: 'boss', name: '層主降臨', desc: '層主戰・壓迫感・D 小調 168 BPM',
    bpm: 168, shift: -12, lead: 'saw', bass: 'pumpSaw', arp: 'up16', drums: 'heavy',
    chords: 'Dm Dm Bb C Dm Dm Bb A',
    melody: `D5 - - F5 - - A5 - | A5 - G5 F5 E5 - D5 - | F5 - - D5 - - Bb4 - | C5 - E5 - G5 - C6 - |
             D6 - - C6 - - A5 - | Bb5 A5 G5 F5 E5 - F5 - | D5 - F5 - Bb5 - A5 G5 | A5 - - - C#6 - - -` },
  { id: 'home', name: '船艙午後', desc: '家園／船艙・放鬆溫暖・F 大調 88 BPM',
    bpm: 88, shift: -12, lead: 'triangle', bass: 'long', arp: 'box', drums: 'soft',
    chords: 'F Dm Bb C F Am Bb C',
    melody: `A5 - C6 - A5 - F5 - | D5 - F5 A5 - - - . | Bb5 - A5 - G5 - F5 - | G5 - - - . . . . |
             A5 - C6 - F6 - E6 D6 | C6 - - A5 - - E5 - | D5 - F5 - Bb5 - A5 - | G5 - - - - - . .` },
];

// ── 音樂工具 ───────────────────────────────────────────────────────────
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = s => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(s); return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const chord = s => { const m = /^([A-G])(#|b)?(m?)$/.exec(s); const r = PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); return { r, iv: [0, m[3] ? 3 : 4, 7] }; };
const at = (c, oct, i) => 12 * (oct + 1) + c.r + (i >= 3 ? 12 + c.iv[i - 3] : c.iv[i]);

function compile(song) {
  const toks = song.melody.replace(/\|/g, ' ').trim().split(/\s+/);
  const chords = song.chords.split(/\s+/).map(chord);
  const steps = chords.length * 8;
  if (toks.length !== steps) console.warn(song.id, 'melody 長度', toks.length, '≠', steps);
  const notes = []; // {step, len(格), midi, voice}
  toks.forEach((t, i) => {
    if (t === '.' || t === '-') return;
    let len = 1; while (toks[(i + len) % steps] === '-' && len < steps) len++;
    notes.push({ step: i, len, midi: midi(t) + song.shift, voice: 'lead' });
  });
  chords.forEach((c, b) => {
    const s0 = b * 8;
    const B = (st, len, oct, i) => notes.push({ step: s0 + st, len, midi: at(c, oct, i), voice: 'bass' });
    if (song.bass === 'walk') { B(0, 2, 2, 0); B(2, 2, 2, 2); B(4, 2, 3, 0); B(6, 2, 2, 2); }
    if (song.bass === 'pump' || song.bass === 'pumpSaw') for (let k = 0; k < 8; k++) B(k, 1, k % 2 ? 2 : 1, 0);
    if (song.bass === 'long') { B(0, 4, 2, 0); B(4, 4, 2, 2); }
    const A = (st, len, oct, i, sub = 0) => notes.push({ step: s0 + st + sub, len, midi: at(c, oct, i), voice: 'arp' });
    if (song.arp === 'up') [0, 1, 2, 1, 0, 1, 2, 3].forEach((i, k) => A(k, 1, 4, i));
    if (song.arp === 'up16') for (let k = 0; k < 16; k++) A(k / 2, 0.5, 4, [0, 1, 2, 3][k % 4]);
    if (song.arp === 'box') [0, 2, 3, 2, 1, 2, 3, 4].forEach((i, k) => A(k, 2, 5, i));
  });
  return { steps, notes };
}

const DRUMS = { // 每小節 8 格：k=大鼓 s=小鼓 h=鈸
  pop:   { k: 'x...x...', s: '..x...x.', h: 'xxxxxxxx' },
  rock:  { k: 'x..xx...', s: '..x...x.', h: 'xxxxxxxx' },
  heavy: { k: 'x.x.x.xx', s: '..x...x.', h: 'xxxxxxxx' },
  soft:  { k: 'x.......', s: '........', h: '..x...x.' },
};

// ── 合成 ───────────────────────────────────────────────────────────────
const noiseCache = new WeakMap();
function noise(ctx) {
  if (noiseCache.has(ctx)) return noiseCache.get(ctx);
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, b); return b;
}
function pulse(ctx, duty) {
  const n = 32, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(re, im);
}
const INST = {
  pulse25:  { wave: 'pulse25', gain: 0.16, a: 0.005, rel: 0.06, vib: true },
  square:   { wave: 'square', gain: 0.11, a: 0.005, rel: 0.05, vib: true },
  saw:      { wave: 'sawtooth', gain: 0.14, a: 0.005, rel: 0.05, vib: true },
  triangle: { wave: 'triangle', gain: 0.32, a: 0.02, rel: 0.15, vib: true },
  bass:     { wave: 'triangle', gain: 0.38, a: 0.005, rel: 0.04 },
  bassSaw:  { wave: 'sawtooth', gain: 0.12, a: 0.003, rel: 0.03 },
  arp:      { wave: 'pulse12', gain: 0.045, a: 0.003, rel: 0.03 },
  box:      { wave: 'sine', gain: 0.08, a: 0.003, rel: 0.4, decay: true },
};
function tone(ctx, out, t, dur, f, ins) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  if (ins.wave === 'pulse25') o.setPeriodicWave(pulse(ctx, 0.25));
  else if (ins.wave === 'pulse12') o.setPeriodicWave(pulse(ctx, 0.125));
  else o.type = ins.wave;
  o.frequency.value = f;
  if (ins.vib && dur > 0.3) {
    const l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.007, t + 0.25);
    l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + ins.rel);
  }
  const end = t + Math.max(dur - 0.01, ins.a + 0.01);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(ins.gain, t + ins.a);
  if (ins.decay) g.gain.exponentialRampToValueAtTime(ins.gain * 0.05, end + ins.rel);
  else { g.gain.setValueAtTime(ins.gain * 0.85, end); g.gain.linearRampToValueAtTime(0, end + ins.rel); }
  o.connect(g); g.connect(out); o.start(t); o.stop(end + ins.rel + 0.02);
}
function drum(ctx, out, t, kind, soft) {
  const v = soft ? 0.5 : 1;
  if (kind === 'k') {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.7 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2);
    return;
  }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise(ctx); f.type = 'highpass';
  f.frequency.value = kind === 's' ? 1200 : 7000;
  const len = kind === 's' ? 0.14 : 0.035, gain = (kind === 's' ? 0.32 : 0.09) * v;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
}
// 建立輸出：dry ＋ 旋律回音
function bus(ctx, dest, song) {
  const master = ctx.createGain(), comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10; comp.ratio.value = 4; master.connect(comp); comp.connect(dest);
  const stepDur = 60 / song.bpm / 2;
  const dl = ctx.createDelay(2), fb = ctx.createGain(), wet = ctx.createGain();
  dl.delayTime.value = stepDur * 3; fb.gain.value = 0.28; wet.gain.value = 0.22;
  dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(master);
  const lead = ctx.createGain(); lead.connect(master); lead.connect(dl);
  return { master, lead, stepDur };
}
function scheduleStep(ctx, b, song, comp, step, t) {
  const sd = b.stepDur;
  for (const n of comp.byStep[step] || []) {
    const st = t + (n.step - Math.floor(n.step)) * sd;
    if (n.voice === 'lead') tone(ctx, b.lead, st, n.len * sd, hz(n.midi), INST[song.lead]);
    else if (n.voice === 'bass') tone(ctx, b.master, st, n.len * sd * 0.9, hz(n.midi), song.bass === 'pumpSaw' ? INST.bassSaw : INST.bass);
    else tone(ctx, b.master, st, n.len * sd * 0.8, hz(n.midi), song.arp === 'box' ? INST.box : INST.arp);
  }
  const d = DRUMS[song.drums], k = step % 8;
  for (const kind of ['k', 's', 'h']) if (d[kind][k] === 'x') drum(ctx, b.master, t, kind, song.drums === 'soft');
}
function prepare(song) {
  const comp = compile(song); comp.byStep = {};
  for (const n of comp.notes) (comp.byStep[Math.floor(n.step)] ||= []).push(n);
  return comp;
}

// 輸出 WAV（兩輪循環＋回音尾巴）
async function render(song, loops = 2) {
  const comp = prepare(song), sr = 44100, sd = 60 / song.bpm / 2;
  const len = sd * comp.steps * loops + 1.5;
  const oc = new OfflineAudioContext(1, Math.ceil(len * sr), sr);
  const b = bus(oc, oc.destination, song); b.master.gain.value = 0.75;
  for (let i = 0; i < comp.steps * loops; i++) scheduleStep(oc, b, song, comp, i % comp.steps, 0.02 + i * sd);
  return oc.startRendering();
}
function wav(buf) {
  const d = buf.getChannelData(0), n = d.length, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
  return new Blob([ab], { type: 'audio/wav' });
}

// ── 遊戲內播放器 ───────────────────────────────────────────────────────
const P = { ctx: null, out: null, cur: null };
function wantVol() {
  const st = G.settings || {};
  return st.bgmOn === false ? 0 : Math.pow((st.bgmVol == null ? 50 : st.bgmVol) / 100, 1.5) * 0.8;
}
function stopCur() {
  const c = P.cur; if (!c) return; P.cur = null;
  clearInterval(c.timer);
  c.b.master.gain.cancelScheduledValues(P.ctx.currentTime);
  c.b.master.gain.setTargetAtTime(0, P.ctx.currentTime, 0.35);
  setTimeout(() => c.b.master.disconnect(), 2000);
}
function start(id) {
  const song = SONGS.find(s => s.id === id); if (!song) return;
  stopCur();
  const ctx = P.ctx, comp = prepare(song), b = bus(ctx, P.out, song);
  b.master.gain.setValueAtTime(0, ctx.currentTime);
  b.master.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
  const c = P.cur = { id, b, step: 0, next: ctx.currentTime + 0.1 };
  c.timer = setInterval(() => {
    if (ctx.state !== 'running') return;
    if (c.next < ctx.currentTime) c.next = ctx.currentTime + 0.05;   // 卡頓／背景回來時別一次補一堆音
    while (c.next < ctx.currentTime + 0.2) {
      scheduleStep(ctx, b, song, comp, c.step % comp.steps, c.next);
      c.step++; c.next += b.stepDur;
    }
  }, 40);
}
// 目前畫面該放哪首
function pick() {
  const UI = G.UI || {}, S = G.S || {};
  if (UI.tab === 'home') return 'home';
  const sc = G.battleScene && G.battleScene();
  if (sc && sc.enemiesAlive && sc.enemiesAlive().some(e => e.boss)) return 'boss';
  return (S.floor || 1) >= 30 ? 'battle' : 'climb';
}
function update() {
  if (!P.ctx) return;
  if (P.out) P.out.gain.setTargetAtTime(wantVol(), P.ctx.currentTime, 0.08);
  if (wantVol() === 0 || document.hidden) { if (P.ctx.state === 'running') P.ctx.suspend(); return; }
  if (P.ctx.state !== 'running') P.ctx.resume();
  const id = pick();
  if (!P.cur || P.cur.id !== id) start(id);
}
// 瀏覽器規定：要玩家先點一下／按一下才能出聲
function unlock() {
  if (P.ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  P.ctx = new AC(); P.out = P.ctx.createGain(); P.out.gain.value = wantVol(); P.out.connect(P.ctx.destination);
  update();
}
G.BGM = { SONGS, compile, prepare, bus, scheduleStep, render, wav, update, current: () => P.cur && P.cur.id, ctx: () => P.ctx };
G.BGM.init = function () {
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, unlock, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', update);
  setInterval(update, 500);
};
})();
