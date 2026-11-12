/* 工位 — 界面控制（dashboard 版） */
(function () {
  const G = window;
  const GW = G.GW, E = GW.Engine, D = GW.DATA, Sim = GW.Sim;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
  const KEY = 'gongwei.save.v1';

  let S = null;
  let running = false;
  let speed = 1;
  let timer = null;
  let focusSel = 'learn';
  let autoDecide = false;
  let busy = false;
  let resumeAfter = false;

  // ------------------------------------------------------------------ utils
  function fmtWan(n) {
    if (!n) return '0';
    if (Math.abs(n) >= 10000) return (n / 10000).toFixed(Math.abs(n) >= 1000000 ? 0 : 1) + '万';
    return Math.round(n).toLocaleString('zh-CN');
  }
  function fmtMoney(n) {
    return (n < 0 ? '-¥' : '¥') + fmtWan(Math.abs(n));
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function show(id) {
    $$('.screen').forEach(function (el) { el.classList.toggle('active', el.id === id); });
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ 抽签
  function newGame() {
    const seed = ((Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0);
    S = E.createLife(seed);
    renderDraw();
    show('s-draw');
  }

  function renderDraw() {
    const d = S.draw, id = S.identity;
    const list = $('#draw-list');
    list.innerHTML = '';
    const rows = [
      ['姓名', id.name + ' · ' + id.gender, id.birth + '出生'],
      ['出生地', d.tier.name + ' · ' + d.cityName, '生活成本 ×' + d.tier.cost.toFixed(2)],
      ['家庭', d.family.name, d.family.note],
      ['高考分数', d.score.name, '决定了你能填什么，填不了什么'],
      ['专业', '还没填', '18 岁那年决定'],
      ['行业', d.industry.name, d.industry.note],
      ['岗位', d.role.name, d.role.note],
      ['体质 / 性格', d.trait.name, d.trait.note],
      ['起点存款', '¥' + fmtWan(d.family.cash0), '家里能拿出来的全部'],
    ];
    rows.forEach(function (r, i) {
      const el = document.createElement('div');
      el.className = 'draw-row';
      el.style.animationDelay = (i * 120) + 'ms';
      el.innerHTML = '<span class="k">' + r[0] + '</span><span class="v">' + r[1] +
        (r[2] ? '<small>' + r[2] + '</small>' : '') + '</span>';
      list.appendChild(el);
    });
    const btn = $('#btn-begin');
    btn.disabled = true;
    setTimeout(function () { btn.disabled = false; $('#draw-hint').textContent = '这一生只能走一次，没有存档点。'; }, 1100);
  }

  // ------------------------------------------------------------------ 开局
  function beginLife() {
    if (!S.peers) S.peers = Sim.buildPeers(S.seed, 5);
    focusSel = S.draw.edu === '本科' && S.age < 22 ? 'learn' : 'career';
    show('s-play');
    renderAll();
    bindChips();
    save();
    tick();
  }

  // ------------------------------------------------------------------ 推进
  function tick() {
    if (busy || !S || S.over) return;
    if (S.age >= D.meta.retireAge) return finish();
    const n = Sim.nextNode(S);
    if (n) { pause(); openNode(n.node, filterOptions(n.options)); return; }
    if (S.age < 22) { fastForward(); renderAll(); save(); return tick(); }
  }

  function fastForward() {
    const ages = D.nodes.map(function (n) { return n.age; }).filter(function (a) { return a > S.age; });
    let target = Math.min(22, ages.length ? Math.min.apply(null, ages) : 22);
    if (target <= S.age) target = Math.min(22, S.age + 1);
    const from = S.age;
    S.age = target;
    S.log.push({ age: target, kind: 'flavor', text: from <= 18 ? '一年过去了。大一：军训、宿舍、食堂，还有四六级报名。' :
      (from === 19 ? '大学四年过去了。你记不清学会了什么，但记得住每个室友的呼噜声。' : '几年过去了。') });
    renderTopbar();
  }

  function stepOnce() {
    if (busy || !S || S.over) return;
    if (S.age >= D.meta.retireAge) return finish();
    const n = Sim.nextNode(S);
    if (n) { pause(); openNode(n.node, filterOptions(n.options)); return; }
    if (S.age < 22) { fastForward(); renderAll(); save(); return; }
    applyYear(focusSel);
  }

  function applyYear(focusId) {
    const out = E.stepYear(S, focusId);
    const age = (out.lines && out.lines[0] && out.lines[0].age) || S.age - 1;
    (out.lines || []).forEach(function (l) { S.log.push({ age: age, kind: l.kind, text: l.text }); });
    const last = S.history[S.history.length - 1];
    if (last) {
      const flow = last.monthNet >= 0 ? '净存 ' + fmtMoney(last.monthNet) : '缺口 ' + fmtMoney(-last.monthNet);
      let extra = '';
      if (S.flags.house && S.mortgageMonthly) extra += ' · 月供 ' + fmtMoney(S.mortgageMonthly);
      if (S.flags.kids) extra += ' · 孩子 ' + S.flags.kids;
      S.log.push({
        age: age, kind: 'summary',
        text: '月薪 ' + fmtMoney(last.salary) + ' · 存款 ' + fmtMoney(last.cash) + extra + ' · ' + flow,
      });
    }
    renderAll();
    save();
    if (out.event) { pause(); openEvent(out.event, afterStep); return; }
    afterStep();
  }

  function afterStep() {
    busy = false;
    renderAll();
    if (S.over) return finish();
    if (S.age >= D.meta.retireAge) return finish();
    const n = Sim.nextNode(S);
    if (n) { pause(); openNode(n.node, filterOptions(n.options)); }
  }

  // ------------------------------------------------------------------ 计时器
  function intervalMs() { return Math.round(7000 / speed); }
  function startTimer() {
    stopTimer();
    timer = setInterval(function () {
      if (!running || busy) return;
      stepOnce();
    }, intervalMs());
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function play() {
    if (!S || S.over) return;
    running = true;
    $('#play-ico').textContent = '❚❚';
    $('#play-txt').textContent = '暂停';
    $('#btn-play').classList.add('running');
    startTimer();
    if (!busy) stepOnce();
  }
  function pause() {
    running = false;
    stopTimer();
    $('#play-ico').textContent = '▶';
    $('#play-txt').textContent = '继续';
    $('#btn-play').classList.remove('running');
  }

  // ------------------------------------------------------------------ 快进
  function skipToNode() {
    pause();
    let guard = 0;
    while (!busy && !S.over && guard++ < 60) {
      if (Sim.nextNode(S)) break;
      if (S.age >= D.meta.retireAge) break;
      if (S.age < 22) { fastForward(); continue; }
      const out = E.stepYear(S, Sim.autoFocus(S, Math.random));
      const age = (out.lines && out.lines[0] && out.lines[0].age) || S.age - 1;
      (out.lines || []).forEach(function (l) { S.log.push({ age: age, kind: l.kind, text: l.text }); });
      if (out.event) { E.applyEvent(S, out.event, 0); S.log.push({ age: age, kind: 'event', text: '（自动抉择：' + out.event.options[0].label + '）' }); }
      const last = S.history[S.history.length - 1];
      if (last) S.log.push({ age: age, kind: 'summary', text: '月薪 ' + fmtMoney(last.salary) + ' · 存款 ' + fmtMoney(last.cash) });
    }
    renderAll();
    save();
    if (S.over || S.age >= D.meta.retireAge) return finish();
    tick();
  }

  // ------------------------------------------------------------------ 渲染
  function renderAll() {
    if (!S) return;
    renderTopbar();
    renderIdCard();
    renderStats();
    renderFinance();
    renderScene();
    renderFocus();
    renderLog();
    renderFamily();
    renderPeers();
    renderMap();
  }

  function renderTopbar() {
    $('#tb-age').textContent = S.age;
    $('#tb-year').textContent = ((D.meta.startYear || 2026) + (S.age - 18)) + ' 年';
    $('#tb-name').textContent = S.identity.name;
    $('#tb-nyear').textContent = S.age >= 22 ? (S.age - 21) : '—';
  }

  function renderIdCard() {
    const d = S.draw, id = S.identity;
    $('#id-region').textContent = S.region;
    $('#id-year').textContent = (D.meta.startYear || 2026) + (S.age - 18);
    $('#id-name').textContent = id.name;
    const eduNow = S.age < 22 ? (S.draw.edu === '高中' ? '高中' : S.draw.edu + '在读') : (S.flags.civil ? '体制内' : S.draw.edu);
    const fields = [
      ['性别', id.gender],
      ['出生', id.birth],
      ['居住', d.cityName],
      ['家庭', d.family.name.length > 6 ? d.family.name.slice(0, 6) : d.family.name],
      ['学历', eduNow],
      ['行业', S.age < 22 ? '未入职' : d.industry.name],
      ['岗位', S.age < 22 ? '无' : d.role.name],
      ['气质', d.trait.name],
    ];
    $('#id-fields').innerHTML = fields.map(function (f) {
      return '<dt>' + f[0] + '</dt><dd>' + f[1] + '</dd>';
    }).join('');
    $('#id-code').textContent = id.code + '<<' + (D.meta.startYear || 2026) + '<<' + String(S.seed).slice(-8);
    drawAvatar($('#avatar'), id);
  }

  function bar(label, v, color, pct, text) {
    const val = Math.round(v);
    const w = pct === undefined ? clamp(v, 0, 100) : clamp(pct, 0, 100);
    const t = text === undefined ? String(val) : text;
    return '<div class="bar-row' + (val < 28 ? ' warn' : '') + '">' +
      '<span class="bl">' + label + '</span>' +
      '<span class="bt"><i class="bf" style="width:' + w + '%;background:' + color + '"></i></span>' +
      '<span class="bv">' + t + '</span></div>';
  }

  function renderStats() {
    const st = S.stats;
    const cashPct = st.cash <= 0 ? 0 : clamp((Math.log10(Math.max(st.cash, 1000)) - 4) / 3 * 100, 0, 100);
    $('#stats-bars').innerHTML =
      bar('健康', st.health, 'var(--green)') +
      bar('心气', st.spirit, 'var(--amber)') +
      bar('能力', st.skill, 'var(--blue)') +
      bar('关系', st.relation, '#b06d8a') +
      bar('现金', st.cash <= 0 ? 0 : cashPct, '#c7c1b4', cashPct, fmtMoney(st.cash))
        .replace('class="bar-row', 'class="bar-row') +
      bar('自由', st.freedom, '#8a8a76', clamp(st.freedom / 75 * 100, 0, 100), Math.round(st.freedom) + 'h');
  }

  function renderFinance() {
    $('#fin-net').textContent = fmtMoney(E.netWorth(S));
    $('#fin-income').textContent = S.stats.salary ? fmtMoney(E.annualIncome(S)) : '—';
  }

  function renderFocus() {
    const stage = S.age < 19 ? '高中' : S.age < 22 ? '大学' : S.status || (S.flags.civil ? '体制内' : '在职');
    $('#focus-sub').textContent = S.age + ' 岁 · ' + (S.age < 22 ? '读书' : S.draw.industry.name) + ' · ' + S.draw.cityName;
    const box = $('#chips');
    box.innerHTML = '';
    D.focusOrder.forEach(function (id) {
      const f = D.focus[id];
      const tags = D.focusTags[id] || [];
      const b = document.createElement('button');
      b.className = 'chip' + (focusSel === id ? ' sel' : '');
      b.dataset.id = id;
      b.innerHTML = f.icon + ' ' + f.name + '<span class="ce">' + tags.join(' ') + '</span>';
      b.onclick = function () {
        focusSel = id;
        $$('#chips .chip').forEach(function (x) { x.classList.toggle('sel', x.dataset.id === id); });
        if (!running) stepOnce();
      };
      box.appendChild(b);
    });
  }
  function bindChips() { /* 事件委托已在 renderFocus 内绑定 */ }

  function renderLog() {
    const box = $('#log');
    box.innerHTML = '';
    for (let i = S.log.length - 1; i >= 0; i--) {
      const l = S.log[i];
      const el = document.createElement('div');
      el.className = 'lrow ' + (l.kind || '') + (l.star ? ' star' : '');
      el.innerHTML = '<span class="la">' + l.age + '</span><span class="lt"></span><span class="ls">★</span>';
      el.querySelector('.lt').textContent = l.text;
      el.onclick = function () {
        l.star = !l.star;
        el.classList.toggle('star', !!l.star);
      };
      box.appendChild(el);
    }
  }

  function renderFamily() {
    const id = S.identity;
    let html = '';
    id.parents.forEach(function (p) {
      html += '<div class="frow"><span class="fk">' + p.role + '</span><span class="fv"><b>' + p.name +
        ' · ' + (p.age + (S.age - 18)) + ' 岁</b><em>' + p.rel + ' · ' + p.job + '</em></span></div>';
    });
    html += '<div class="frow"><span class="fk">兄弟姊妹</span><span class="fv"><b>' +
      (id.siblings ? id.siblings + ' 个' : '无') + '</b><em>' +
      (S.flags.partner ? '有伴侣' : (S.age >= 26 ? '单身' : '还没到这步')) + '</em></span></div>';
    html += '<div class="frow"><span class="fk">房子</span><span class="fv"><b>' +
      (S.flags.house ? '有房' : (S.flags.soldHouse ? '卖掉了' : '没有')) + '</b><em>' +
      (S.flags.kids ? '孩子 ' + S.flags.kids + ' 个' : '没有孩子') + '</em></span></div>';
    $('#family-list').innerHTML = html;
  }

  function renderPeers() {
    const box = $('#peer-list');
    if (!S.peers) { box.innerHTML = ''; return; }
    box.innerHTML = S.peers.map(function (p) {
      const st = (p.statusLog && (p.statusLog[S.age] || p.statusLog[22])) || '上学';
      return '<div class="prow"><span class="pn"><b>' + p.identity.name + '</b><span>' +
        p.draw.tier.name + ' · ' + p.identity.gender + ' · ' + p.draw.industry.name + '</span></span>' +
        '<span class="ps">' + st + '</span></div>';
    }).join('');
  }

  function renderMap() {
    const box = $('#lifemap');
    if (!box.children.length) {
      for (let a = 22; a <= 59; a++) {
        const el = document.createElement('i');
        el.className = 'lm future';
        el.dataset.age = a;
        box.appendChild(el);
      }
    }
    $$('#lifemap .lm').forEach(function (el) {
      const a = +el.dataset.age;
      const h = S.history.find(function (x) { return x.age === a; });
      el.className = 'lm' + (a === S.age ? ' now' : '');
      if (!h) { el.classList.add('future'); el.style.background = ''; return; }
      el.style.background = h.health > 70 ? '#6f9a6a' : h.health > 50 ? '#a3a45f' : h.health > 30 ? '#c08a4e' : '#b8544a';
      if (h.health <= 0) el.style.background = '#3a1a1a';
    });
  }

  function renderScene() {
    const cv = $('#scene');
    drawScene(cv, S);
    const st = S.age < 22 ? '上学' : (S.flags.civil ? '体制内' : (S.flags.freelance ? '自由职业' : '上班')) ;
    $('#scene-cap').innerHTML = S.draw.tier.name + ' · ' + (D.sceneDesc[S.draw.tier.id] || '') +
      '<em>你（' + S.age + ' 岁）· ' + st + ' · 父亲 ' + (S.identity.parents[0].age + S.age - 18) + ' 岁 · 母亲 ' +
      (S.identity.parents[1].age + S.age - 18) + ' 岁</em>';
  }

  // ------------------------------------------------------------------ 像素画
  function drawAvatar(cv, id) {
    const ctx = cv.getContext('2d');
    const W = 64, H = 64, P = 4;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#17171c'; ctx.fillRect(0, 0, W, H);
    const h = hash(id.name + id.gender);
    const skin = ['#e8c39e', '#d9ab84', '#c08e63', '#f0d0ae'][h % 4];
    const hair = ['#1c1a19', '#3a2a20', '#5a3a2a'][(h >> 3) % 3];
    const shirt = ['#3d4a5c', '#5c3d3d', '#3d5c47', '#4a4a5c'][(h >> 5) % 4];
    const female = id.gender === '女';
    const px = function (x, y, c) { ctx.fillStyle = c; ctx.fillRect(x * P, y * P, P, P); };

    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) px(x, y, skin);
    for (let x = 3; x < 13; x++) { px(x, 2, hair); px(x, 3, hair); }
    px(3, 4, hair); px(12, 4, hair); px(3, 5, hair); px(12, 5, hair);
    if (female) { for (let y = 4; y < 14; y++) { px(3, y, hair); px(12, y, hair); } }
    px(6, 7, '#1a1a1a'); px(9, 7, '#1a1a1a');
    px(7, 9, '#c99'); px(8, 9, '#c99');
    for (let y = 12; y < 16; y++) for (let x = 4; x < 12; x++) px(x, y, shirt);
    px(7, 12, skin); px(8, 12, skin);
    ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 1;
    ctx.strokeRect(.5, .5, W - 1, H - 1);
  }

  function drawScene(cv, S) {
    const ctx = cv.getContext('2d');
    const W = 320, H = 50, P = 2, HOR = 36;       // 逻辑 160x50，画布 320x100
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    const h = hash(String(S.seed) + S.draw.tier.id);
    const night = (S.year % 4) === 3, dusk = (S.year % 4) === 2;

    // 天空
    const skyTop = night ? '#101828' : dusk ? '#3a2b3c' : '#7fa8c9';
    const skyBot = night ? '#26314a' : dusk ? '#b4705a' : '#d8e6ee';
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = lerpColor(skyTop, skyBot, i / 6);
      ctx.fillRect(0, Math.round(i * HOR / 7) * P, W, (HOR / 7 + 1) * P);
    }
    // 星星
    if (night) {
      ctx.fillStyle = '#e8eef8';
      for (let i = 0; i < 16; i++) {
        const sx = (h >> (i % 13)) % 158, sy = (h >> (i % 9)) % 24;
        ctx.fillRect(sx * P, sy * P, P, P);
      }
    }
    // 日月
    const sunX = 26 + (h % 56);
    ctx.fillStyle = night ? 'rgba(230,236,245,.18)' : dusk ? 'rgba(242,178,113,.25)' : 'rgba(249,237,194,.30)';
    ctx.fillRect((sunX - 1) * P, 1 * P, 8 * P, 7 * P);
    ctx.fillStyle = night ? '#e6ecf5' : dusk ? '#f2b271' : '#f9edc2';
    ctx.fillRect(sunX * P, 2 * P, 6 * P, 6 * P);
    if (night) { ctx.fillStyle = skyTop; ctx.fillRect((sunX + 4) * P, 1 * P, 5 * P, 6 * P); }

    // 云
    ctx.fillStyle = night ? '#2b3550' : dusk ? 'rgba(245,190,160,.42)' : 'rgba(255,255,255,.62)';
    for (let i = 0; i < 3; i++) {
      const cx = (8 + i * 50 + (h % 13)) % 150;
      ctx.fillRect(cx * P, (11 + i * 4) * P, 14 * P, 2 * P);
      ctx.fillRect((cx + 4) * P, (9 + i * 4) * P, 8 * P, 2 * P);
    }

    // 远景剪影
    ctx.fillStyle = night ? '#1a2334' : dusk ? '#644b52' : '#95aab7';
    for (let i = 0; i < 20; i++) {
      const bh = 4 + ((h >> (i % 11)) % 9);
      const x = (i * 9) % 158;
      ctx.fillRect(x * P, (HOR - bh) * P, 11 * P, bh * P);
    }

    // 中景建筑
    const tier = S.draw.tier.id;
    const body = night ? '#242c3c' : dusk ? '#6b4f4a' : '#b9b2a2';
    const body2 = night ? '#2c3648' : dusk ? '#7b5a52' : '#cdc5b3';
    const win = night ? '#f0c674' : 'rgba(255,255,255,.34)';
    const winOff = night ? '#1b2230' : 'rgba(0,0,0,.06)';

    if (tier === 't1' || tier === 't2') {
      for (let i = 0; i < 9; i++) {
        const bw = 12 + ((h >> i) % 8);
        const bh = 16 + ((h >> (i + 3)) % 14);
        const x = -2 + i * 19;
        ctx.fillStyle = i % 2 ? body : body2;
        ctx.fillRect(x * P, (HOR - bh) * P, bw * P, bh * P);
        for (let wy = 0; wy < Math.floor(bh / 4); wy++)
          for (let wx = 0; wx < Math.floor(bw / 4); wx++) {
            const lit = night && ((h >> (wy * 3 + wx + i)) & 3) === 0;
            ctx.fillStyle = lit ? win : winOff;
            ctx.fillRect((x + 2 + wx * 4) * P, (HOR - bh + 3 + wy * 4) * P, P, P);
          }
      }
    } else if (tier === 't3' || tier === 't4') {
      for (let i = 0; i < 8; i++) {
        const bw = 15 + ((h >> i) % 7);
        const bh = 10 + ((h >> (i + 2)) % 12);
        const x = -1 + i * 20;
        ctx.fillStyle = i % 2 ? body : body2;
        ctx.fillRect(x * P, (HOR - bh) * P, bw * P, bh * P);
        for (let wy = 0; wy < Math.floor(bh / 4); wy++)
          for (let wx = 0; wx < Math.floor(bw / 4); wx++) {
            ctx.fillStyle = night && ((h >> (wy + wx + i)) & 3) === 0 ? win : winOff;
            ctx.fillRect((x + 2 + wx * 4) * P, (HOR - bh + 3 + wy * 4) * P, P, P);
          }
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const x = 14 + i * 48, bw = 24, bh = 10;
        ctx.fillStyle = i % 2 ? '#cdb693' : '#c1aa88';
        ctx.fillRect(x * P, (HOR - bh) * P, bw * P, bh * P);
        ctx.fillStyle = '#7a4b3a';
        ctx.beginPath();
        ctx.moveTo((x - 2) * P, (HOR - bh) * P);
        ctx.lineTo((x + bw / 2) * P, (HOR - bh - 7) * P);
        ctx.lineTo((x + bw + 2) * P, (HOR - bh) * P);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = night ? '#f0c674' : '#5b4a3a';
        ctx.fillRect((x + 4) * P, (HOR - bh + 3) * P, 3 * P, 3 * P);
        ctx.fillStyle = '#6b4a3a';
        ctx.fillRect((x + 14) * P, (HOR - bh + 4) * P, 4 * P, 6 * P);
      }
    }

    // 地面
    ctx.fillStyle = night ? '#18211a' : dusk ? '#3d4936' : '#6f8a5c';
    ctx.fillRect(0, HOR * P, W, (H - HOR) * P);
    ctx.fillStyle = night ? '#20291f' : dusk ? '#48553c' : '#7e9b67';
    ctx.fillRect(0, HOR * P, W, P);

    // 树
    for (let i = 0; i < 3; i++) {
      const x = 6 + i * 64 + (h % 9);
      ctx.fillStyle = '#4a3a2a';
      ctx.fillRect(x * P, (HOR - 7) * P, P, 7 * P);
      ctx.fillStyle = night ? '#22402c' : dusk ? '#3a5c3a' : '#3f6b3f';
      ctx.fillRect((x - 3) * P, (HOR - 13) * P, 7 * P, 7 * P);
    }

    // 人物
    const px = 96, py = HOR - 12;
    const shirt = ['#3d4a5c', '#5c3d3d', '#3d5c47', '#4a4a5c'][h % 4];
    const skin = ['#e8c39e', '#d9ab84', '#c08e63'][h % 3];
    ctx.fillStyle = '#1c1a19'; ctx.fillRect(px * P, py * P, 5 * P, 2 * P);
    ctx.fillStyle = skin; ctx.fillRect(px * P, (py + 2) * P, 5 * P, 3 * P);
    ctx.fillStyle = shirt; ctx.fillRect(px * P, (py + 5) * P, 5 * P, 4 * P);
    ctx.fillStyle = '#22242c'; ctx.fillRect((px + 1) * P, (py + 9) * P, P, 2 * P);
    ctx.fillRect((px + 3) * P, (py + 9) * P, P, 2 * P);

    // 草
    for (let i = 0; i < 30; i++) {
      const x = (i * 6 + (h % 5)) % 158;
      ctx.fillStyle = night ? '#222c22' : 'rgba(255,255,255,.10)';
      ctx.fillRect(x * P, (HOR + 3 + (i % 4) * 2) * P, P, P);
    }
  }

  function lerpColor(a, b, t) {
    const pa = hex(a), pb = hex(b);
    const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
    const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
    const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }

  // ------------------------------------------------------------------ 节点 / 事件
  function filterOptions(opts) {
    return opts.filter(function (x) {
      if (S.flags.examFailed && x.o.eff && x.o.eff.special === 'exam' && S.age <= 24) return false;
      return true;
    });
  }

  function openNode(node, options) {
    busy = true; resumeAfter = running; pause();
    renderAll();
    const m = $('#modal'); m.hidden = false;
    $('#m-kicker').textContent = '抉择 · ' + S.age + ' 岁';
    $('#m-title').textContent = node.title;
    $('#m-scene').textContent = typeof node.scene === 'function' ? node.scene(S) : (node.scene || '');
    $('#m-result').hidden = true; $('#m-result').innerHTML = '';
    $('#m-next').hidden = true;
    const box = $('#m-options'); box.innerHTML = ''; box.hidden = false;
    options.forEach(function (x) {
      const b = document.createElement('button');
      b.className = 'opt';
      b.innerHTML = '<div class="t">' + x.o.label + '</div>' + (x.o.hint ? '<div class="h">' + x.o.hint + '</div>' : '');
      b.onclick = function () { pickNodeOption(node, x); };
      box.appendChild(b);
    });
    if (autoDecide) setTimeout(function () {
      if ($('#modal').hidden) return;
      const vis = options.filter(function () { return true; });
      const pick = vis[Math.floor(Math.random() * vis.length)];
      pickNodeOption(node, pick);
    }, 900);
  }

  function pickNodeOption(node, x) {
    if (!x) return;
    $$('.opt').forEach(function (b) { b.disabled = true; });
    const res = E.applyNodeOption(S, node.id, x.i);
    (res.lines || []).forEach(function (l) { S.log.push({ age: S.age, kind: l.kind, text: l.text }); });
    renderAll();
    showResult(res.lines || [], function () {
      if (res.reopen) {
        const n = Sim.nextNode(S);
        if (n) { openNode(n.node, filterOptions(n.options)); return; }
      }
      if (res.jump && !res.redo) S.age += res.jump;
      closeModal();
      if (S.stats.salary === 0 && S.age >= 22) E.startWork(S);
      if (res.redo) {
        const n2 = Sim.nextNode(S);
        if (n2) { openNode(n2.node, filterOptions(n2.options)); return; }
      }
      afterStep();
      if (resumeAfter) { resumeAfter = false; play(); }
    });
  }

  function openEvent(ev, done) {
    busy = true; resumeAfter = running; pause();
    renderAll();
    const m = $('#modal'); m.hidden = false;
    $('#m-kicker').textContent = '事件 · ' + (ev.tag || '');
    $('#m-title').textContent = ev.title;
    $('#m-scene').textContent = ev.text;
    $('#m-result').hidden = true; $('#m-result').innerHTML = '';
    $('#m-next').hidden = true;
    const box = $('#m-options'); box.innerHTML = ''; box.hidden = false;
    ev.options.forEach(function (o, i) {
      const b = document.createElement('button');
      b.className = 'opt';
      b.innerHTML = '<div class="t">' + o.label + '</div>' + (o.desc ? '<div class="h">' + o.desc + '</div>' : '');
      b.onclick = function () {
        $$('.opt').forEach(function (x) { x.disabled = true; });
        const r = E.applyEvent(S, ev, i);
        (r.lines || []).forEach(function (l) { S.log.push({ age: S.age, kind: l.kind, text: l.text }); });
        renderAll();
        showResult(r.lines || [], function () {
          closeModal();
          if (done) done();
          if (resumeAfter) { resumeAfter = false; play(); }
        });
      };
      box.appendChild(b);
    });
    if (autoDecide) setTimeout(function () {
      if ($('#modal').hidden) return;
      const idx = Math.floor(Math.random() * ev.options.length);
      const btn = $$('.opt')[idx];
      if (btn && !btn.disabled) btn.click();
    }, 900);
  }

  function showResult(lines, next) {
    const box = $('#m-options'); box.hidden = true;
    const res = $('#m-result'); res.hidden = false; res.innerHTML = '';
    (lines.length ? lines : [{ text: '你没有说话。', kind: '' }]).forEach(function (l) {
      const d = document.createElement('div');
      d.className = 'line ' + (l.kind || '');
      d.textContent = l.text;
      res.appendChild(d);
    });
    const btn = $('#m-next');
    btn.hidden = false;
    btn.onclick = function () { btn.onclick = null; next(); };
    if (autoDecide) setTimeout(function () { if (!btn.hidden && btn.onclick) btn.click(); }, 800);
  }

  function closeModal() { $('#modal').hidden = true; busy = false; }

  // ------------------------------------------------------------------ 结算
  function finish() {
    pause();
    if (!S.over) { S.over = true; S.ending = E.evaluate(S); }
    S.over = true;
    renderEnding();
    show('s-ending');
    localStorage.removeItem(KEY);
  }

  function renderEnding() {
    const en = S.ending || E.evaluate(S);
    $('#end-name').textContent = '「' + en.name + '」';
    $('#end-line').textContent = en.line;
    const m = E.metrics(S);
    const rows = [
      ['终值存款', fmtMoney(m.cash), ''],
      ['退休前月薪', fmtMoney(m.salary), ''],
      ['健康', m.health, '/100'],
      ['心气', m.spirit, '/100'],
      ['能力', m.skill, '/100'],
      ['关系', m.relation, '/100'],
      ['晋升 / 被裁', m.promotions + ' / ' + m.layoffs, '次'],
      ['房子 / 编制', (m.house ? '有房' : '无房') + ' / ' + (m.civil ? '上岸' : '没有'), ''],
      ['孩子 / 换赛道', m.kids + ' / ' + m.pivots, ''],
    ];
    $('#end-metrics').innerHTML = rows.map(function (r) {
      return '<div class="em"><div class="k">' + r[0] + '</div><div class="v">' + r[1] +
        (r[2] ? ' <small>' + r[2] + '</small>' : '') + '</div></div>';
    }).join('');

    drawRadar($('#radar'), [
      { label: '钱', v: clamp((Math.log10(Math.max(m.cash + 100000, 10000)) - 4) / 3 * 100, 0, 100) },
      { label: '健康', v: m.health },
      { label: '关系', v: m.relation },
      { label: '心气', v: m.spirit },
    ]);
    drawLifeline($('#lifeline'), S.history);
    renderSameSecond();
  }

  function setupCanvas(cv, cssH) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 360;
    const h = cssH || (w * 0.62);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.height = h + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function drawRadar(cv, vals) {
    const c = setupCanvas(cv, Math.min(300, (cv.clientWidth || 360) * 0.82));
    const ctx = c.ctx, w = c.w, h = c.h;
    const cx = w / 2, cy = h / 2 + 4, R = Math.min(w, h) / 2 - 42;
    const n = vals.length;
    ctx.clearRect(0, 0, w, h);
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = -Math.PI / 2 + (i % n) * (Math.PI * 2 / n);
        const r = R * ring / 4;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; ctx.stroke();
    }
    vals.forEach(function (v, i) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / n);
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.stroke();
      ctx.fillStyle = '#8b8680'; ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(v.label + ' ' + Math.round(v.v), cx + Math.cos(a) * (R + 20), cy + Math.sin(a) * (R + 18));
    });
    ctx.beginPath();
    vals.forEach(function (v, i) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / n);
      const r = R * clamp(v.v, 0, 100) / 100;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(217,164,78,.16)'; ctx.fill();
    ctx.strokeStyle = '#d9a44e'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  function drawLifeline(cv, hist) {
    const c = setupCanvas(cv, Math.min(320, (cv.clientWidth || 640) * 0.5));
    const ctx = c.ctx, w = c.w, h = c.h;
    ctx.clearRect(0, 0, w, h);
    if (!hist.length) return;
    const pad = { l: 34, r: 34, t: 14, b: 22 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const ages = hist.map(function (x) { return x.age; });
    const a0 = ages[0], a1 = ages[ages.length - 1] || a0 + 1;
    const maxSalary = Math.max.apply(null, hist.map(function (x) { return x.salary; })) || 1;
    for (let i = 0; i <= 3; i++) {
      const y = pad.t + ih * i / 3;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y);
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.stroke();
      ctx.fillStyle = '#625e59'; ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'right';
      ctx.fillText(Math.round(100 * (1 - i / 3)), pad.l - 6, y + 3);
    }
    const X = function (age) { return pad.l + (age - a0) / Math.max(1, (a1 - a0)) * iw; };
    const Y = function (v) { return pad.t + ih * (1 - clamp(v, 0, 100) / 100); };
    function line(fn, color) {
      ctx.beginPath();
      hist.forEach(function (pt, i) {
        const x = X(pt.age), y = Y(fn(pt));
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke();
    }
    line(function (p) { return p.salary / maxSalary * 100; }, '#d9a44e');
    line(function (p) { return p.health; }, '#6f9a6a');
    line(function (p) { return p.spirit; }, '#6d8fb0');
    ctx.fillStyle = '#625e59'; ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'center';
    [a0, Math.round((a0 + a1) / 2), a1].forEach(function (a) { ctx.fillText(a + '岁', X(a), h - 6); });
    ctx.textAlign = 'right'; ctx.fillStyle = '#8b8680';
    ctx.fillText('月薪峰值 ' + fmtMoney(maxSalary), w - pad.r, 10);
  }

  function renderSameSecond() {
    const box = $('#same-second');
    box.innerHTML = '';
    const others = Sim.sameSecond(S.seed, 5);
    const rows = [{ me: true, draw: S.draw, ending: S.ending, metrics: E.metrics(S) }].concat(others);
    rows.forEach(function (r) {
      const el = document.createElement('div');
      el.className = 'ss-row' + (r.me ? ' me' : '');
      const d = r.draw;
      const who = (r.me ? '你' : '另一个人') + ' · ' + d.tier.name + ' · ' + d.industry.name;
      el.innerHTML = '<div class="who"><b>' + who + '</b><span>' + d.family.name + ' · ' + d.edu + '</span></div>' +
        '<div class="val">' + fmtMoney(r.metrics.cash) + '</div>' +
        '<div class="endtag">' + ((r.ending && r.ending.name) || '—') + '</div>';
      box.appendChild(el);
    });
  }

  // ------------------------------------------------------------------ 存档
  function save() {
    if (!S || S.over) return;
    try {
      const copy = {};
      for (const k in S) if (k !== 'rnd') copy[k] = S[k];
      copy.rndState = S.rnd && S.rnd.getState ? S.rnd.getState() : 0;
      localStorage.setItem(KEY, JSON.stringify(copy));
    } catch (e) {}
  }
  function hasSave() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }
  function loadSave() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const o = JSON.parse(raw);
      const rnd = E.mulberry32(1);
      rnd.setState(o.rndState || 1);
      o.rnd = rnd;
      S = o;
      if (!S.peers) S.peers = Sim.buildPeers(S.seed, 5);
      focusSel = 'career';
      show('s-play');
      renderAll();
      if (S.age < 22) focusSel = 'learn';
      renderFocus();
      tick();
      return true;
    } catch (e) { return false; }
  }

  // ------------------------------------------------------------------ 分享
  function shareText() {
    const m = E.metrics(S);
    const en = S.ending || {};
    return '《工位》1 in 740 Million\n' +
      '我抽到了：' + S.draw.tier.name + ' · ' + S.draw.family.name + ' · ' + S.draw.industry.name + ' · ' + S.draw.edu + '\n' +
      '结局：「' + en.name + '」\n' +
      '存款 ' + fmtMoney(m.cash) + '｜健康 ' + m.health + '｜心气 ' + m.spirit + '｜能力 ' + m.skill + '\n' +
      '晋升 ' + m.promotions + ' 次，被裁 ' + m.layoffs + ' 次。';
  }

  // ------------------------------------------------------------------ 关于
  function renderSources() {
    const box = $('#src-list');
    if (!box) return;
    box.innerHTML = D.sources.map(function (s) {
      return '<div class="src-row"><div class="k">' + s.k + '</div><div class="v">' + s.v + '<em>' + s.type + '</em></div></div>';
    }).join('');
  }

  // ------------------------------------------------------------------ 绑定
  function bind() {
    $('#btn-start').onclick = newGame;
    $('#btn-begin').onclick = beginLife;
    $('#btn-again').onclick = function () { S = null; newGame(); };
    $('#btn-share').onclick = function () {
      const t = shareText();
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () {
        $('#btn-share').textContent = '已复制';
        setTimeout(function () { $('#btn-share').textContent = '复制这一生'; }, 1600);
      });
    };
    $('#btn-load').onclick = function () { if (!loadSave()) alert('存档读取失败'); };

    $('#btn-play').onclick = function () { running ? pause() : play(); };
    $('#btn-skip').onclick = skipToNode;
    $('#btn-auto').onclick = function () {
      autoDecide = !autoDecide;
      $('#btn-auto').classList.toggle('on', autoDecide);
      if (autoDecide && !busy && running) stepOnce();
    };
    $$('#speeds .tbtn').forEach(function (b) {
      b.onclick = function () {
        $$('#speeds .tbtn').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        speed = +b.dataset.s;
        if (running) startTimer();
      };
    });

    ['btn-about', 'btn-about2', 'btn-about3'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.onclick = function () { renderSources(); $('#about').hidden = false; };
    });
    $('#about-close').onclick = function () { $('#about').hidden = true; };

    document.querySelector('.stat-note').onclick = function () { this.classList.toggle('open'); };

    document.addEventListener('keydown', function (e) {
      if (!$('#s-play').classList.contains('active')) return;
      if (!$('#modal').hidden || !$('#about').hidden) return;
      if (e.code === 'Space') { e.preventDefault(); running ? pause() : play(); return; }
      if (e.key >= '1' && e.key <= '6') {
        const id = D.focusOrder[parseInt(e.key, 10) - 1];
        const chip = $$('#chips .chip').find(function (c) { return c.dataset.id === id; });
        if (chip) chip.click();
      }
    });

    renderSources();
    if (hasSave()) $('#btn-load').hidden = false;
  }

  document.addEventListener('DOMContentLoaded', bind);
})();
