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

  // 年龄是唯一的时间轴：所有跳跃都要同时改 year，否则顶栏/场景/存档会错位
  E.setAge = function (S, age) {
    S.age = age;
    S.year = (D.meta.startYear || 2026) + (age - D.meta.startAge);
  };

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

    const cityTier = Object.assign({}, pick(D.cityTiers[region]));
    const family = pick(D.families[region]);
    const aptitude = pick(D.aptitudes[region] || D.aptitudes.CN);
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
      aptitude,
      score: null,          // 18 岁高考出分后才填
      gaokaoScore: 0,
      major,
      industry,
      role,
      trait,
      edu: '初中',
    };

    const S = {
      seed,
      rnd,
      region,
      startYear: D.meta.startYear || 2026,
      age: D.meta.startAge,
      year: (D.meta.startYear || 2026),
      draw,
      stats: {
        salary: 0,
        cash: family.cash0,
        debt: 0,
        health: clamp(82 + (trait.health0 || 0) + (family.id === 'rural' ? -3 : 0), 40, 99),
        spirit: clamp(74 + family.spirit0 + (trait.spirit0 || 0), 25, 99),
        academic: clamp(34 + (aptitude.acad || 0) + (family.help || 0) * 7 + (rnd() - 0.5) * 6, 10, 72),
        skill: clamp(8 + (aptitude.acad || 0) * 0.3 + (trait.skill0 || 0), 1, 40),
        relation: clamp(30 + family.relation0 + (trait.relation0 || 0), 5, 80),
        hours: 48,
        freedom: 64,
      },
      fin: { living: 0, housing: 0, kid: 0, parents: 0, monthly: 0 },
      flags: { kids: 0, promotions: 0, jobChanges: 0, laidOff: 0, track: null },
      done: {},
      history: [],
      log: [],
      ending: null,
      over: false,
      narr: [],
    };

    draw.salary0 = 0;

    // 生活方式：默认是最普通的过法，玩家随时可以改
    S.life = Object.assign({}, (D.lifestyles && D.lifestyles.defaults) || {});
    S.flags.lastEventAge = D.meta.startAge - 1;

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
      birth: ((D.meta.startYear || 2026) - D.meta.startAge) + ' 年 ' + (1 + Math.floor(rnd() * 12)) + ' 月',
      code: 'I<CN' + sn[1].toUpperCase() + '<<' + (isF ? 'F' : 'M') + '<<<<<<<<<<<<<<<<<<<',
      parents: [
        { role: '父亲', name: sn[0] + fatherGiven, age: 41 + Math.floor(rnd() * 9), job: jobs.father, rel: relOf() },
        { role: '母亲', name: sn2[0] + motherGiven, age: 38 + Math.floor(rnd() * 8), job: jobs.mother, rel: relOf() },
      ],
      siblings: siblings,
    };

    S.log.push({ age: D.meta.startAge, kind: 'birth', text: '你出生在' + cityTier.name + ' · ' + draw.cityName + '。家里是' + family.name + '。' });
    S.log.push({ age: D.meta.startAge, kind: 'birth', text: family.note + '。' });
    return S;
  };

  // ------------------------------------------------------------------ 每年数值
  function yearlyCosts(S) {
    const infl = Math.pow(1 + D.meta.inflation, S.age - D.meta.startAge);
    const cost = S.draw.tier.cost;
    const living = Math.max(2300 * cost * infl * 12, S.stats.salary * 0.30 * 12);
    let housing = 0;
    if (S.flags.house) {
      housing = (S.mortgageMonthly || 0) * 12 +
        (S.flags.housePaid ? (S.housePrice || 0) * 0.002 : 0);
    } else housing = S.draw.tier.rent * infl * 12 * (S.flags.partner ? 1.4 : (S.age < 30 ? 0.62 : 1));
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

  // ------------------------------------------------------------------ 生活方式
  const LIFE = function () { return (D && D.lifestyles) || null; };
  E.lifeOption = function (S, dim) {
    const L = LIFE();
    if (!L || !L.dims[dim]) return null;
    const want = (S && S.life && S.life[dim]) || L.defaults[dim];
    const list = L.dims[dim].options;
    for (let i = 0; i < list.length; i++) if (list[i].id === want) return list[i];
    return list[0];
  };
  // 当前生活方式折算成每年（以及每周）的净影响，界面上直接显示这一份
  E.lifeTotals = function (S) {
    const t = { health: 0, spirit: 0, relation: 0, freedom: 0, misc: 0, cash: 0 };
    const L = LIFE();
    if (!L) return t;
    L.order.forEach(function (dim) {
      const o = E.lifeOption(S, dim);
      if (!o) return;
      t.health += o.health || 0;
      t.spirit += o.spirit || 0;
      t.relation += o.relation || 0;
      t.freedom += o.freedom || 0;
      t.misc += o.misc || 0;
      t.cash += o.cash || 0;
    });
    return t;
  };
  E.setLife = function (S, dim, id) {
    const L = LIFE();
    if (!L || !L.dims[dim]) return false;
    const ok = L.dims[dim].options.some(function (o) { return o.id === id; });
    if (!ok) return false;
    if (!S.life) S.life = Object.assign({}, L.defaults);
    S.life[dim] = id;
    return true;
  };

  // ------------------------------------------------------------------ 推进一年
  E.stepYear = function (S, focusId) {
    if (S.over) return { lines: [], event: null };
    const f = D.focus[focusId] || D.focus.career;
    const st = S.stats;
    const ind = S.draw.industry;
    const lt = E.lifeTotals(S);
    const out = { lines: [], event: null, promoted: false, laid: false };

    S.year = (D.meta.startYear || 2026) + (S.age - D.meta.startAge);
    const age = S.age;

    // ---- 工时
    st.hours = clamp(ind.hours + f.hours + (age >= 45 ? -1 : 0), 28, 82);
    st.freedom = round(168 - 56 - st.hours - (S.draw.tier.id === 't1' ? 8 : S.draw.tier.id === 't2' ? 6 : 5) - 4 + lt.freedom, 0);
    st.freedom = clamp(st.freedom, 0, 120);

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
    if (S.flags.twoHouses) inc.side += 1200 * 12 * Math.pow(1 + D.meta.inflation, S.age - D.meta.startAge);
    // 量入为出：没有房贷时，吃住行学不会超过到手收入的 78%。
    // 真实的人会搬到更远、吃得更省，而不是每个月凭空多欠一万。
    const essentials = cost.living + cost.housing + cost.kid + cost.parents;
    const capRatio = st.cash >= 0 ? 0.84 : 0.92;
    const capTotal = Math.max(inc.net + inc.side, 1) * capRatio;
    if (!S.flags.house && essentials > capTotal) {
      const k = capTotal / essentials;
      cost.living *= k; cost.housing *= k; cost.kid *= k; cost.parents *= k;
      S.fin = {
        living: Math.round(cost.living), housing: Math.round(cost.housing),
        kid: Math.round(cost.kid), parents: Math.round(cost.parents),
        monthly: Math.round((cost.living + cost.housing + cost.kid + cost.parents) / 12),
      };
    }
    let miscRate = st.salary > 40000 ? 0.32 : st.salary > 20000 ? 0.24 : 0.18;
    if (S.flags.house) miscRate -= 0.05;
    miscRate = clamp(miscRate + lt.misc, 0.05, 0.45);
    if (st.cash < 0) miscRate = Math.min(miscRate, 0.10);
    const misc = st.salary * miscRate * 12;
    // 生活方式的固定开销（健身卡、份子钱）：破产时先砍一半
    let lifeSpend = Math.max(0, -(lt.cash || 0));
    if (st.cash < 0) lifeSpend *= 0.5;
    S.fin.life = round(lifeSpend);
    const netCash = inc.net + inc.side - (cost.living + cost.housing + cost.kid + cost.parents + misc + lifeSpend);
    st.cash += netCash;
    if (st.cash < 0) { st.cash *= 1.04; }

    // 按揭：月供里有一部分是本金，逐年摊还；还清后不再扣月供
    if (S.flags.house && (S.mortgageLoan || 0) > 0) {
      const interest = S.mortgageLoan * 0.049;
      let principal = Math.max(0, (S.mortgageMonthly || 0) * 12 - interest);
      principal = Math.min(principal, S.mortgageLoan);
      S.mortgageLoan -= principal;
      st.debt = Math.max(0, st.debt - principal);
      if (S.mortgageLoan <= 1) {
        S.mortgageLoan = 0;
        S.mortgageMonthly = 0;
        S.flags.housePaid = true;
        out.lines.push({ age, kind: 'good', text: '房贷还完了。你在银行 App 上反复确认了三遍，然后什么也没说。' });
      }
    }

    // 撑不住了：卖房
    if (st.cash < -180000 && S.flags.house) {
      const sell = Math.round((S.housePrice || 0) * (0.88 + S.rnd() * 0.12));
      st.cash += sell - st.debt;
      st.debt = 0; S.mortgageMonthly = 0;
      S.flags.house = false; S.flags.soldHouse = true; S.flags.foreclosed = true;
      st.spirit -= 10;
      out.lines.push({ age, kind: 'bad', text: '你把房子挂出去了。成交价 ' + (sell / 10000).toFixed(0) + ' 万，比买的时候低了 ' + Math.max(0, Math.round(((S.housePrice || 0) - sell) / 10000)) + ' 万。中介说"这个行情，能出手就不错了"。' });
    }               // 借债利息

    // ---- 健康
    const ageExtra = age >= 55 ? 0.95 : age >= 45 ? 0.55 : age >= 35 ? 0.15 : 0;
    let dH = -0.06 - (st.hours - 45) * 0.035 - ageExtra * 0.75 + f.health + lt.health;
    if (st.spirit < 25) dH -= 0.5;
    if (S.flags.kids > 0 && age < 40) dH -= 0.25;
    st.health = clamp(st.health + dH, 0, 100);

    // ---- 心气
    const mismatch = (1 - S.draw.major.match) * 0.55;
    const winter = ind.cycle < 0.5 ? 0.28 : 0;
    let dS = -0.05 + f.spirit + lt.spirit - mismatch - winter + (st.hours > 58 ? 0.25 : 0) + (st.relation > 60 ? 0.2 : 0);
    if (S.flags.laidOff > 0) dS -= 0.2;
    st.spirit = clamp(st.spirit + dS, 0, 100);

    // ---- 能力 / 关系
    const ceil = (S.draw.role && S.draw.role.ceiling) || 70;
    let dK = 1.55 + f.skill * 0.9 + (age < 30 ? 0.7 : 0) - (age >= 45 ? 1.5 : age >= 40 ? 0.6 : 0);
    if (S.flags.freelance || S.flags.startup) dK += 0.5;
    dK *= clamp(1 - st.skill / (ceil + 8), 0, 1.15);
    st.skill = clamp(st.skill + dK, 0, 100);
    st.relation = clamp(st.relation - 0.55 + f.relation * (1 - st.relation / 130) + lt.relation + (st.skill > 70 ? 0.2 : 0), 0, 100);

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

    // ---- 生活方式的小痕迹：让玩家设的过法自己说话
    if (S.rnd() < 0.26 && D.flavor.life) {
      const dims = (D.lifestyles && D.lifestyles.order) || [];
      if (dims.length) {
        const dim = dims[Math.floor(S.rnd() * dims.length)];
        const o = E.lifeOption(S, dim);
        const pool = o && D.flavor.life[o.id];
        if (pool && pool.length) {
          out.lines.push({ age, kind: 'flavor', text: pool[Math.floor(S.rnd() * pool.length)] });
        }
      }
    }

    // ---- 随机事件
    const ev = E.rollEvent(S);
    if (ev) out.event = ev;

    // ---- 硬性终止
    if (st.health <= 0) { out.lines.push({ age, kind: 'bad', text: '你在工位上晕倒了。再醒来时，医生说的是"以后不能这样了"。' }); S.over = true; S.ending = E.evaluate(S, 'sick'); }
    else if (st.cash < -600000) {
      out.lines.push({ age, kind: 'bad', text: '银行打来第三个电话。你没有接。' });
      S.over = true;
      S.ending = E.evaluate(S, (S.flags.house || S.flags.foreclosed) ? 'debt' : 'debt2');
    }
    else if (st.spirit <= 0) { out.lines.push({ age, kind: 'bad', text: '你在某个周一早上没有起床，也没有请假。' }); S.over = true; S.ending = E.evaluate(S, 'burnout'); }

    E.setAge(S, S.age + 1);
    return out;
  };

  // ------------------------------------------------------------------ 学历 / 阶段文字
  E.eduText = function (S) {
    const t = S.flags.track;
    const endAge = S.flags.schoolEndAge || D.meta.schoolEnd || 18;
    if (S.age < 15) return '初中';
    if (S.flags.zkRepeat && !t) return '复读';
    if (S.age < endAge) {
      if (t === 'voc') return '职高';
      if (t === 'tech') return '中专';
      if (t === 'none') return '辍学';
      return '高中';
    }
    if (!S.draw.gaokaoDone && (t === 'key' || t === 'normal')) return '高中（复读）';
    if (S.flags.vocWork) return S.draw.edu + ' · 已工作';
    if (S.stats.salary === 0 && S.age < D.meta.gradAge) {
      return S.draw.edu === '本科' ? '大学在读' : (S.draw.edu === '专科' ? '大专在读' : S.draw.edu);
    }
    return S.draw.edu;
  };

  // ------------------------------------------------------------------ 高考出分（18 岁）
  // 分数不是抽的，是初中 + 高中六年攒出来的，再叠一点运气和家庭。
  E.rollGaokao = function (S) {
    if (S.draw.gaokaoDone) return S.draw.score;
    const track = D.schoolTracks[S.flags.track] || D.schoolTracks.normal;
    const st = S.stats;
    let base = st.academic + (track.bonus || 0) +
      ((S.draw.family.help || 0) - 0.5) * 8 + (st.spirit - 50) * 0.12;
    if (S.flags.stream === 'sci') base += 2;
    if (S.flags.stream === 'art') base -= 1;
    if (S.flags.spec) base += 7;
    S.flags.gaokaoAttempt = (S.flags.gaokaoAttempt || 0) + 1;
    // 复读不是保底：有人涨 50 分，也有人第二年更慌
    if (S.flags.repeatedGk && S.flags.gaokaoAttempt >= 2) base += (S.rnd() < 0.22 ? -7 : 5);
    base += (S.rnd() - 0.5) * 12;
    base = clamp(base, 4, 99);
    const list = D.scores[S.region] || D.scores.CN;
    let pick = list[list.length - 1];
    for (let i = 0; i < list.length; i++) {
      if (base >= (list[i].min || 0)) { pick = list[i]; break; }
    }
    if (S.flags.spec && (pick.id === 'sn' || pick.id === 'sz')) pick = list[2];
    S.draw.score = pick;
    S.draw.edu = pick.edu;
    S.draw.gaokaoDone = true;
    S.gaokaoBase = round(base, 1);
    S.gaokaoScore = Math.round(clamp(150 + base * 6, 180, 750));
    S.log.push({ age: S.age, kind: 'life', text: '高考出分：' + S.gaokaoScore + ' 分，' + pick.name + '。' });
    return pick;
  };

  // ------------------------------------------------------------------ 学生阶段（13–17）
  E.stepSchoolYear = function (S, focusId) {
    if (S.over) return { lines: [], event: null };
    const st = S.stats;
    const f = (D.focusSchool && D.focusSchool[focusId]) || D.focusSchool.study;
    const lt = E.lifeTotals(S);
    const out = { lines: [], event: null };
    const age = S.age;
    S.year = (D.meta.startYear || 2026) + (S.age - D.meta.startAge);
    const track = S.flags.track ? D.schoolTracks[S.flags.track] : null;
    const inHigh = S.age >= 15 && !!track;

    // 成绩
    let gain = f.acad || 0;
    if (inHigh) gain *= (track.acad || 1);
    gain *= clamp(1 - st.academic / 126, 0, 1.2);
    if (S.draw.aptitude && S.draw.aptitude.late && S.age >= 14) gain *= 1.5;
    if (S.flags.boarding) gain += 0.3;
    st.academic = clamp(st.academic + gain, 0, 100);

    // 生活方式在学生阶段只打八折：住家里，作息和花销都不完全由自己
    st.health = clamp(st.health + (f.health || 0) + lt.health * 0.8 - 0.15, 8, 100);
    st.spirit = clamp(st.spirit + (f.spirit || 0) + lt.spirit * 0.8, 6, 100);
    st.relation = clamp(st.relation + (f.relation || 0) + lt.relation * 0.8 - 0.1, 0, 100);
    st.skill = clamp(st.skill + (f.skill || 0), 0, 100);

    // 时间：上课 + 作业 + 通勤
    const load = { study: 50, cram: 60, play: 42, love: 45, earn: 56, game: 44 }[f.id] || 48;
    st.hours = load;
    st.freedom = Math.round(168 - 56 - load + lt.freedom);

    // 钱：学费生活费，打工/帮家里补一点。学生阶段不背债。
    const cost = Math.round((inHigh ? (track.cost || 3000) : 1500) * (S.draw.tier.cost || 1));
    const lifeCost = Math.round(Math.max(0, -(lt.cash || 0)) * 0.3);
    st.cash += (f.cash || 0) - cost - lifeCost;
    if (st.cash < -60000) st.cash = -60000;
    S.fin = S.fin || {};
    S.fin.schoolCost = cost + lifeCost - (f.cash || 0);
    S.fin.life = lifeCost;

    S.history.push({
      age: age, salary: 0, cash: Math.round(st.cash), health: round(st.health, 1),
      spirit: round(st.spirit, 1), skill: round(st.skill, 1), relation: round(st.relation, 1),
      monthNet: 0, academic: round(st.academic, 1),
    });
    S.statusLog = S.statusLog || {};
    S.statusLog[age] = E.statusOf(S);

    if (st.academic < 25 && S.rnd() < 0.5) {
      out.lines.push({ age: age, kind: 'warn', text: '你的排名一直贴在教室后墙的倒数十个里。老师说"再这样，普高都悬"。' });
    }
    if (st.spirit < 22 && S.rnd() < 0.6) {
      out.lines.push({ age: age, kind: 'warn', text: '你开始找各种理由不去上学。你妈以为你只是懒。' });
    }
    if (out.lines.length === 0 && S.rnd() < 0.55) {
      out.lines.push({ age: age, kind: 'flavor', text: D.flavor.school[Math.floor(S.rnd() * D.flavor.school.length)] });
    }

    const ev = E.rollEvent(S);
    if (ev) out.event = ev;

    E.setAge(S, S.age + 1);
    return out;
  };

  E.statusOf = function (S) {
    const endAge = S.flags.schoolEndAge || D.meta.schoolEnd || 18;
    if (S.age < 15) return '初中';
    if (S.flags.zkRepeat && !S.flags.track) return '复读';
    if (S.age < endAge) return S.flags.track === 'voc' ? '职高' : S.flags.track === 'tech' ? '中专' : S.flags.track === 'none' ? '打工' : '高中';
    if (S.age < D.meta.gradAge && S.stats.salary === 0 && !S.flags.vocWork) {
      if (S.draw.edu === '专科') return '大专';
      if (S.flags.track === 'voc' || S.flags.track === 'tech' || S.flags.track === 'none') return '打工';
      return '大学';
    }
    if (S.flags.civil) return '体制内';
    if (S.flags.startup) return '创业中';
    if (S.flags.freelance) return '自由职业';
    if (S.flags.laidOff && S.flags.laidOffYear === S.year) return '待业';
    return '工作';
  };

  // ------------------------------------------------------------------ 事件抽样
  // 事件不是每年都有：先看冷却，再看概率。弹出得太密会变成"填空题"。
  E.rollEvent = function (S) {
    const meta = D.eventsMeta || {};
    const youth = S.age < 19;
    const minGap = youth ? (meta.minGapSchool || 2) : (meta.minGapAdult || 3);
    const chance = youth ? (meta.chanceSchool || 0.5) : (meta.chanceAdult || 0.42);
    const last = (typeof S.flags.lastEventAge === 'number') ? S.flags.lastEventAge : (D.meta.startAge - minGap);
    if (S.age - last < minGap) return null;
    if (S.rnd() > chance) return null;
    const pool = D.events.filter(function (e) {
      if (S.done[e.id]) return false;
      if (e.ageMin && S.age < e.ageMin) return false;
      if (e.ageMax && S.age > e.ageMax) return false;
      if (e.need && !e.need(S)) return false;
      return true;
    });
    if (!pool.length) return null;
    const ev = pickWeighted(S.rnd, pool);
    S.flags.lastEventAge = S.age;
    return ev;
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
    if (eff.acad) st.academic = clamp(st.academic + eff.acad, 0, 100);
    if (eff.relation) st.relation = clamp(st.relation + eff.relation, 0, 100);
    if (eff.industry) { const ind = (D.industries[S.region] || []).find(x => x.id === eff.industry); if (ind) S.draw.industry = ind; }
    if (eff.flags) Object.assign(S.flags, eff.flags);

    S.done[ev.id] = true;
    S.flags.lastEventAge = S.age;
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
    else if (group === 'art') m = byId('art');
    else m = list[Math.floor(S.rnd() * list.length)];
    S.draw.major = m || list[0];
    S.draw.majorGroup = group;
    S.stats.skill = clamp(S.stats.skill + (1 - S.draw.major.match) * -2, 0, 100);
    return S.draw.major;
  };

  // ------------------------------------------------------------------ 入职
  E.salary0 = function (S) {
    const d = S.draw;
    const edu = D.edus[d.edu] || D.edus['高中'];
    return Math.round(6200 * (d.tier.salaryMul || 1) * edu.mul * d.industry.mul * d.role.mul *
      (1 + (S.stats.skill - 20) / 400));
  };
  // 行业和岗位在出生时就定了，但直到第一份工作才揭晓
  E.revealIndustry = function (S) {
    if (S.flags.industryRevealed) return;
    S.flags.industryRevealed = true;
    S.log.push({
      age: S.age, kind: 'life',
      text: '你入行了：' + S.draw.industry.name + ' · ' + S.draw.role.name + '。' + S.draw.industry.note + '。',
    });
  };
  E.startWork = function (S) {
    const st = S.stats;
    const s0 = E.salary0(S);
    if (!st.salary) st.salary = s0;
    st.hours = S.draw.industry.hours;
    S.draw.salary0 = st.salary;
    E.revealIndustry(S);
    return st.salary;
  };

  // 普通选项效果（special 选项也要先结这一层）
  function applyPlain(S, eff) {
    if (!eff) return;
    const st = S.stats;
    if (eff.cash) st.cash += eff.cash;
    if (eff.salaryMul) st.salary *= eff.salaryMul;
    if (eff.health) st.health = clamp(st.health + eff.health, 0, 100);
    if (eff.spirit) st.spirit = clamp(st.spirit + eff.spirit, 0, 100);
    if (eff.skill) st.skill = clamp(st.skill + eff.skill, 0, 100);
    if (eff.acad) st.academic = clamp(st.academic + eff.acad, 0, 100);
    if (eff.relation) st.relation = clamp(st.relation + eff.relation, 0, 100);
    if (eff.industry) {
      const ind = (D.industries[S.region] || []).find(x => x.id === eff.industry);
      if (ind) S.draw.industry = ind;
    }
    if (eff.flags) Object.assign(S.flags, eff.flags);
  }

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

    // 兼容两种写法：special 写在选项上，或写在 eff 里（旧数据是后者）
    const sp = o.special || (eff && eff.special) || null;
    // 22 岁第一份工作：先把起薪落地，选项上的 salaryMul 才有地方乘
    if (nodeId === 'n22' && !st.salary) E.startWork(S);
    // special 分支会提前 return，先把普通代价结了，UI 上的"明码标价"才是真的
    if (sp) applyPlain(S, eff);
    if (sp) {
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
          st.spirit = clamp(st.spirit - 6, 0, 100);
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
        st.salary = 0;
        E.setAge(S, 24);
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
          const t3 = (D.cityTiers[S.region] || []).find(t => t.id === 't3');
          S.draw.tier = t3 ? Object.assign({}, t3) : tier;
          S.draw.tier.salaryMul = 0.45 + 0.55 * S.draw.tier.cost;
          S.draw.cityName = '省会';
          price = Math.min(unitPrice * 95, st.salary * 12 * 8);
        }
        const down = Math.round(price * 0.3);
        const help = Math.round((S.draw.family.help || 0) * 320000);
        const cashAvail = Math.max(0, st.cash);
        const fromParents = Math.min(help, Math.max(0, down - cashAvail));
        const fromCash = Math.min(Math.max(0, down - fromParents), cashAvail);
        st.cash -= fromCash;
        const gap = Math.max(0, down - fromCash - fromParents);
        if (gap > 0) { st.debt += gap; st.spirit = clamp(st.spirit - 2, 0, 100); }
        const loan = price - down;
        const r = 0.049 / 12, n = 360;
        const monthly = Math.round(loan * r / (1 - Math.pow(1 + r, -n)));
        st.debt += loan;
        S.mortgageLoan = loan;
        if (fromParents > 0) lines.push({ age: S.age, kind: 'life', text: '首付里有 ¥' + (fromParents / 10000).toFixed(0) + ' 万是父母出的。你妈说"别告诉你舅"。' });
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
        S.flags.freelanceYear = S.year;
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
      // ---- 复读：中考
      if (sp === 'repeat_zk') {
        const fee = 9000;
        st.cash -= fee;
        st.spirit = clamp(st.spirit - 6, 0, 100);
        st.health = clamp(st.health - 2, 0, 100);
        st.academic = clamp(st.academic + 5 + S.rnd() * 2, 0, 100);
        E.setAge(S, S.age + 1);
        S.flags.zkRepeat = true;
        S.flags.schoolName = '中考复读班';
        S.flags.schoolEndAge = (D.meta.schoolEnd || 18) + 1;
        S.done[nodeId] = false;
        res.redo = nodeId;
        lines.push({ age: S.age, kind: 'life', text: '你去了县城的复读学校，一年 ' + (fee / 10000).toFixed(1) + ' 万。教室在四楼，墙上贴着上一届的分数。' });
        lines.push({ age: S.age, kind: 'life', text: '一年后，你又坐进了中考考场。这次你妈没在门口站着。' });
        return res;
      }
      // ---- 复读：高考
      if (sp === 'repeat_gk') {
        const fee = 25000;
        st.cash -= fee;
        st.spirit = clamp(st.spirit - 8, 0, 100);
        st.health = clamp(st.health - 3, 0, 100);
        st.academic = clamp(st.academic + 7, 0, 100);
        E.setAge(S, S.age + 1);
        S.flags.repeatedGk = true;
        S.draw.gaokaoDone = false;
        S.draw.score = null;
        S.gaokaoScore = 0;
        S.done[nodeId] = false;
        res.redo = nodeId;
        lines.push({ age: S.age, kind: 'life', text: '你交了 2.5 万复读费，回到一个和高中差不多的地方，只是同学都不认识。' });
        lines.push({ age: S.age, kind: 'life', text: '这一年你瘦了 8 斤。第二次进考场，你在草稿纸上写了"最后一次"。' });
        return res;
      }
      // ---- 志愿被家长改掉
      if (sp === 'override_obey' || sp === 'override_fight' || sp === 'override_teacher') {
        const pref = S.flags.parentOverride || 'safe';
        const jump = (S.draw.edu === '本科' ? 1 : 4);
        const applyParent = function () {
          const m = E.applyMajorGroup(S, pref);
          S.flags.parentChangedMajor = true;
          lines.push({ age: S.age, kind: 'life', text: '专业定成了' + m.name + '。' + m.note + '。' });
        };
        if (sp === 'override_obey') {
          applyParent();
          st.relation = clamp(st.relation + 5, 0, 100);
          st.spirit = clamp(st.spirit - 7, 0, 100);
          lines.push({ age: S.age, kind: 'event', text: '你把表交了上去，一个字没改。你爸那天晚饭多喝了一杯，说"懂事"。' });
        } else {
          const cost = sp === 'override_teacher' ? 8000 : 0;
          st.cash -= cost;
          const p = sp === 'override_teacher' ? 0.72 : 0.5;
          if (S.rnd() < p) {
            st.spirit = clamp(st.spirit + 8, 0, 100);
            st.relation = clamp(st.relation - (cost ? 4 : 9), 0, 100);
            lines.push({
              age: S.age, kind: 'good',
              text: cost
                ? '班主任给你爸打了四十分钟电话，最后说通了。你把志愿改回了自己填的那个。'
                : '你在截止前十分钟改了回去。你爸到现在都不知道。',
            });
          } else {
            applyParent();
            st.relation = clamp(st.relation - 12, 0, 100);
            st.spirit = clamp(st.spirit - 4, 0, 100);
            lines.push({ age: S.age, kind: 'bad', text: '你改的时候被你妈看见了。她把手机摔在桌上，说"你翅膀硬了"。志愿最后还是按他们的填了。' });
          }
        }
        S.flags.parentOverride = null;
        S.flags.overrideDone = true;
        S.done[nodeId] = true;
        res.jump = jump;
        return res;
      }
    }

    // 普通效果（special 已在上方结过）
    if (!sp) applyPlain(S, eff);
    if (eff.spec) S.flags.spec = true;
    if (eff.track) {
      S.flags.track = eff.track;
      if (eff.track === 'voc' || eff.track === 'tech') S.draw.edu = '高中';
      if (eff.track === 'none') S.draw.edu = '初中';
      S.flags.schoolName = (D.schoolTracks[eff.track] || {}).name || '';
    }
    if (eff.edu) S.draw.edu = eff.edu;
    if (eff.startSalary) {
      st.salary = Math.round(eff.startSalary * (S.draw.tier.salaryMul || 1));
      S.draw.salary0 = st.salary;
      st.hours = S.draw.industry.hours;
      E.revealIndustry(S);
    }
    if (eff.vocWork) {
      S.flags.vocWork = true;
      S.done['n19'] = true;
      S.done['n22'] = true;
    }
    if (o.jump) res.jump = o.jump;
    if (nodeId === 'n18' && o.id === 'any' && S.draw.score.id === 'sn') { S.draw.edu = '专科'; }
    if (nodeId === 'n18v') res.jump = (o.id === 'up' ? 3 : 0);
    if (eff.majorGroup) { const m = E.applyMajorGroup(S, eff.majorGroup); lines.push({ age: S.age, kind: 'life', text: '你被' + m.name + '专业录取。' + m.note + '。' }); }
    // 家长可能把志愿改掉：概率看家庭，改的方向看家长的偏好
    if (nodeId === 'n18' && eff.majorGroup && !S.flags.overrideDone && !S.flags.parentOverride) {
      const fam = S.draw.family;
      const pref = fam.pref || 'safe';
      if (S.draw.majorGroup !== pref) {
        const p = clamp((fam.interfere || 0.3) + (st.relation > 60 ? 0.06 : 0) - (st.spirit > 70 ? 0.05 : 0), 0.05, 0.7);
        if (S.rnd() < p) {
          S.flags.parentOverride = pref;
          S.flags.playerGroup = S.draw.majorGroup;
          S.flags.overrideDone = false;
          S.done['n18p'] = false;
          res.redo = 'n18p';
        }
      }
    }
    if (eff.earlyWork) {
      st.salary = Math.round(3200 * S.draw.tier.salaryMul);
      S.draw.edu = '高中';
      S.done['n19'] = true;
      S.done['n22'] = true;
      st.hours = S.draw.industry.hours;
      E.revealIndustry(S);
    }
    if (eff.pivot) {
      st.spirit = clamp(st.spirit + 3, 0, 100);
      S.flags.pivotCount = (S.flags.pivotCount || 0) + 1;
    }

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
    else if (cash < -600000) id = (S.flags.house || S.flags.foreclosed) ? 'debt' : 'debt2';
    else if (st.spirit <= 3) id = 'burnout';
    else if (S.flags.bossExit && cash > 1000000) id = 'boss';
    else if (cash > 2600000 && st.health < 40) id = 'burn';
    else if (cash > 520000 && st.health >= 45 && st.spirit >= 46) id = 'decent';
    else if ((S.flags.pivotCount || 0) >= 2 && st.spirit >= 58) id = 'restart';
    else if ((S.flags.manager || S.flags.expert) && st.spirit < 44) id = 'middle';
    else if (st.skill < 55 && cash < 260000 && !S.flags.manager && !S.flags.expert) id = 'forgotten';
    else if (S.flags.freelance && st.spirit > 62 &&
      (S.year - (S.flags.freelanceYear || 0)) >= 6) id = 'freelance';
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
      years: Math.max(0, S.age - D.meta.startAge),
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
    return Math.round(
      S.stats.cash +
      (S.flags.house ? (S.housePrice || 0) * 0.92 : 0) +
      (S.flags.twoHouses ? 300000 : 0) -
      S.stats.debt
    );
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
