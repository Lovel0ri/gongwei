/* 工位 — 引擎
 * 纯函数式状态推进，不依赖 DOM，可在 node 里跑批量模拟。
 */
(function () {
  const G = (typeof window !== 'undefined' ? window : globalThis);
  const GW = G.GW = G.GW || {};
  const D = GW.DATA;

  const E = GW.Engine = {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round = (v, n) => { const p = Math.pow(10, n || 0); return Math.round(v * p) / p; };

  // ------------------------------------------------------------------ rng
  function mulberry32(a) {
    const f = function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    f.getState = function () { return a | 0; };
    f.setState = function (v) { a = v | 0; };
    return f;
  }
  E.mulberry32 = mulberry32;

  function pickWeighted(rnd, arr) {
    let total = 0;
    for (const it of arr) total += (it.weight || 0);
    let r = rnd() * total;
    for (const it of arr) { r -= (it.weight || 0); if (r <= 0) return it; }
    return arr[arr.length - 1];
  }
  E.pickWeighted = pickWeighted;

  // ------------------------------------------------------------------ 抽签
  E.createLife = function (seed, regionId) {
    const region = regionId || D.meta.region;
    const rnd = mulberry32(seed >>> 0);
    const pick = (arr) => pickWeighted(rnd, arr);

    const cityTier = pick(D.cityTiers[region]);
    const family = pick(D.families[region]);
    const score = pick(D.scores[region]);
    const major = pick(D.majors[region]);
    const industry = pick(D.industries[region]);
    const role = pick(D.roles[region]);
    const trait = pick(D.traits[region]);

    cityTier.salaryMul = 0.45 + 0.55 * cityTier.cost;

    const draw = {
      region,
      cityTier: cityTier.id,
      cityName: cityTier.samples[Math.floor(rnd() * cityTier.samples.length)],
      tier: cityTier,
      family,
      score,
      major,
      industry,
      role,
      trait,
      edu: score.edu,
    };

    const S = {
      seed,
      rnd,
      region,
      startYear: D.meta.startYear || 2026,
      age: D.meta.startAge,
      year: (D.meta.startYear || 2026) - D.meta.startAge,
      draw,
      stats: {
        salary: 0,
        cash: family.cash0,
        debt: 0,
        health: clamp(82 + (trait.health0 || 0) + (family.id === 'rural' ? -3 : 0), 40, 99),
        spirit: clamp(74 + family.spirit0 + (trait.spirit0 || 0), 25, 99),
        skill: clamp(10 + score.skill0 + (trait.skill0 || 0) + (score.elite ? 3 : 0), 1, 60),
        relation: clamp(30 + family.relation0 + (trait.relation0 || 0), 5, 80),
        hours: industry.hours,
        freedom: Math.round(168 - 56 - industry.hours - ({ t1: 8, t2: 6, t3: 5, t4: 4, t5: 3, t6: 3 }[cityTier.id] || 4) - 4),
      },
      fin: { living: 0, housing: 0, kid: 0, parents: 0, monthly: 0 },
      flags: { kids: 0, promotions: 0, jobChanges: 0, laidOff: 0 },
      done: {},
      history: [],
      log: [],
      ending: null,
      over: false,
      narr: [],
    };

    draw.salary0 = Math.round(
      6200 * cityTier.salaryMul *
      D.edus[draw.edu].mul *
      industry.mul *
      role.mul *
      (1 + (S.stats.skill - 20) / 400)
    );

    // ---- 身份：姓名、性别、父母
    const nm = D.names[region] || D.names.CN;
    const isF = rnd() < 0.48;
    const sn = nm.surname[Math.floor(rnd() * nm.surname.length)];
    const given = (isF ? nm.female : nm.male)[Math.floor(rnd() * (isF ? nm.female : nm.male).length)];
    const sn2 = nm.surname[Math.floor(rnd() * nm.surname.length)];
    const fatherGiven = nm.male[Math.floor(rnd() * nm.male.length)];
    const motherGiven = nm.female[Math.floor(rnd() * nm.female.length)];
    const jobs = (D.familyJobs[region] || D.familyJobs.CN)[family.id] || { father: '务工', mother: '务工' };
    const relOf = function () { return D.relStatus[Math.floor(rnd() * D.relStatus.length)]; };
    const siblings = rnd() < 0.52 ? 0 : (rnd() < 0.35 ? 2 : 1);
    S.identity = {
      name: sn[0] + given,
      gender: isF ? '女' : '男',
      birth: (2026 - 18) + ' 年 ' + (1 + Math.floor(rnd() * 12)) + ' 月',
      code: 'I<CN' + sn[1].toUpperCase() + '<<' + (isF ? 'F' : 'M') + '<<<<<<<<<<<<<<<<<<<',
      parents: [
        { role: '父亲', name: sn[0] + fatherGiven, age: 41 + Math.floor(rnd() * 9), job: jobs.father, rel: relOf() },
        { role: '母亲', name: sn2[0] + motherGiven, age: 38 + Math.floor(rnd() * 8), job: jobs.mother, rel: relOf() },
      ],
      siblings: siblings,
    };

    S.log.push({ age: 18, kind: 'birth', text: '你出生在' + cityTier.name + ' · ' + draw.cityName + '。家里是' + family.name + '。' });
    S.log.push({ age: 18, kind: 'birth', text: family.note + '。' });
    return S;
  };

  // ------------------------------------------------------------------ 每年数值
  function yearlyCosts(S) {
    const infl = Math.pow(1 + D.meta.inflation, S.age - D.meta.startAge);
    const cost = S.draw.tier.cost;
    const living = Math.max(2300 * cost * infl * 12, S.stats.salary * 0.30 * 12);
    let housing = 0;
    if (S.flags.house) housing = (S.mortgageMonthly || 0) * 12;
    else housing = S.draw.tier.rent * infl * 12 * (S.flags.partner ? 1.4 : (S.age < 30 ? 0.62 : 1));
    const kid = S.flags.kids * Math.min(3000 * cost * infl, Math.max(900, S.stats.salary * 0.32)) * 12;
    const parents = (S.age >= 45 || S.flags.parentsLive) ? 1200 * infl * 12 : 0;
    S.fin = { living: round(living), housing: round(housing), kid: round(kid), parents: round(parents) };
    S.fin.monthly = round((living + housing + kid + parents) / 12);
    return S.fin;
  }

  function annualIncome(S, sideIncome) {
    const ind = S.draw.industry;
    const bonusRate = 0.2 + ind.vol * 1.2 + (S.stats.relation > 60 ? 0.1 : 0);
    const gross = S.stats.salary * 12 * (1 + bonusRate * 0.5);
    const net = gross * (1 - D.meta.taxRate);
    return { gross, net, side: sideIncome || 0 };
  }

  // ------------------------------------------------------------------ 推进一年
  E.stepYear = function (S, focusId) {
    if (S.over) return { lines: [], event: null };
    const f = D.focus[focusId] || D.focus.career;
    const st = S.stats;
    const ind = S.draw.industry;
    const out = { lines: [], event: null, promoted: false, laid: false };

    S.year = (D.meta.startYear || 2026) + (S.age - D.meta.startAge);
    const age = S.age;

    // ---- 工时
    st.hours = clamp(ind.hours + f.hours + (age >= 45 ? -1 : 0), 28, 82);
    st.freedom = round(168 - 56 - st.hours - (S.draw.tier.id === 't1' ? 8 : S.draw.tier.id === 't2' ? 6 : 5) - 4, 0);

    // ---- 薪资成长
    const cycleAdj = 0.35 + ind.cycle * 0.95;
    const ageDecay = age < 30 ? 1 : age < 40 ? 0.85 : age < 50 ? 0.5 : 0.28;
    let growth = 0.033 * cycleAdj * ageDecay + f.growth;
    if (age >= 45) growth *= 0.55;
    if (S.flags.freelance) growth += 0.01;
    st.salary = Math.max(1200, st.salary * (1 + growth));

    // ---- 晋升
    const promoP = clamp(0.006 + st.relation / 1500 + st.skill / 1100 + (f.id === 'career' ? 0.025 : 0), 0.004, 0.08);
    if (age < 50 && age > 23 && S.rnd() < promoP) {
      st.salary *= 1.12;
      st.relation += 2;
      st.spirit += 4;
      S.flags.promotions++;
      out.promoted = true;
      out.lines.push({ age, kind: 'good', text: D.flavor.promotion[Math.floor(S.rnd() * D.flavor.promotion.length)] });
    }

    // ---- 裁员风险
    let layP = ind.layoff * 0.42 * (age >= 35 ? 1.7 : 1) * (st.skill < 38 ? 1.5 : 1) / cycleAdj;
    if (S.flags.manager) layP *= 1.2;
    if (S.flags.civil || S.draw.industry.id === 'gov') layP = 0.002;
    if (age < 57 && S.rnd() < layP) {
      st.salary *= 0.86;
      st.spirit -= 9;
      st.health -= 3;
      S.flags.laidOff++;
      S.flags.laidOffYear = S.year;
      out.laid = true;
      out.lines.push({ age, kind: 'bad', text: D.flavor.layoff[Math.floor(S.rnd() * D.flavor.layoff.length)] });
    }

    // ---- 副业 / 创业
    let side = 0;
    if (f.id === 'side' || S.flags.sideBusiness) {
      side = st.salary * 12 * (f.sideIncome || 0.05) * (S.flags.sideBusiness ? 1.6 : 1);
    }
    if (S.flags.startup) {
      st.salary = Math.max(3000, st.salary * 0.96);
      if (S.rnd() < 0.045) {
        st.cash += 1200000 + S.rnd() * 1500000;
        S.flags.bossExit = true; S.flags.startup = false;
        out.lines.push({ age, kind: 'good', text: '公司被收购了，你的股份变现了。你第一次在会议上说了"不"。' });
      } else if (S.rnd() < 0.10) {
        st.salary *= 0.85; st.spirit -= 4;
        out.lines.push({ age, kind: 'bad', text: '又一个月没发工资，你把自己的车卖了给团队发薪水。' });
      }
    }
    if (S.flags.freelance) {
      st.salary = Math.max(2500, st.salary * (0.97 + S.rnd() * 0.12));
      st.spirit += 0.8;
    }

    // ---- 收支（现金为负时自动消费降级）
    const cost = yearlyCosts(S);
    if (st.cash < 0) {
      cost.living *= 0.72; cost.kid *= 0.8; cost.parents *= 0.9;
      S.austerity = true;
    } else { S.austerity = false; }
    const inc = annualIncome(S, side);
    let miscRate = st.salary > 40000 ? 0.32 : st.salary > 20000 ? 0.24 : 0.18;
    if (S.flags.house) miscRate -= 0.05;
    if (st.cash < 0) miscRate = 0.10;
    const misc = st.salary * miscRate * 12;
    const netCash = inc.net + inc.side - (cost.living + cost.housing + cost.kid + cost.parents + misc);
    st.cash += netCash;
    if (st.cash < 0) { st.cash *= 1.04; }

    // 撑不住了：卖房
    if (st.cash < -180000 && S.flags.house) {
      const sell = Math.round((S.housePrice || 0) * (0.88 + S.rnd() * 0.12));
      st.cash += sell - st.debt;
      st.debt = 0; S.mortgageMonthly = 0;
      S.flags.house = false; S.flags.soldHouse = true;
      st.spirit -= 10;
      out.lines.push({ age, kind: 'bad', text: '你把房子挂出去了。成交价 ' + (sell / 10000).toFixed(0) + ' 万，比买的时候低了 ' + Math.max(0, Math.round(((S.housePrice || 0) - sell) / 10000)) + ' 万。中介说"这个行情，能出手就不错了"。' });
    }               // 借债利息

    // ---- 健康
    const ageExtra = age >= 55 ? 0.95 : age >= 45 ? 0.55 : age >= 35 ? 0.15 : 0;
    let dH = -0.06 - (st.hours - 45) * 0.035 - ageExtra * 0.75 + f.health;
    if (st.spirit < 25) dH -= 0.5;
    if (S.flags.kids > 0 && age < 40) dH -= 0.25;
    st.health = clamp(st.health + dH, 0, 100);

    // ---- 心气
    const mismatch = (1 - S.draw.major.match) * 0.55;
    const winter = ind.cycle < 0.5 ? 0.28 : 0;
    let dS = -0.05 + f.spirit - mismatch - winter + (st.hours > 58 ? 0.25 : 0) + (st.relation > 60 ? 0.2 : 0);
    if (S.flags.laidOff > 0) dS -= 0.2;
    st.spirit = clamp(st.spirit + dS, 0, 100);

    // ---- 能力 / 关系
    const ceil = (S.draw.role && S.draw.role.ceiling) || 70;
    let dK = 1.55 + f.skill * 0.9 + (age < 30 ? 0.7 : 0) - (age >= 45 ? 1.5 : age >= 40 ? 0.6 : 0);
    if (S.flags.freelance || S.flags.startup) dK += 0.5;
    dK *= clamp(1 - st.skill / (ceil + 8), 0, 1.15);
    st.skill = clamp(st.skill + dK, 0, 100);
    st.relation = clamp(st.relation - 0.55 + f.relation * (1 - st.relation / 130) + (st.skill > 70 ? 0.2 : 0), 0, 100);

    // ---- 状态快照（给同秒出生的人用）
    S.statusLog = S.statusLog || {};
    S.statusLog[age] = E.statusOf(S);

    // ---- 孩子（延后生育）
    if (S.flags.kidLater && age >= 35 && S.flags.kids === 0) {
      S.flags.kids = 1; S.flags.kidLater = false; st.cash -= 30000; st.health -= 3;
      out.lines.push({ age, kind: 'life', text: '35 岁这年，你们决定要了。产检、建档、托人找床位，一年就这么过去了。' });
    }

    // ---- 记录
    S.history.push({
      age, salary: round(st.salary), cash: round(st.cash), health: round(st.health, 1),
      spirit: round(st.spirit, 1), skill: round(st.skill, 1), relation: round(st.relation, 1),
      monthNet: round(netCash / 12),
    });

    // ---- 风味 / 危机提示
    if (st.health < 25 && S.rnd() < 0.5) out.lines.push({ age, kind: 'warn', text: D.flavor.lowHealth[Math.floor(S.rnd() * D.flavor.lowHealth.length)] });
    if (st.spirit < 20 && S.rnd() < 0.5) out.lines.push({ age, kind: 'warn', text: D.flavor.lowSpirit[Math.floor(S.rnd() * D.flavor.lowSpirit.length)] });
    if (out.lines.length === 0 && S.rnd() < 0.45) out.lines.push({ age, kind: 'flavor', text: D.flavor.tick[Math.floor(S.rnd() * D.flavor.tick.length)] });

    // ---- 随机事件
    const ev = E.rollEvent(S);
    if (ev) out.event = ev;

    // ---- 硬性终止
    if (st.health <= 0) { out.lines.push({ age, kind: 'bad', text: '你在工位上晕倒了。再醒来时，医生说的是"以后不能这样了"。' }); S.over = true; S.ending = E.evaluate(S, 'sick'); }
    else if (st.cash < -600000) { out.lines.push({ age, kind: 'bad', text: '银行打来第三个电话。你没有接。' }); S.over = true; S.ending = E.evaluate(S, 'debt'); }
    else if (st.spirit <= 0) { out.lines.push({ age, kind: 'bad', text: '你在某个周一早上没有起床，也没有请假。' }); S.over = true; S.ending = E.evaluate(S, 'burnout'); }

    S.age++;
    return out;
  };

  E.statusOf = function (S) {
    if (S.age < 22) return '上学';
    if (S.flags.civil) return '体制内';
    if (S.flags.startup) return '创业中';
    if (S.flags.freelance) return '自由职业';
    if (S.flags.laidOff && S.flags.laidOffYear === S.year) return '待业';
    return '工作';
  };

  // ------------------------------------------------------------------ 事件抽样
  E.rollEvent = function (S) {
    if (S.rnd() > 0.55) return null;
    const pool = D.events.filter(function (e) {
      if (S.done[e.id]) return false;
      if (e.ageMin && S.age < e.ageMin) return false;
      if (e.ageMax && S.age > e.ageMax) return false;
      if (e.need && !e.need(S)) return false;
      return true;
    });
    if (!pool.length) return null;
    return pickWeighted(S.rnd, pool);
  };

  // 事件选项生效
  E.applyEvent = function (S, ev, optIndex) {
    const o = ev.options[optIndex];
    if (!o) return { lines: [] };
    const st = S.stats;
    const eff = o.eff || {};
    const lines = [];

    if (eff.cash) { st.cash += eff.cash; lines.push({ age: S.age, kind: eff.cash < 0 ? 'money' : 'good', text: (eff.cash < 0 ? '支出 ¥' : '进账 ¥') + Math.abs(eff.cash).toLocaleString('zh-CN') }); }
    if (eff.salaryMul) { st.salary *= eff.salaryMul; }
    if (eff.health) st.health = clamp(st.health + eff.health, 0, 100);
    if (eff.spirit) st.spirit = clamp(st.spirit + eff.spirit, 0, 100);
    if (eff.skill) st.skill = clamp(st.skill + eff.skill, 0, 100);
    if (eff.relation) st.relation = clamp(st.relation + eff.relation, 0, 100);
    if (eff.industry) { const ind = (D.industries[S.region] || []).find(x => x.id === eff.industry); if (ind) S.draw.industry = ind; }
    if (eff.flags) Object.assign(S.flags, eff.flags);

    S.done[ev.id] = true;
    if (o.log) lines.push({ age: S.age, kind: 'event', text: o.log });
    return { lines };
  };

  // ------------------------------------------------------------------ 填志愿 / 专业
  E.applyMajorGroup = function (S, group) {
    const list = D.majors[S.region] || D.majors.CN;
    const byId = id => list.find(m => m.id === id);
    let m = null;
    if (group === 'hot') m = byId('cs') && (S.rnd() < 0.6 ? byId('cs') : byId('fin'));
    else if (group === 'safe') m = S.rnd() < 0.45 ? byId('edu') : S.rnd() < 0.6 ? byId('med') : byId('eng');
    else m = list[Math.floor(S.rnd() * list.length)];
    S.draw.major = m || list[0];
    S.stats.skill = clamp(S.stats.skill + (1 - S.draw.major.match) * -2, 0, 100);
    return S.draw.major;
  };

  // ------------------------------------------------------------------ 入职
  E.startWork = function (S) {
    S.stats.salary = S.draw.salary0;
    S.stats.hours = S.draw.industry.hours;
    return S.stats.salary;
  };

  // ------------------------------------------------------------------ 节点选项
  E.applyNodeOption = function (S, nodeId, optIndex) {
    const node = (D.nodes || []).find(n => n.id === nodeId);
    if (!node) return { lines: [] };
    const o = node.options[optIndex];
    if (!o) return { lines: [] };
    const st = S.stats;
    const eff = o.eff || {};
    const lines = [];
    const res = { lines, jump: 0, redo: null, finish: null };

    if (o.special) {
      const sp = o.special;
      if (sp === 'exam' || sp === 'exam35') {
        const base = sp === 'exam35' ? 0.10 : 0.10;
        const p = clamp(base + st.relation / 900 + st.skill / 900 + (S.draw.family.id === 'gov' ? 0.05 : 0) - (S.age - 22) * 0.006, 0.03, 0.42);
        if (S.rnd() < p) {
          S.draw.industry = (D.industries[S.region] || []).find(i => i.id === 'gov') || S.draw.industry;
          S.flags.civil = true;
          st.salary = Math.max(3200, Math.round(6200 * S.draw.tier.salaryMul * 0.92 * (S.age > 30 ? 1.15 : 1)));
          st.hours = 43;
          st.spirit = clamp(st.spirit + 16, 0, 100);
          st.health = clamp(st.health + 4, 0, 100);
          lines.push({ age: S.age, kind: 'good', text: '上岸了。你把消息发到家庭群，三分钟内有 11 条回复。' });
        } else {
          st.spirit -= 6;
          st.cash -= 6000;
          S.flags.examFailed = true;
          res.reopen = true;
          lines.push({ age: S.age, kind: 'bad', text: (sp === 'exam35' ? '年龄卡在最后一年，报名系统直接把你筛掉了。' : '笔试过了，面试差 0.8 分。你在考场外的台阶上坐了很久。') });
          return res;
        }
        S.done[nodeId] = true;
        return res;
      }
      if (sp === 'grad') {
        S.draw.edu = '硕士';
        st.skill = clamp(st.skill + 9, 0, 100);
        st.cash -= 30000;
        S.age = 24;
        res.jump = 2;
        res.redo = 'n22';
        lines.push({ age: 22, kind: 'life', text: '你考上了研究生。宿舍还是六人间，但你已经有白头发了。' });
        S.done['n22'] = false;
        return res;
      }
      if (sp === 'house_big' || sp === 'house_small') {
        const tier = S.draw.tier;
        let unitPrice = { t1: 58000, t2: 24000, t3: 14000, t4: 9000, t5: 6200, t6: 4000 }[tier.id] || 9000;
        const household = st.salary * (S.flags.partner ? 1.5 : 1.15);
        let price;
        if (sp === 'house_big') {
          price = Math.min(unitPrice * 95, household * 12 * 8);
        } else {
          unitPrice *= 0.62;
          st.salary *= 0.8;
          S.draw.tier = (D.cityTiers[S.region] || []).find(t => t.id === 't3') || tier;
          S.draw.tier.salaryMul = 0.45 + 0.55 * S.draw.tier.cost;
          S.draw.cityName = '省会';
          price = Math.min(unitPrice * 95, st.salary * 12 * 8);
        }
        const down = Math.round(price * 0.3);
        const help = Math.round((S.draw.family.help || 0) * 320000);
        const gap = Math.max(0, down - st.cash - help);
        st.cash -= Math.min(down, st.cash + help);
        if (gap > 0) { st.debt += gap; st.spirit -= 2; }
        const loan = price - down;
        const r = 0.049 / 12, n = 360;
        const monthly = Math.round(loan * r / (1 - Math.pow(1 + r, -n)));
        st.debt += loan;
        if (help > 0) lines.push({ age: S.age, kind: 'life', text: '首付里有 ¥' + (help / 10000).toFixed(0) + ' 万是父母出的。你妈说"别告诉你舅"。' });
        S.flags.house = true;
        S.housePrice = price;
        S.mortgageMonthly = monthly;
        lines.push({ age: S.age, kind: 'life', text: '首付 ¥' + (down / 10000).toFixed(0) + ' 万，贷款 ¥' + (loan / 10000).toFixed(0) + ' 万，月供 ¥' + monthly + '。签完字，你在售楼部门口抽了根烟。' });
        S.done[nodeId] = true;
        return res;
      }
      if (sp === 'kid') {
        S.flags.kids = 1;
        st.cash -= 25000;
        lines.push({ age: S.age, kind: 'life', text: '孩子出生了。你在产房外刷了一夜手机，朋友圈只发了三个字："她来了。"' });
        S.done[nodeId] = true;
        return res;
      }
      if (sp === 'freelance') {
        S.flags.freelance = true;
        st.salary *= 0.9;
        lines.push({ age: S.age, kind: 'life', text: '你递了辞职信。领导说"想清楚"，你说"想了三年"。' });
        S.done[nodeId] = true;
        return res;
      }
      if (sp === 'startup') {
        S.flags.startup = true;
        st.salary *= 0.42;
        st.cash -= 100000;
        lines.push({ age: S.age, kind: 'life', text: '你成了"联合创始人"，名片上印着 CXO，工资是每月 8000 的生活费。' });
        S.done[nodeId] = true;
        return res;
      }
      if (sp === 'retireEarly') {
        S.over = true;
        S.ending = E.evaluate(S, 'sick');
        lines.push({ age: S.age, kind: 'bad', text: '你办了病退。走出单位大门那天，阳光很好，你却觉得冷。' });
        S.done[nodeId] = true;
        return res;
      }
    }

    // 普通效果
    if (eff.cash) st.cash += eff.cash;
    if (eff.salaryMul) st.salary *= eff.salaryMul;
    if (eff.health) st.health = clamp(st.health + eff.health, 0, 100);
    if (eff.spirit) st.spirit = clamp(st.spirit + eff.spirit, 0, 100);
    if (eff.skill) st.skill = clamp(st.skill + eff.skill, 0, 100);
    if (eff.relation) st.relation = clamp(st.relation + eff.relation, 0, 100);
    if (eff.industry) { const ind = (D.industries[S.region] || []).find(i => i.id === eff.industry); if (ind) S.draw.industry = ind; }
    if (eff.flags) Object.assign(S.flags, eff.flags);
    if (o.jump) res.jump = o.jump;
    if (nodeId === 'n18' && o.id === 'any' && S.draw.score.id === 'sn') { S.draw.edu = '专科'; }
    if (eff.majorGroup) { const m = E.applyMajorGroup(S, eff.majorGroup); lines.push({ age: S.age, kind: 'life', text: '你被' + m.name + '专业录取。' + m.note + '。' }); }
    if (eff.earlyWork) { st.salary = Math.round(3200 * S.draw.tier.salaryMul); S.draw.edu = '高中'; res.jump = 4; res.skipTo22 = true; S.done['n19'] = true; S.done['n22'] = true; }
    if (eff.pivot) { st.spirit += 3; S.flags.pivotCount = (S.flags.pivotCount || 0) + 1; }

    S.done[nodeId] = true;
    if (nodeId === 'n18' && !res.jump) res.jump = (S.draw.edu === '本科' ? 1 : 4);
    if (o.log) lines.push({ age: S.age, kind: 'event', text: o.log });
    return res;
  };

  // ------------------------------------------------------------------ 结局
  E.evaluate = function (S, forceId) {
    const st = S.stats;
    const cash = st.cash;
    const picks = [];

    function pick(id) { const e = D.endings.find(x => x.id === id); return e || D.endings[0]; }

    if (forceId) return Object.assign({}, pick(forceId), { metrics: E.metrics(S) });

    let id = 'default';
    if (st.health <= 0) id = 'sick';
    else if (cash < -600000) id = S.flags.house ? 'debt' : 'debt2';
    else if (st.spirit <= 3) id = 'burnout';
    else if (S.flags.bossExit && cash > 1000000) id = 'boss';
    else if (cash > 2600000 && st.health < 40) id = 'burn';
    else if (cash > 520000 && st.health >= 45 && st.spirit >= 46) id = 'decent';
    else if (S.flags.pivotCount && st.spirit >= 60) id = 'restart';
    else if ((S.flags.manager || S.flags.expert) && st.spirit < 44) id = 'middle';
    else if (st.skill < 40 && cash < 320000) id = 'forgotten';
    else if (S.flags.freelance && st.spirit > 62) id = 'freelance';
    else if (cash > 100000 && st.health >= 50 && st.spirit >= 42) id = 'steady';

    return Object.assign({}, pick(id), { metrics: E.metrics(S) });
  };

  E.metrics = function (S) {
    const st = S.stats;
    const h = S.history[S.history.length - 1] || { salary: st.salary };
    return {
      cash: Math.round(st.cash),
      debt: Math.round(st.debt),
      salary: Math.round(st.salary),
      health: Math.round(st.health),
      spirit: Math.round(st.spirit),
      skill: Math.round(st.skill),
      relation: Math.round(st.relation),
      years: S.history.length,
      promotions: S.flags.promotions,
      layoffs: S.flags.laidOff,
      kids: S.flags.kids,
      pivots: S.flags.pivotCount || 0,
      house: !!S.flags.house,
      civil: !!S.flags.civil,
      manager: !!S.flags.manager,
    };
  };

  E.netWorth = function (S) {
    return Math.round(S.stats.cash + (S.flags.house ? (S.housePrice || 0) * 0.92 : 0) - S.stats.debt);
  };
  E.annualIncome = function (S) {
    return Math.round(S.stats.salary * 12 * 1.2);
  };

  E.finish = function (S) {
    if (S.over) return S.ending || E.evaluate(S);
    S.over = true;
    S.ending = E.evaluate(S);
    return S.ending;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GW;
})();
