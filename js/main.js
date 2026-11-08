// ════════════════════════════════════════════════════════════════════════════
// 啟動：讀檔 → 離線收益 → 戰鬥場景 → 介面 → 自動存檔
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const t = (k, p) => G.t(k, p);
  G.load();
  const offline = G.offlineGains();

  G.startBattle();
  G.UI.init();

  function showOffline(g) {
    if (!g) return;
    const h = Math.floor(g.mins / 60), m = g.mins % 60;
    const time = h ? t('time.hm', { h, m }) : t('time.m', { m });
    G.UI.modal(`<h2>${t('offline.title')}</h2>
      <p>${t('offline.away', { time, floor: G.S.floor })}</p>
      <div class="stats" style="grid-template-columns:1fr">
        <div>${t('offline.gold')} <b class="gold">+${G.fmt(g.gold)}</b></div>
        <div>${t('offline.xp')} <b>+${G.fmt(g.xp)}</b></div>
        ${g.bonus ? `<div>${t('offline.bonus')} <b>+${g.bonus}%</b></div>` : ''}
      </div>
      <p class="muted" style="font-size:12px">${t('offline.cap', { h: G.CONFIG.offlineCapHours })}</p>
      <div class="modal-actions"><button class="btn primary" data-act="close">${t('offline.ok')}</button></div>`);
  }

  if (!G.S.seenPrologue) {
    G.UI.prologue(() => {
      G.S.seenPrologue = true;
      G.addLog('log.start', null, '#7fd1ff');
      G.save();
    });
  } else {
    showOffline(offline);
  }

  // 每 10 秒自動存檔（分頁在背景時不存，才不會蓋掉離開時間）
  setInterval(() => { if (!document.hidden) G.save(); }, 10000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) G.save();
    else {
      const g = G.offlineGains();
      if (g) showOffline(g);
      G.S.lastSeen = Date.now();
    }
  });
  window.addEventListener('pagehide', () => G.save());
})();
