/* 工位 — 界面控制（dashboard 版） */
(function () {
  const G = window;
  const GW = G.GW, E = GW.Engine, D = GW.DATA, Sim = GW.Sim;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
  const KEY = 'gongwei.save.v2';

  let S = null;
  let running = false;
  let speed = 1;
  let timer = null;
  let focusSel = 'learn';
  let autoDecide = false;
  let busy = false;
  let wantRun = false;   // 玩家是否希望时间继续流动（不因弹窗清掉）
  let autoStarted = false;

  const META = D.meta;
  function stage() {
    if (!S) return 'work';
    if (S.age < 15) return 'junior';
    if (S.age < META.schoolEnd) return 'senior';
    if (S.age < META.gradAge) return 'college';
    return 'work';
  }
  // 正在上学的年份（会有"今年的重心"）
  function isStudent() {
    return !!S && S.stats.salary === 0 && S.age < (S.flags.schoolEndAge || META.schoolEnd) && S.flags.track !== 'none';
  }

  // ------------------------------------------------------------------ 主题
  const THEME_KEY = 'gongwei.theme';
  function currentTheme() { return document.documentElement.getAttribute('data-theme') || 'dark'; }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    const icon = t === 'light' ? '☀' : '☾';
    const label = t === 'light' ? '☀ 亮色' : '☾ 暗色';
    const top = $('#btn-theme');
    if (top) { top.textContent = icon; top.title = t === 'light' ? '切换到暗色' : '切换到亮色'; }
    const flo = $('#btn-theme-float');
    if (flo) { flo.textContent = label; flo.title = t === 'light' ? '切换到暗色' : '切换到亮色'; }
  }
  function toggleTheme() { applyTheme(currentTheme() === 'light' ? 'dark' : 'light'); }

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
    document.body.classList.toggle('playing', id === 's-play');
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
      ['学习底子', d.aptitude ? d.aptitude.name : '—', d.aptitude ? d.aptitude.note : ''],
      ['家里的钱', '¥' + fmtWan(d.family.cash0), '父母能拿出来的全部'],
      ['行业 / 岗位', d.industry.name + ' · ' + d.role.name, d.industry.note],
      ['体质 / 性格', d.trait.name, d.trait.note],
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
    setTimeout(function () { btn.disabled = false; $('#draw-hint').textContent = '13 岁到 60 岁，十几个岔路口。这一生只能走一次。'; }, 1100);
  }

  // ------------------------------------------------------------------ 开局
  function beginLife() {
    if (!S.peers) S.peers = Sim.buildPeers(S.seed, 5);
    focusSel = isStudent() ? 'study' : 'career';
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
    if (isStudent()) { applySchoolYear(focusSel); return; }
    if (S.age < D.meta.gradAge) { fastForward(); renderAll(); save(); return tick(); }
    if (S.stats.salary === 0) E.startWork(S);
    applyYear(focusSel);
  }

  function fastForward() {
    const ages = D.nodes.map(function (n) { return n.age; }).filter(function (a) { return a > S.age; });
    let target = Math.min(D.meta.gradAge, ages.length ? Math.min.apply(null, ages) : D.meta.gradAge);
    if (target <= S.age) target = Math.min(D.meta.gradAge, S.age + 1);
    const from = S.age;
    S.age = target;
    S.year = (D.meta.startYear || 2026) + (S.age - D.meta.startAge);
    S.log.push({ age: target, kind: 'flavor', text: from <= 18 ? '一年过去了。' :
      (from <= 21 ? '大学四年过去了。你记不清学会了什么，但记得住每个室友的呼噜声。' : '几年过去了。') });
    renderTopbar();
  }

  function stepOnce() {
    if (busy || !S || S.over) return;
    if (S.age >= D.meta.retireAge) return finish();
    const n = Sim.nextNode(S);
    if (n) { pause(); openNode(n.node, filterOptions(n.options)); return; }
    if (isStudent()) { applySchoolYear(focusSel); return; }
    if (S.age < D.meta.gradAge) { fastForward(); renderAll(); save(); return; }
    if (S.stats.salary === 0) E.startWork(S);
    applyYear(focusSel);
  }

  // ------------------------------------------------------------------ 学生的一年
  function applySchoolYear(focusId) {
    const out = E.stepSchoolYear(S, focusId);
    const age = (out.lines && out.lines[0] && out.lines[0].age) || S.age - 1;
    (out.lines || []).forEach(function (l) { S.log.push({ age: age, kind: l.kind, text: l.text }); });
    const st = S.stats;
    S.log.push({
      age: age, kind: 'summary',
      text: '成绩 ' + Math.round(st.academic) + ' · 心气 ' + Math.round(st.spirit) + ' · 家里的钱 ' + fmtMoney(st.cash),
    });
    renderAll();
    save();
    if (out.event) { pause(); openEvent(out.event, afterStep); return; }
    afterStep();
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
    if (n) { pause(); openNode(n.node, filterOptions(n.options)); return; }
    // 第一次进入年度循环时，自动开始流动
    if (!autoStarted && !running) {
      autoStarted = true;
      play();
    }
  }

  // ------------------------------------------------------------------ 计时器
  function intervalMs() {
    const base = isStudent() ? (META.schoolTickMs || 4500) : (META.tickMs || 7000);
    return Math.round(base / speed);
  }
  function startTimer() {
    stopTimer();
    timer = setInterval(function () {
      if (!running || busy) return;
      stepOnce();
    }, intervalMs());
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function tickBar() {
    const bar = document.getElementById('tickbar-fill');
    if (!bar) return;
    bar.style.transition = 'none';
    bar.style.width = '0%';
    if (!running) return;
    void bar.offsetWidth;
    bar.style.transition = 'width ' + intervalMs() + 'ms linear';
    bar.style.width = '100%';
  }
  function resetTickBar() {
    const bar = document.getElementById('tickbar-fill');
    if (!bar) return;
    bar.style.transition = 'none';
    bar.style.width = running ? '100%' : '0%';
  }
  function play(immediate) {
    if (!S || S.over || busy) { return; }
    wantRun = true;
    running = true;
    $('#play-ico').textContent = '❚❚';
    $('#play-txt').textContent = '暂停';
    $('#btn-play').classList.add('running');
    startTimer();
    if (immediate !== false) stepOnce();
    tickBar();
  }
  function pause() {
    running = false;
    stopTimer();
    $('#play-ico').textContent = '▶';
    $('#play-txt').textContent = '继续';
    $('#btn-play').classList.remove('running');
    resetTickBar();
  }
  function stopPlay() { wantRun = false; pause(); }

  // ------------------------------------------------------------------ 快进
  function skipToNode() {
    wantRun = false;
    pause();
    let guard = 0;
    while (!busy && !S.over && guard++ < 60) {
      if (Sim.nextNode(S)) break;
      if (S.age >= D.meta.retireAge) break;
      if (isStudent()) {
        const so = E.stepSchoolYear(S, Sim.autoSchoolFocus(S, Math.random));
        if (so.event) E.applyEvent(S, so.event, 0);
        continue;
      }
      if (S.age < D.meta.gradAge) { fastForward(); continue; }
      if (S.stats.salary === 0) E.startWork(S);
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
    $('#tb-year').textContent = S.year + ' 年';
    $('#tb-name').textContent = S.identity.name;
    $('#tb-nyear').textContent = (S.age - D.meta.startAge + 1);
  }

  function renderIdCard() {
    const d = S.draw, id = S.identity;
    $('#id-region').textContent = S.region;
    $('#id-year').textContent = S.year;
    $('#id-name').textContent = id.name;
    const working = S.stats.salary > 0;
    const fields = [
      ['性别', id.gender],
      ['出生', id.birth],
      ['居住', d.cityName],
      ['家庭', d.family.name.length > 6 ? d.family.name.slice(0, 6) : d.family.name],
      ['学历', E.eduText(S)],
      ...(working
        ? [['专业', d.major.name]]
        : [['学校', S.flags.schoolName || (S.age < 15 ? '片区初中' : '—')]]),
      ['行业', working ? d.industry.name : '未入职'],
      ['岗位', working ? d.role.name : '—'],
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
    const school = S.stats.salary === 0 && S.age < META.schoolEnd;
    const third = school
      ? bar('成绩', st.academic, 'var(--blue)')
      : bar('能力', st.skill, 'var(--blue)');
    $('#stats-bars').innerHTML =
      bar('健康', st.health, 'var(--green)') +
      bar('心气', st.spirit, 'var(--amber)') +
      third +
      bar('关系', st.relation, 'var(--rel)') +
      bar(school ? '家底' : '现金', st.cash <= 0 ? 0 : cashPct, 'var(--cash)', cashPct, fmtMoney(st.cash)) +
      bar('自由', st.freedom, 'var(--free)', clamp(st.freedom / 75 * 100, 0, 100), Math.round(st.freedom) + 'h');
    const note = $('.stat-note');
    if (note) {
      note.firstChild.nodeValue = school ? '这些状态代表什么？' : '这些状态代表什么？';
      const tip = note.querySelector('.tip');
      if (tip) tip.textContent = school
        ? '成绩是高考的唯一变量，六年里每年选一次怎么过。心气归零会先于成绩发生；家底是父母能拿出来的钱。'
        : '健康归零会提前退场；心气归零会先于贫穷发生；自由是每周可支配的小时数。';
    }
  }

  function renderFinance() {
    const school = S.stats.salary === 0 && S.age < META.schoolEnd;
    const k1 = $('#fin-net-k'), k2 = $('#fin-income-k'), note = $('.fin-note');
    if (k1) k1.textContent = school ? '家里的钱' : '净资产';
    if (k2) k2.textContent = school ? '今年支出' : '年收入';
    if (note) note.textContent = school ? '以中国大陆物价计 · 学费与生活费' : '以中国大陆物价计';
    $('#fin-net').textContent = fmtMoney(school ? S.stats.cash : E.netWorth(S));
    $('#fin-income').textContent = school ? fmtMoney((S.fin && S.fin.schoolCost) || 0) : (S.stats.salary ? fmtMoney(E.annualIncome(S)) : '—');
  }

  function focusList() {
    if (isStudent()) return D.focusSchoolOrder.map(function (id) { return D.focusSchool[id]; });
    return D.focusOrder.map(function (id) { return D.focus[id]; });
  }
  function focusTags(id) {
    if (isStudent()) {
      const f = D.focusSchool[id];
      if (!f) return [];
      const sg = function (n) { return (n > 0 ? '+' : '−') + (Math.abs(n) % 1 ? Math.abs(n).toFixed(1) : Math.abs(n)); };
      const out = [];
      if (f.acad) out.push('成绩' + sg(f.acad));
      if (f.cash) out.push((f.cash > 0 ? '钱+' : '钱−') + fmtWan(Math.abs(f.cash)));
      if (f.health) out.push('健康' + sg(f.health));
      if (f.spirit) out.push('心气' + sg(f.spirit));
      return out.slice(0, 3);
    }
    return D.focusTags[id] || [];
  }
  function renderFocus() {
    const list = focusList();
    if (!list.some(function (f) { return f.id === focusSel; })) focusSel = list[0].id;
    const st = isStudent() ? '读书' : (S.flags.civil ? '体制内' : (S.flags.freelance ? '自由职业' : '在职'));
    let sub = S.age + ' 岁 · ' + st + ' · ' +
      (isStudent() ? (S.flags.schoolName || '初中') : S.draw.industry.name) + ' · ' + S.draw.cityName;
    if (isStudent()) {
      const acad = Math.round(S.stats.academic);
      sub += ' · 成绩 ' + acad;
      if (S.age < 15) sub += '（重点高中线 44 · 普高线 28）';
      else if (S.flags.track === 'key' || S.flags.track === 'normal') sub += '（本科线约 55 · 一本约 70，满分 100）';
    }
    $('#focus-sub').textContent = sub;
    const head = $('.focuscard .card-head em');
    if (head) head.textContent = isStudent() ? '每年选一次，成绩靠它' : '随时可以改';
    const box = $('#chips');
    box.innerHTML = '';
    list.forEach(function (f) {
      const tags = focusTags(f.id);
      const b = document.createElement('button');
      b.className = 'chip' + (focusSel === f.id ? ' sel' : '');
      b.dataset.id = f.id;
      b.innerHTML = f.icon + ' ' + f.name + '<span class="ce">' + tags.join(' ') + '</span>';
      b.onclick = function () {
        if (busy) return;
        focusSel = f.id;
        $$('#chips .chip').forEach(function (x) { x.classList.toggle('sel', x.dataset.id === f.id); });
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
    const grow = S.age - D.meta.startAge;
    let html = '';
    id.parents.forEach(function (p) {
      html += '<div class="frow"><span class="fk">' + p.role + '</span><span class="fv"><b>' + p.name +
        ' · ' + (p.age + grow) + ' 岁</b><em>' + p.rel + ' · ' + p.job + '</em></span></div>';
    });
    html += '<div class="frow"><span class="fk">兄弟姊妹</span><span class="fv"><b>' +
      (id.siblings ? id.siblings + ' 个' : '无') + '</b><em>' +
      (S.flags.partner ? '有伴侣' : (S.age >= 27 ? '单身' : '还没到这步')) + '</em></span></div>';
    html += '<div class="frow"><span class="fk">房子</span><span class="fv"><b>' +
      (S.flags.house ? '有房' : (S.flags.soldHouse ? '卖掉了' : '没有')) + '</b><em>' +
      (S.flags.kids ? '孩子 ' + S.flags.kids + ' 个' : '没有孩子') + '</em></span></div>';
    $('#family-list').innerHTML = html;
  }

  function peerStatus(p, age) {
    const log = p.statusLog || {};
    if (log[age]) return log[age];
    let best = null, bestAge = -1;
    for (const k in log) {
      const a = +k;
      if (a <= age && a > bestAge) { bestAge = a; best = log[k]; }
    }
    return best || '上学';
  }

  function renderPeers() {
    const box = $('#peer-list');
    if (!S.peers) { box.innerHTML = ''; return; }
    box.innerHTML = S.peers.map(function (p, i) {
      const st = peerStatus(p, S.age);
      return '<div class="prow" data-i="' + i + '" role="button" tabindex="0"><span class="pn"><b>' + p.identity.name + '</b><span>' +
        p.draw.tier.name + ' · ' + p.identity.gender + ' · ' + p.draw.industry.name + '</span></span>' +
        '<span class="ps">' + st + '</span></div>';
    }).join('');
    $$('#peer-list .prow').forEach(function (el) {
      el.onclick = function () { openPeer(+el.dataset.i); };
    });
  }

  function openPeer(i) {
    const p = (S.peers || [])[i];
    if (!p) return;
    const m = $('#peer');
    const e = p.ending || {};
    const mt = p.metrics || (p.history && p.history.length ? {} : {});
    const rows = [
      ['出生', p.draw.tier.name + ' · ' + p.draw.cityName],
      ['家庭', p.draw.family.name],
      ['学历', p.draw.edu + (p.flags && p.flags.track ? '（' + (D.schoolTracks[p.flags.track] || {}).name + '）' : '')],
      ['行业', p.draw.industry.name + ' · ' + p.draw.role.name],
      ['结局', '「' + (e.name || '—') + '」'],
      ['终值', '存款 ' + fmtMoney((p.stats && p.stats.cash) || 0) + ' · 健康 ' + Math.round((p.stats && p.stats.health) || 0) +
        ' · 心气 ' + Math.round((p.stats && p.stats.spirit) || 0)],
    ];
    $('#peer-name').textContent = p.identity.name + ' · ' + p.identity.gender;
    $('#peer-body').innerHTML = rows.map(function (r) {
      return '<div class="src-row"><div class="k">' + r[0] + '</div><div class="v">' + r[1] + '</div></div>';
    }).join('') + (e.line ? '<p class="scene-text" style="margin-top:14px">' + e.line + '</p>' : '');
    m.hidden = false;
  }

  function renderMap() {
    const box = $('#lifemap');
    if (!box.children.length) {
      for (let a = D.meta.startAge; a < D.meta.retireAge; a++) {
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
      if (!h) {
        if (a < S.age) { el.classList.add('na'); el.style.background = ''; return; }
        el.classList.add('future'); el.style.background = ''; return;
      }
      el.style.background = h.health > 70 ? 'var(--green)' : h.health > 50 ? '#a3a45f' : h.health > 30 ? '#c08a4e' : 'var(--red)';
    });
  }

  function renderScene() {
    const cv = $('#scene');
    drawScene(cv, S);
    const st = E.statusOf(S);
    const grow = S.age - D.meta.startAge;
    $('#scene-cap').innerHTML = S.draw.tier.name + ' · ' + (D.sceneDesc[S.draw.tier.id] || '') +
      '<em>你（' + S.age + ' 岁）· ' + st + ' · 父亲 ' + (S.identity.parents[0].age + grow) + ' 岁 · 母亲 ' +
      (S.identity.parents[1].age + grow) + ' 岁</em>';
  }

  // ------------------------------------------------------------------ 主题色
  function themeColors() {
    const cs = getComputedStyle(document.documentElement);
    const g = function (n) { return cs.getPropertyValue(n).trim() || '#888'; };
    return {
      text: g('--text'), text2: g('--text-2'), text3: g('--text-3'),
      line: g('--line'), lineSoft: g('--line-soft'),
      surface: g('--surface'), surface2: g('--surface-2'),
      accent: g('--accent'), green: g('--green'), blue: g('--blue'),
      light: currentTheme() === 'light',
    };
  }

  // ------------------------------------------------------------------ 像素画
  function drawAvatar(cv, id) {
    const ctx = cv.getContext('2d');
    const W = 64, H = 64, P = 4;
    ctx.imageSmoothingEnabled = false;
    const T = themeColors();
    ctx.fillStyle = T.surface2; ctx.fillRect(0, 0, W, H);
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
    ctx.strokeStyle = T.line; ctx.lineWidth = 1;
    ctx.strokeRect(.5, .5, W - 1, H - 1);
  }

  function drawScene(cv, S) {
    const ctx = cv.getContext('2d');
    const W = 320, H = 50, P = 2, HOR = 36;       // 逻辑 160x50，画布 320x100
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    const h = hash(String(S.seed) + S.draw.tier.id);
    const T = themeColors();
    // 亮色主题里不出现夜景，避免页面中间出现一块黑
    const night = !T.light && (S.year % 4) === 3, dusk = (S.year % 4) === 2;

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

    // 按主题轻微融合，避免画面和 UI 割裂
    ctx.fillStyle = T.light ? 'rgba(246,243,236,.12)' : 'rgba(10,10,12,.05)';
    ctx.fillRect(0, 0, W, H);

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
  function effectText(eff) {
    if (!eff) return '';
    const out = [];
    const sg = function (n) { return (n > 0 ? '+' : '−') + Math.abs(n); };
    if (eff.acad) out.push('成绩' + sg(eff.acad));
    if (eff.skill) out.push('能力' + sg(eff.skill));
    if (eff.health) out.push('健康' + sg(eff.health));
    if (eff.spirit) out.push('心气' + sg(eff.spirit));
    if (eff.relation) out.push('关系' + sg(eff.relation));
    if (eff.cash) out.push((eff.cash > 0 ? '钱+' : '钱−') + fmtWan(Math.abs(eff.cash)));
    if (eff.salaryMul) out.push('月薪' + (eff.salaryMul >= 1 ? '+' : '−') + Math.round(Math.abs(eff.salaryMul - 1) * 100) + '%');
    if (eff.track) out.push('→ ' + ((D.schoolTracks[eff.track] || {}).name || eff.track));
    if (eff.edu) out.push('→ ' + eff.edu);
    if (eff.startSalary) out.push('起薪 ¥' + eff.startSalary);
    if (eff.majorGroup) out.push('专业重抽');
    if (eff.special) {
      const SP = {
        exam: '上岸率 < 10%', exam35: '年龄窗口只剩两年', grad: '多读三年',
        house_big: '首付 + 30 年房贷', house_small: '回省会，工资降',
        kid: '钱 / 时间 / 心气一起扣', freelance: '收入从此不稳', startup: '高方差，可能归零',
        retireEarly: '提前退场', repeat_zk: '多读一年 + 9,000', repeat_gk: '多读一年 + 2.5 万',
        override_obey: '关系 +5 · 心气 −7', override_fight: '50% 被发现',
        override_teacher: '花 8,000 · 成功率 72%',
      };
      out.push(SP[eff.special] || '要赌一次');
    }
    if (eff.flags) {
      if (eff.flags.partner) out.push('有伴侣');
      if (eff.flags.manager) out.push('转管理');
      if (eff.flags.freelance) out.push('自由职业');
      if (eff.flags.startup) out.push('创业');
    }
    return out.join(' · ');
  }

  function filterOptions(opts) {
    return opts.filter(function (x) {
      if (S.flags.examFailed && x.o.eff && x.o.eff.special === 'exam' && S.age <= 24) return false;
      return true;
    });
  }

  function openNode(node, options) {
    busy = true; pause();
    renderAll();
    const m = $('#modal'); m.hidden = false;
    $('#m-kicker').textContent = '抉择 · ' + S.age + ' 岁';
    $('#m-title').textContent = node.title;
    $('#m-scene').textContent = typeof node.scene === 'function' ? node.scene(S) : (node.scene || '');
    $('#m-result').hidden = true; $('#m-result').innerHTML = '';
    $('#m-next').hidden = true;
    const box = $('#m-options'); box.innerHTML = ''; box.hidden = false;
    options.forEach(function (x, i) {
      const b = document.createElement('button');
      b.className = 'opt';
      const cost = effectText(x.o.eff);
      b.innerHTML = '<div class="t"><span class="num">' + (i + 1) + '</span>' + x.o.label + '</div>' +
        (x.o.hint ? '<div class="h">' + x.o.hint + '</div>' : '') +
        (cost ? '<div class="cost">' + cost + '</div>' : '');
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
      if (S.draw.gaokaoDone && S.flags.track !== 'voc' && S.flags.track !== 'tech' && S.flags.track !== 'none') {
        S.flags.schoolName = (D.schoolTracks[S.flags.track] || {}).name || S.flags.schoolName;
      }
      closeModal();
      if (S.stats.salary === 0 && S.age >= D.meta.gradAge) E.startWork(S);
      if (res.redo) {
        const n2 = Sim.nextNode(S);
        if (n2) { openNode(n2.node, filterOptions(n2.options)); return; }
      }
      afterStep();
      if (wantRun && !busy && !S.over) play(false);
    }, 1.5);
  }

  function openEvent(ev, done) {
    busy = true; pause();
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
      const cost = effectText(o.eff);
      b.innerHTML = '<div class="t"><span class="num">' + (i + 1) + '</span>' + o.label + '</div>' +
        (o.desc ? '<div class="h">' + o.desc + '</div>' : '') +
        (cost ? '<div class="cost">' + cost + '</div>' : '');
      b.onclick = function () {
        $$('.opt').forEach(function (x) { x.disabled = true; });
        const r = E.applyEvent(S, ev, i);
        (r.lines || []).forEach(function (l) { S.log.push({ age: S.age, kind: l.kind, text: l.text }); });
        renderAll();
        showResult(r.lines || [], function () {
          closeModal();
          if (done) done();
          if (wantRun && !busy && !S.over) play(false);
        }, 1.5);
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

  function showResult(lines, next, secs) {
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
    let advanced = false;
    let countdown = (typeof secs === 'number' ? secs : 1.5);
    let tick = null;
    const total = countdown;

    const go = function () {
      if (advanced) return;
      advanced = true;
      if (tick) { clearInterval(tick); tick = null; }
      btn.onclick = null;
      btn.textContent = '继续';
      next();
    };
    const render = function () {
      btn.textContent = '继续 · ' + Math.max(0, countdown).toFixed(1) + 's';
    };
    const start = function () {
      if (advanced || tick) return;
      tick = setInterval(function () {
        countdown -= 0.1;
        if (countdown <= 0) return go();
        render();
      }, 100);
    };
    const halt = function () { if (tick) { clearInterval(tick); tick = null; } };

    render();
    start();
    btn.onclick = go;

    // 鼠标停在弹窗上时暂停倒计时，方便读结果
    const sheet = document.querySelector('.sheet');
    if (sheet) {
      sheet.onmouseenter = halt;
      sheet.onmouseleave = function () { if (!advanced) start(); };
    }
    if (autoDecide) setTimeout(go, 600);
  }

  function closeModal() { $('#modal').hidden = true; busy = false; }

  // 自动抉择：把当前开着的弹窗按随机选项推走
  function autoResolveModal(delay) {
    setTimeout(function () {
      if (!autoDecide || $('#modal').hidden) return;
      const opts = $$('#m-options .opt').filter(function (b) { return !b.disabled; });
      if (opts.length) { opts[Math.floor(Math.random() * opts.length)].click(); return; }
      const next = $('#m-next');
      if (next && !next.hidden) next.click();
    }, delay || 500);
  }

  // ------------------------------------------------------------------ 结算
  function finish() {
    wantRun = false;
    pause();
    if (!S.over) { S.over = true; S.ending = E.evaluate(S); }
    S.over = true;
    const fresh = recordEnding((S.ending || {}).id || 'default');
    renderGallery();
    renderEnding(fresh);
    show('s-ending');
    localStorage.removeItem(KEY);
  }

  function renderEnding(fresh) {
    const en = S.ending || E.evaluate(S);
    const badge = $('#end-badge');
    if (badge) { badge.hidden = !fresh; }
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
    const T = themeColors();
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
      ctx.strokeStyle = T.light ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.09)'; ctx.lineWidth = 1; ctx.stroke();
    }
    vals.forEach(function (v, i) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / n);
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.strokeStyle = T.light ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.10)'; ctx.stroke();
      ctx.fillStyle = T.text3; ctx.font = '11px ui-monospace, monospace';
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
    ctx.save();
    ctx.globalAlpha = 0.16; ctx.fillStyle = T.accent; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = T.accent; ctx.lineWidth = 1.5; ctx.stroke();
  }

  function drawLifeline(cv, hist) {
    const c = setupCanvas(cv, Math.min(320, (cv.clientWidth || 640) * 0.5));
    const ctx = c.ctx, w = c.w, h = c.h;
    ctx.clearRect(0, 0, w, h);
    if (!hist.length) return;
    const T = themeColors();
    const pad = { l: 34, r: 34, t: 14, b: 22 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const ages = hist.map(function (x) { return x.age; });
    const a0 = ages[0], a1 = ages[ages.length - 1] || a0 + 1;
    const maxSalary = Math.max.apply(null, hist.map(function (x) { return x.salary; })) || 1;
    for (let i = 0; i <= 3; i++) {
      const y = pad.t + ih * i / 3;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y);
      ctx.strokeStyle = T.light ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.07)'; ctx.stroke();
      ctx.fillStyle = T.text3; ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'right';
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
    line(function (p) { return p.salary / maxSalary * 100; }, T.accent);
    line(function (p) { return p.health; }, T.green);
    line(function (p) { return p.spirit; }, T.blue);
    ctx.fillStyle = T.text3; ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'center';
    [a0, Math.round((a0 + a1) / 2), a1].forEach(function (a) { ctx.fillText(a + '岁', X(a), h - 6); });
    ctx.textAlign = 'right'; ctx.fillStyle = T.text3;
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

  // ------------------------------------------------------------------ 结局图鉴
  const GAL_KEY = 'gongwei.gallery.v1';
  function loadGallery() {
    try { return JSON.parse(localStorage.getItem(GAL_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveGallery(g) { try { localStorage.setItem(GAL_KEY, JSON.stringify(g)); } catch (e) {} }
  function recordEnding(id) {
    const g = loadGallery();
    g.endings = g.endings || {};
    const fresh = !g.endings[id];
    g.endings[id] = (g.endings[id] || 0) + 1;
    g.lives = (g.lives || 0) + 1;
    saveGallery(g);
    return fresh;
  }
  function renderGallery() {
    const g = loadGallery();
    const ids = g.endings || {};
    const n = Object.keys(ids).length;
    const box = $('#gal-grid');
    if (!box) return;
    box.innerHTML = D.endings.map(function (e) {
      const c = ids[e.id] || 0;
      return '<div class="gal-row' + (c ? ' got' : '') + '">' +
        '<div class="gk">' + (c ? e.name : '？？？') + '</div>' +
        '<div class="gv">' + (c ? e.line : '还没走到过这个结局') + '</div>' +
        '<div class="gn">' + (c ? '×' + c : '') + '</div></div>';
    }).join('');
    const cnt = $('#gal-count'); if (cnt) cnt.textContent = n + ' / ' + D.endings.length;
    const lives = $('#gal-lives'); if (lives) lives.textContent = (g.lives || 0);
    const btn = $('#btn-gallery');
    if (btn) btn.textContent = '结局图鉴 · ' + n + '/' + D.endings.length;
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
      if (!o || !o.draw || !o.draw.aptitude) { localStorage.removeItem(KEY); return false; }
      const rnd = E.mulberry32(1);
      rnd.setState(o.rndState || 1);
      o.rnd = rnd;
      S = o;
      if (!S.peers) S.peers = Sim.buildPeers(S.seed, 5);
      show('s-play');
      focusSel = isStudent() ? 'study' : 'career';
      renderAll();
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
      '我抽到了：' + S.draw.tier.name + ' · ' + S.draw.family.name + ' · ' + S.draw.industry.name + '\n' +
      '学历：' + S.draw.edu + (S.gaokaoScore ? '（高考 ' + S.gaokaoScore + ' 分）' : '') +
        (S.flags.zkRepeat ? ' · 中考复读一年' : '') + (S.flags.repeatedGk ? ' · 高考复读一年' : '') + '\n' +
      (S.flags.overrideDone && S.flags.parentChangedMajor ? '志愿被家里改过\n' : '') +
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

    applyTheme(currentTheme());
    $('#btn-theme').onclick = toggleTheme;
    if ($('#btn-theme-float')) $('#btn-theme-float').onclick = toggleTheme;

    $('#btn-play').onclick = function () { running ? stopPlay() : play(); };
    $('#btn-skip').onclick = skipToNode;
    $('#btn-auto').onclick = function () {
      autoDecide = !autoDecide;
      $('#btn-auto').classList.toggle('on', autoDecide);
      if (autoDecide) {
        // 弹窗已经打开时打开自动抉择，也要把它接走
        autoResolveModal(500);
        if (!busy && running) stepOnce();
      }
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
    const openGallery = function () { renderGallery(); $('#gallery').hidden = false; };
    const gal = $('#btn-gallery');
    if (gal) gal.onclick = openGallery;
    const gal2 = $('#btn-gallery2');
    if (gal2) gal2.onclick = openGallery;
    const galClose = $('#gallery-close');
    if (galClose) galClose.onclick = function () { $('#gallery').hidden = true; };
    const peerClose = $('#peer-close');
    if (peerClose) peerClose.onclick = function () { $('#peer').hidden = true; };
    renderGallery();

    document.querySelector('.stat-note').onclick = function () { this.classList.toggle('open'); };

    document.addEventListener('keydown', function (e) {
      // 弹窗里：数字选选项，空格 / 回车继续
      if (!$('#modal').hidden) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
          const next = $('#m-next');
          if (next && !next.hidden) { e.preventDefault(); next.click(); return; }
        }
        if (e.key >= '1' && e.key <= '9') {
          const opts = $$('#m-options .opt');
          const idx = parseInt(e.key, 10) - 1;
          if (opts[idx] && !opts[idx].disabled) { e.preventDefault(); opts[idx].click(); }
        }
        return;
      }
      if (!$('#about').hidden || !$('#gallery').hidden || !$('#peer').hidden) {
        if (e.key === 'Escape') {
          $('#about').hidden = true; $('#gallery').hidden = true; $('#peer').hidden = true;
        }
        return;
      }
      if (!$('#s-play').classList.contains('active')) return;
      if (e.code === 'Space') { e.preventDefault(); running ? stopPlay() : play(); return; }
      const order = isStudent() ? D.focusSchoolOrder : D.focusOrder;
      if (e.key >= '1' && e.key <= '6') {
        const id = order[parseInt(e.key, 10) - 1];
        const chip = $$('#chips .chip').find(function (c) { return c.dataset.id === id; });
        if (chip) chip.click();
      }
    });

    renderSources();
    if (hasSave()) $('#btn-load').hidden = false;
  }

  document.addEventListener('DOMContentLoaded', bind);
})();
