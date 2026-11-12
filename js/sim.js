/* 工位 — 无头模拟器（同秒 5 人 / 平衡性批量测试）
 */
(function () {
  const G = (typeof window !== 'undefined' ? window : globalThis);
  const GW = G.GW = G.GW || {};
  const D = GW.DATA, E = GW.Engine;
  const Sim = GW.Sim = {};

  function visibleOptions(node, S) {
    return node.options.map(function (o, i) { return { o: o, i: i }; }).filter(function (x) {
      if (x.o.show && !x.o.show(S)) return false;
      var sp = x.o.special || (x.o.eff && x.o.eff.special);
      if (S.flags.examFailed && (sp === 'exam' || sp === 'exam35')) return false;
      return true;
    });
  }
  Sim.visibleOptions = visibleOptions;

  // 某年龄应该弹出哪个节点（取最早未完成的、且 ≤ 当前年龄）
  Sim.nextNode = function (S) {
    // 18 岁那年自动出分：分数由学力 + 学校 + 家庭推出来，不是抽的
    if (S.age >= (S.flags.schoolEndAge || D.meta.schoolEnd) && !S.draw.gaokaoDone &&
      (S.flags.track === 'key' || S.flags.track === 'normal')) {
      GW.Engine.rollGaokao(S);
    }
    const list = (D.nodes || []).filter(function (n) { return !S.done[n.id] && n.age <= S.age; })
      .sort(function (a, b) { return a.age - b.age; });
    for (const n of list) {
      if (n.when && !n.when(S)) { S.done[n.id] = true; continue; }
      if (n.ready && !n.ready(S)) continue;   // 时机未到，不标记完成
      if (n.id === 'n19' && S.draw.edu !== '本科') { S.done[n.id] = true; continue; }
      const vis = visibleOptions(n, S);
      if (!vis.length) { S.done[n.id] = true; continue; }
      return { node: n, options: vis };
    }
    return null;
  };

  // 学生阶段自动选重心（批量模拟用）
  Sim.autoSchoolFocus = function (S, rnd) {
    const st = S.stats;
    const w = [];
    function add(id, wgt) { w.push({ id: id, w: Math.max(0.05, wgt) }); }
    add('study', 2.0 + (st.academic > 46 ? 1.2 : 0) + ((S.draw.family.help || 0) > 0.5 ? 0.6 : 0));
    add('cram', st.academic > 40 && st.cash > 45000 ? 1.3 : 0.1);
    add('play', 0.9 + (st.health < 55 ? 0.5 : 0));
    add('love', S.age >= 14 ? 0.9 : 0.1);
    add('earn', st.cash < 25000 ? 1.4 : 0.2);
    add('game', 0.7 + (st.spirit < 40 ? 0.9 : 0));
    let total = w.reduce(function (a, b) { return a + b.w; }, 0);
    let r = rnd() * total;
    for (const x of w) { r -= x.w; if (r <= 0) return x.id; }
    return 'study';
  };

  // 自动选重心：带一点偏好，但基本随机
  function autoFocus(S, rnd) {
    const st = S.stats;
    const w = [];
    function add(id, wgt) { w.push({ id: id, w: Math.max(0.2, wgt) }); }
    add('career', 2.2 + (st.skill < 50 ? 1 : 0));
    add('learn', 1.6 + (st.skill < 40 ? 1.5 : 0));
    add('network', 1.2 + (st.relation < 45 ? 1 : 0));
    add('health', 0.6 + (st.health < 55 ? 3 : 0));
    add('family', 0.8 + (S.flags.kids > 0 ? 1.5 : 0));
    add('side', 0.7 + (st.cash < 60000 ? 1.2 : 0));
    let total = w.reduce(function (a, b) { return a + b.w; }, 0);
    let r = rnd() * total;
    for (const x of w) { r -= x.w; if (r <= 0) return x.id; }
    return 'career';
  }
  Sim.autoFocus = autoFocus;

  Sim.autoPickNode = function (S, options, rnd) {
    // 避开明显亏的：优先有正收益的选项
    const scored = options.map(function (x) {
      const e = x.o.eff || {};
      const sm = e.salaryMul ? Math.max(-1.5, Math.min(1.5, (e.salaryMul - 1) * 22)) : 0;
      const cash = e.cash ? Math.max(-1.5, Math.min(1.5, e.cash / 60000)) : 0;
      const score = sm + cash +
        (e.acad || 0) * 0.28 + (e.skill || 0) * 0.2 + (e.health || 0) * 0.25 +
        (e.spirit || 0) * 0.2 + (e.relation || 0) * 0.1 +
        (x.o.special ? 0.3 : 0) + rnd() * 2.0;
      return { x: x, score: score };
    }).sort(function (a, b) { return b.score - a.score; });
    return scored[0].x;
  };

  // 跑完一生
  Sim.runLife = function (seed, opts) {
    opts = opts || {};
    const S = E.createLife(seed, opts.region);
    Sim.runFrom(S, opts);
    return S;
  };

  Sim.runFrom = function (S, opts) {
    opts = opts || {};
    const rnd = S.rnd;
    let guard = 0;
    while (!S.over && S.age < D.meta.retireAge && guard++ < 320) {
      const n = Sim.nextNode(S);
      if (n) {
        const pick = opts.random && rnd() < 0.7
          ? n.options[Math.floor(rnd() * n.options.length)]
          : Sim.autoPickNode(S, n.options, rnd);
        const res = E.applyNodeOption(S, n.node.id, pick.i);
        // 先入职再处理 redo，和浏览器端保持一致
        if (S.stats.salary === 0 && S.age >= D.meta.gradAge) E.startWork(S);
        if (res.redo) continue;
        if (res.jump) E.setAge(S, S.age + res.jump);
        if (S.over) break;
        if (res.reopen) continue;
        if (S.age < D.meta.gradAge && !S.done['n22']) continue;
        continue;
      }
      if (S.stats.salary === 0) {
        if (S.age < (S.flags.schoolEndAge || D.meta.schoolEnd)) {
          if (S.flags.track === 'none') {
            S.age = S.flags.schoolEndAge || D.meta.schoolEnd;
            S.year = (D.meta.startYear || 2026) + (S.age - D.meta.startAge);
            continue;
          }
          const sf = Sim.autoSchoolFocus(S, rnd);
          const so = E.stepSchoolYear(S, sf);
          if (so && so.event) E.applyEvent(S, so.event, Math.floor(rnd() * so.event.options.length));
          continue;
        }
        if (S.age < D.meta.gradAge) {
          S.age = D.meta.gradAge;
          S.year = (D.meta.startYear || 2026) + (S.age - D.meta.startAge);
          continue;
        }
        E.startWork(S);
      }
      const f = optsFocus(S, rnd);
      const out = E.stepYear(S, f);
      if (out && out.event) {
        const idx = Math.floor(rnd() * out.event.options.length);
        E.applyEvent(S, out.event, idx);
      }
    }
    if (!S.over) S.ending = E.finish(S);
    return S;
  };

  function optsFocus(S, rnd) { return Sim.autoFocus(S, rnd); }

  // 同秒 5 人：同一年入职的五个不同起点
  Sim.sameSecond = function (baseSeed, count) {
    const n = count || 5;
    const out = [];
    for (let i = 0; i < n; i++) {
      const S = Sim.runLife((baseSeed * 7 + i * 9176 + 13) >>> 0);
      out.push({
        seed: S.seed,
        draw: S.draw,
        ending: S.ending,
        metrics: E.metrics(S),
        curve: S.history.filter(function (h) { return h.age % 3 === 0; }).map(function (h) { return { age: h.age, salary: h.salary, health: h.health, spirit: h.spirit }; }),
      });
    }
    return out;
  };

  // 同一秒出生的人：各自跑一条完整人生，取每个年龄的状态
  Sim.buildPeers = function (seed, n) {
    const out = [];
    for (let i = 0; i < (n || 5); i++) {
      const s = Sim.runLife((seed * 31 + i * 7919 + 17) >>> 0, { random: true });
      out.push({
        seed: s.seed,
        identity: s.identity,
        draw: s.draw,
        ending: s.ending,
        flags: s.flags,
        stats: { cash: s.stats.cash, health: s.stats.health, spirit: s.stats.spirit, salary: s.stats.salary },
        statusLog: s.statusLog || {},
      });
    }
    return out;
  };

  // 批量（平衡测试用）
  Sim.batch = function (n, region) {
    const dist = {}, arr = [];
    for (let i = 0; i < (n || 300); i++) {
      const S = Sim.runLife((i * 2654435761) >>> 0, { region });
      const id = S.ending.id;
      dist[id] = (dist[id] || 0) + 1;
      arr.push(S);
    }
    return { dist, arr };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GW;
})();
