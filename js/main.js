// ════════════════════════════════════════════════════════════════════════════
// 啟動：讀檔 → 離線收益 → 戰鬥場景 → 介面 → 自動存檔
// ════════════════════════════════════════════════════════════════════════════
(function () {
  G.load();
  const offline = G.offlineGains();

  G.startBattle();
  G.UI.init();

  function showOffline(g) {
    if (!g) return;
    const h = Math.floor(g.mins / 60), m = g.mins % 60;
    G.UI.modal(`<h2>歡迎回來！</h2>
      <p>你離開了 ${h ? h + ' 小時 ' : ''}${m} 分鐘，飛行船上的夥伴們持續在第 ${G.S.floor} 層探索。</p>
      <div class="stats" style="grid-template-columns:1fr">
        <div>金幣 <b class="gold">+${G.fmt(g.gold)}</b></div>
        <div>經驗 <b>+${G.fmt(g.xp)}</b></div>
        ${g.bonus ? `<div>家園舒適度加成 <b>+${g.bonus}%</b></div>` : ''}
      </div>
      <p class="muted" style="font-size:12px">離線收益最多累積 ${G.CONFIG.offlineCapHours} 小時。布置家園可以提高收益。</p>
      <div class="modal-actions"><button class="btn primary" data-act="close">收下</button></div>`);
  }

  if (!G.S.seenPrologue) {
    G.UI.prologue(() => {
      G.S.seenPrologue = true;
      G.addLog('🎈 你搭著熱氣球飛進了天空裂洞……', '#7fd1ff');
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
