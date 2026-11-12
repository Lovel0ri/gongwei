/* 工位 — 人生节点（岔路）
 * 每个节点只提问，不解答。选项各自明码标价。
 * when(S) 为假的节点会被静默跳过（不算一次抉择）。
 * special 由 engine 处理：exam / exam35 / house / kid / move / startup / freelance / retireEarly
 */
(function () {
  const G = (typeof window !== 'undefined' ? window : globalThis);
  const GW = G.GW = G.GW || {};
  const D = GW.DATA = GW.DATA || {};

  D.nodes = [
    // ------------------------------------------------------------ 13
    {
      id: 'n13', age: 13, title: '初一开学',
      scene: function (S) {
        const f = S.draw.family.id;
        const head = S.draw.tier.id === 't6' || S.draw.tier.id === 't5'
          ? '镇上的初中，一个年级四个班，操场是一块压平的土地。'
          : '按片区分的初中，走路二十分钟，路过后门那家文具店。';
        const tail = f === 'rural' ? '你爸妈在外地，开学是奶奶陪你去的，她在教室门口站了很久。'
          : f === 'migrant' ? '你妈在电话里说"要听老师话"，然后信号就断了。'
          : f === 'gov' || f === 'mid' ? '你妈已经在打听哪个班主任带得好、哪个班是"重点班"。'
          : '开学第一天，班主任让每个人上台说自己的名字和爱好，你说了"没有"。';
        return head + tail + '教室后排靠窗的位置空着，你坐了过去。';
      },
      options: [
        {
          id: 'study', label: '从第一次月考就开始认真', hint: '成绩↑ 心气↓',
          eff: { acad: 5, spirit: -2, health: -1 },
          log: '你把练习册的答案撕了，说"我自己做"。第一次月考，你从第 31 名到了第 12 名。',
        },
        {
          id: 'chill', label: '先玩两年，反正中考还早', hint: '心气↑ 成绩↓',
          eff: { spirit: 4, acad: -4, health: 1 },
          log: '你信了"初中前两年不重要"这句话。说这话的人，后来考上了重点高中。',
        },
        {
          id: 'gang', label: '跟班上有名的那几个混', hint: '关系↑ 成绩↓',
          eff: { relation: 6, acad: -2, spirit: 2 },
          log: '你开始知道谁不能惹、哪条巷子放学不能走。这些知识考试不考。',
        },
        {
          id: 'board', label: '家里托人，送你去县里寄宿', hint: '成绩↑ 花钱↓ 关系↓',
          show: function (S) { return S.stats.cash >= 20000; },
          eff: { cash: -12000, acad: 3, relation: -3, spirit: -2, flags: { boarding: true } },
          log: '你妈塞给中间人两条烟，说"孩子就拜托了"。宿舍十个人，热水只有半小时。',
        },
        {
          id: 'earnHome', label: '放学先回家干活 / 看店', hint: '钱↑ 成绩↓',
          show: function (S) { return ['rural', 'migrant', 'biz'].indexOf(S.draw.family.id) >= 0; },
          eff: { cash: 8000, acad: -1, relation: 2, health: -1 },
          log: '你学会了称重、找零、把烂的那箱先摆出去。作业是晚上十点以后写的。',
        },
      ],
    },

    // ------------------------------------------------------------ 15
    {
      id: 'n15', age: 15, title: '中考出分',
      scene: function (S) {
        const sc = S.stats.academic;
        const score = Math.round(Math.max(210, Math.min(745, 300 + sc * 4.6)));
        const tone = sc >= 62 ? '分数够上县一中，班主任在办公室门口拍了下你的肩。'
          : sc >= 44 ? '分数不上不下。老师说"你这个分，能上普高，也可以考虑职高"。'
          : sc >= 30 ? '分数只够职高。你妈说"学门手艺也好"，说完自己先低了头。'
          : '分数出来那天，家里没有开灯。你爸抽了半包烟，说"读不读，你自己决定"。';
        return '中考 ' + score + ' 分。' + tone + '班级群里开始有人晒录取通知，没人 @ 你。';
      },
      options: [
        {
          id: 'key', label: '重点高中', hint: '成绩↑ 心气↑ 三年很贵',
          show: function (S) { return S.stats.academic >= 44; },
          eff: { track: 'key', acad: 2, spirit: 4, relation: 2 },
          log: '你进了重点高中。开学第一周你就明白了：这里的人，初中就已经在学高中的课。',
        },
        {
          id: 'keyBuy', label: '交择校费，挤进重点高中', hint: '花钱买一个更硬的池子',
          show: function (S) { return S.stats.academic >= 36 && S.stats.academic < 44 && S.stats.cash >= 30000; },
          eff: { cash: -30000, track: 'key', acad: 1, spirit: -1 },
          log: '你妈交了 3 万择校费，收据夹在户口本里。你在班里排第 49，全班 50 人。',
        },
        {
          id: 'normal', label: '普通高中', hint: '本科率挂在门口，一年比一年短',
          show: function (S) { return S.stats.academic >= 28; },
          eff: { track: 'normal', acad: 1 },
          log: '你上了普高。班主任第一次开班会就说："我们学校，能上本科的是少数。"',
        },
        {
          id: 'voc', label: '职业高中，学门技术', hint: '换个池子，也换一套考卷',
          show: function (S) { return S.stats.academic < 40; },
          eff: { track: 'voc', spirit: -2, relation: -1, health: 1 },
          log: '你去了职高，学数控。第一节课是实训，老师傅说："手上要有茧。"',
        },
        {
          id: 'tech', label: '中专 / 技校，早点出来', hint: '第三年就进厂实习',
          show: function (S) { return S.stats.academic < 30; },
          eff: { track: 'tech', acad: -1, spirit: 1 },
          log: '你读了中专。招生老师说"包分配"，你后来才知道，分配的是流水线。',
        },
        {
          id: 'none', label: '不读了，跟表哥去打工', hint: '十五岁，行李已经收好',
          show: function (S) { return S.stats.academic < 26 && ['rural','migrant','biz'].indexOf(S.draw.family.id) >= 0; },
          eff: { track: 'none', cash: 6000, spirit: 2, health: -1 },
          log: '你把课本捆起来卖给了收废品的，一共 11 块 5。表哥说南方好挣钱。',
        },
      ],
    },

    // ------------------------------------------------------------ 16
    {
      id: 'n17', age: 16, title: '文理分科',
      scene: function (S) {
        return '高一下学期，分科表发下来了。班主任说"理科好就业"，你妈说"你看隔壁家的孩子"，' +
          '而你的物理卷子上写着 41 分。表只有一张，签字栏在最后一行。';
      },
      when: function (S) { return S.flags.track === 'key' || S.flags.track === 'normal'; },
      options: [
        {
          id: 'sci', label: '理科：物化生', hint: '成绩↑ 心气↓',
          eff: { acad: 4, spirit: -1.5, flags: { stream: 'sci' } },
          log: '你选了理科。从此晚自习的最后一排，全是在算同一道大题的人。',
        },
        {
          id: 'arts', label: '文科：史政地', hint: '心气↑ 关系↑',
          eff: { acad: 1.5, spirit: 2, relation: 1, flags: { stream: 'art' } },
          log: '你选了文科。背书背到嗓子哑，但至少那些字你认得。',
        },
        {
          id: 'spec', label: '走艺考 / 体育特长', hint: '花钱，换一张低一点的文化课卷子',
          show: function (S) { return S.stats.cash >= 30000; },
          eff: { cash: -38000, acad: -1, spirit: 3, flags: { spec: true } },
          log: '你开始学画画（或者练体育）。集训一个月八千，画室里所有人都说自己"文化课不行"。',
        },
        {
          id: 'coast', label: '混到毕业，等高考完再说', hint: '心气↑ 成绩↓↓',
          eff: { acad: -6, spirit: 5, health: 2, flags: { stream: 'none' } },
          log: '你成了老师嘴里"可惜了"的那种学生。你自己倒不觉得可惜。',
        },
        {
          id: 'transfer', label: '转学去市里更好的学校', hint: '花钱买一个更卷的环境',
          show: function (S) { return S.stats.cash >= 60000; },
          eff: { cash: -60000, acad: 5, relation: -2, flags: { transfer: true } },
          log: '你转学了。新学校早读六点二十，你的座位在讲台边上，被叫了三年"新来的"。',
        },
      ],
    },

    // ------------------------------------------------------------ 18（高考）
    {
      id: 'n18', age: 18, title: '志愿表',
      when: function (S) { return S.flags.track === 'key' || S.flags.track === 'normal'; },
      scene: function (S) {
        if (!S.draw.score) return '分数还没出来。';
        const sc = S.draw.score;
        return '高考 ' + (S.gaokaoScore || '—') + ' 分，' + sc.name + '。' +
          (sc.id === 'sn' ? '班主任在办公室里叹气，说"要不复读一年"。你妈在门外站着，没进来。' :
           sc.id === 's985' ? '全省排名前千分之几。亲戚的电话开始多了起来。' :
           '不高不低，刚好卡在一个需要认真选的分数上。志愿表只有一张，填错了没有撤销键。');
      },
      options: [
        {
          id: 'specArt', label: '艺考志愿：美院 / 体院', hint: '文化课低，学费高，路窄',
          show: function (S) { return !!S.flags.spec; },
          eff: { skill: 2, spirit: 2, majorGroup: 'art' },
          log: '你填了艺术类。录取通知书很漂亮，学费也很漂亮。',
        },
        {
          id: 'hot', label: '冲热门：计算机 / 金融', hint: '起薪高，但四年后未必还是热门',
          show: function (S) { return ['s985', 's1', 's2'].indexOf(S.draw.score.id) >= 0; },
          eff: { skill: 4, spirit: 2, majorGroup: 'hot' },
          log: '你填了热门专业。你爸在饭桌上说"这个好，这个赚钱"。',
        },
        {
          id: 'safe', label: '求稳：师范 / 医学 / 机械', hint: '起薪一般，路比较长',
          show: function (S) { return ['s985', 's1', 's2'].indexOf(S.draw.score.id) >= 0; },
          eff: { skill: 2, spirit: 3, relation: 2, majorGroup: 'safe' },
          log: '你填了稳妥的专业。你妈说"以后有个正经工作就行"。',
        },
        {
          id: 'any', label: '能上什么上什么', hint: '服从调剂',
          eff: { skill: 0, spirit: -1, majorGroup: 'any' },
          log: '你勾了"服从调剂"，最后被分到了一个你填志愿时没听过的专业。',
        },
        {
          id: 'work', label: '不读了，出去打工', hint: '早四年入行，早四年被消耗',
          show: function (S) { return ['sz', 'sn'].indexOf(S.draw.score.id) >= 0; },
          eff: { skill: -2, cash: 20000, health: -3, spirit: -2, earlyWork: true },
          log: '你买了南下的火车票。站了 19 个小时，下车时觉得这座城市很高。',
        },
      ],
    },

    // ------------------------------------------------------------ 18（没走高考）
    {
      id: 'n18v', age: 18, title: '十八岁的岔路',
      when: function (S) { return ['voc', 'tech', 'none'].indexOf(S.flags.track) >= 0; },
      scene: function (S) {
        const t = S.flags.track;
        if (t === 'voc') return '职高第三年，学校组织了顶岗实习。企业来挑人，像挑水果，先看手，再看脸。';
        if (t === 'tech') return '中专毕业。你的毕业照背景是实训车间，身后那台机床你操作了两年。';
        return '你十五岁离开学校，在外面漂了三年。身份证终于成年了，能进的厂也多了。';
      },
      options: [
        {
          id: 'up', label: '对口升学 / 专升本，再读三年', hint: '学历这条路，还能再挤一次',
          show: function (S) { return S.stats.academic >= 34; },
          eff: { edu: '专科', skill: 4, cash: -12000, spirit: 2, acad: 2 },
          log: '你考上了大专。班里四十个人，三十八个是"专升本"来的，都在等第二次机会。',
        },
        {
          id: 'factory', label: '直接进厂 / 上工地', hint: '当天面试，第二天上岗',
          eff: { startSalary: 4800, skill: 3, health: -5, spirit: -2, cash: 40000, vocWork: true },
          log: '你进了厂，两班倒，宿舍八人间，空调要自己装。第一个月工资到账，你给家里转了三千。',
        },
        {
          id: 'craft', label: '学一门手艺：厨师 / 汽修 / 美发', hint: '手艺是真的，社保是假的',
          eff: { startSalary: 5200, skill: 8, health: -2, cash: 30000, spirit: 2, vocWork: true },
          log: '你拜了个师傅，管吃管住不给钱，一年后开始拿提成。你的手比同龄人的糙十年。',
        },
        {
          id: 'sell', label: '做销售 / 送外卖 / 开店', hint: '底薪是礼貌，提成是命',
          eff: { startSalary: 4200, skill: 2, relation: 4, health: -3, cash: 30000, vocWork: true },
          log: '你开始跑单、跑客户、跑市场。你的微信步数常年第一，公积金常年为零。',
        },
      ],
    },

    // ------------------------------------------------------------ 19
    {
      id: 'n19', age: 19, title: '大学四年',
      scene: function (S) {
        return '宿舍六个人，四台电脑在打游戏，一台在写代码，一台在写小说。你的床在门边。';
      },
      options: [
        { id: 'gpa', label: '卷绩点，冲保研/考研', hint: '用四年换一个更高的起点', jump: 3, eff: { skill: 6, spirit: -2, health: -2, flags: { gradPlan: true } }, log: '你在图书馆待到闭馆，四年里谈过一次恋爱，分手理由是你太忙。' },
        { id: 'intern', label: '实习 + 社团，攒经历', hint: '简历比成绩单好看', jump: 3, eff: { skill: 3, relation: 6, spirit: 1, health: -1 }, log: '你做了三份实习，学会了两件事：怎么写周报，怎么在饭桌上不说话。' },
        { id: 'lie', label: '躺平，打游戏，谈恋爱', hint: '青春只有一次', jump: 3, eff: { spirit: 6, skill: -2, health: 2, relation: -2 }, log: '你打了 2000 小时游戏，段位很高，成绩单很低。你不后悔，也不太敢回想。' },
        { id: 'parttime', label: '兼职赚钱，给家里减负', hint: '懂事是一种天赋，也是一种损耗', jump: 3, eff: { cash: 40000, skill: 1, health: -2, spirit: -1, relation: 1 }, log: '你发过传单、做过家教、在奶茶店站过一整年。毕业时你比同学更会看人脸色。' },
      ],
    },

    // ------------------------------------------------------------ 22
    {
      id: 'n22', age: 22, title: '第一份工作',
      scene: function (S) {
        return '毕业季。宿舍楼下的行李箱轮子声响了一整个星期，你投了 87 份简历，收到 4 个面试，2 个 offer。';
      },
      options: [
        { id: 'big', label: '去大厂 / 头部公司', hint: '钱多，但你是第 3000 号螺丝', show: function (S) { return ['本科', '硕士', '博士'].indexOf(S.draw.edu) >= 0; },
          eff: { salaryMul: 1.15, skill: 3, health: -3, relation: 1, flags: { bigCo: true } }, log: '你入职了一家名字很好听的公司，工牌上有一张不太像你的照片。' },
        { id: 'sme', label: '去中小企业，什么都干', hint: '三个人的活，一个人的钱', eff: { salaryMul: 0.95, skill: 6, relation: 2, health: -2, flags: { sme: true } }, log: '你在一个 18 人的公司里做设计、做运营、修打印机。老板说"年轻人多学点"。' },
        { id: 'exam', label: '考公 / 考编', hint: '上岸率是个位数', eff: { special: 'exam' }, log: '' },
        { id: 'grad', label: '读研，再缓三年', hint: '学历通胀比工资快', show: function (S) { return S.draw.edu === '本科'; },
          eff: { special: 'grad' }, log: '' },
        { id: 'blue', label: '进厂 / 做服务业', hint: '不看学历，看体力', show: function (S) { return ['高中', '专科'].indexOf(S.draw.edu) >= 0; },
          eff: { salaryMul: 0.92, skill: 3, health: -4, spirit: -2, flags: { blue: true } }, log: '你进了一家电子厂，或者一家连锁店。培训两天，第三天就上岗。' },
      ],
    },

    // ------------------------------------------------------------ 26
    {
      id: 'n26', age: 26, title: '第一次跳槽',
      scene: function (S) {
        return '工作第四年。你开始能独立带一点东西，也开始发现，涨薪最快的方式是在别人的公司里涨。';
      },
      options: [
        { id: 'jump', label: '跳一次，涨 28%', hint: '跳槽是普通人最快的加薪方式', eff: { salaryMul: 1.28, relation: -3, spirit: 3, health: -2, flags: { jobHopper: true } }, log: '你跳了。旧同事在群里说"羡慕"，三个月后他们也开始跳。' },
        { id: 'stay', label: '原地熬晋升', hint: '慢，但攒的是资历', eff: { salaryMul: 1.12, relation: 4, skill: 2, spirit: -2 }, log: '你留下了，领导说"明年给你考虑"，你记下了这句话。' },
        { id: 'pivot', label: '转行重开', hint: '工资腰斩，人重新活一遍', eff: { salaryMul: 0.68, skill: 7, spirit: 5, health: 1, pivot: true }, log: '你换了行业，从"资深"变回"新人"。第一周你笑得很久没这么轻松。' },
      ],
    },

    // ------------------------------------------------------------ 29
    {
      id: 'n29', age: 29, title: '留不留下',
      scene: function (S) {
        return '你 29 岁了。房租每年涨，父母的电话开始从"吃饭了吗"变成"房子看了吗"。' +
          (S.flags.partner ? '你们在一起三年，谈过一次首付，没谈拢。' : '你一个人住，冰箱里有半盒过期的酸奶。');
      },
      options: [
        { id: 'buyBig', label: '留在大城市，买房', hint: '首付掏空，月供锁死三十年', special: 'house_big',
          eff: { spirit: 2, relation: 3, health: -2 }, log: '' },
        { id: 'backHome', label: '回省会 / 老家', hint: '工资降三成，房贷轻一半', special: 'house_small',
          eff: { spirit: 1, relation: 2, health: 2 }, log: '' },
        { id: 'rent', label: '不买了，租房过日子', hint: '把首付拿去买自由', eff: { spirit: 3, relation: -4, cash: 60000 }, log: '你继续租房，把钱存了下来。亲戚说你"想不通"，你说"嗯"。' },
      ],
    },

    // ------------------------------------------------------------ 32
    {
      id: 'n32', age: 32, title: '生不生',
      scene: function (S) {
        return '32 岁。体检报告上"建议尽早"四个字，你看了很多遍。' +
          (S.flags.partner ? '你们讨论过三次，每次都停在"再想想"。' : '你连讨论的对象都还没有，但催的人在变多。');
      },
      options: [
        { id: 'kid', label: '生', hint: '钱、时间、心气，三样一起扣', special: 'kid', eff: { spirit: 2, relation: 3, health: -3 }, log: '' },
        { id: 'nokid', label: '不生', hint: '轻松，但要扛住所有人的嘴', eff: { spirit: 4, relation: -5, cash: 40000 }, log: '你说"我们不打算要"。你妈沉默了三秒，然后说"你们自己决定"。' },
        { id: 'later', label: '再等三年', hint: '身体成本会替你决定', eff: { spirit: 1, health: -2, flags: { kidLater: true } }, log: '你说"35 岁之前一定"。这句话你自己都不太信。' },
      ],
    },

    // ------------------------------------------------------------ 35
    {
      id: 'n35', age: 35, title: '那道坎',
      scene: function (S) {
        return '35 岁。招聘网站上你熟悉的岗位，几乎都写着"35 岁以下"。' +
          '你在公司的价值，从"潜力"变成了"成本"。';
      },
      options: [
        { id: 'manager', label: '转管理', hint: '要关系，也要替别人背锅', show: function (S) { return S.stats.relation >= 38 && !S.flags.manager; },
          eff: { salaryMul: 1.2, relation: 4, spirit: -4, health: -3, flags: { manager: true } }, log: '你带了一个 7 人小组。第一次开人被 HR 拦下，说你"流程不对"。' },
        { id: 'expert', label: '死磕专家岗', hint: '要能力，也要赌行业不倒', show: function (S) { return S.stats.skill >= 45; },
          eff: { salaryMul: 1.14, skill: 6, spirit: -2, flags: { expert: true } }, log: '你成了公司里"这块只有他懂"的人。代价是，你只能懂这块。' },
        { id: 'exam35', label: '考编上岸', hint: '年龄窗口正在关闭', special: 'exam35', eff: {}, log: '' },
        { id: 'startup', label: '创业 / 入伙', hint: '拿积蓄赌一次', show: function (S) { return S.stats.cash >= 150000; },
          special: 'startup', eff: { spirit: 5, health: -4 }, log: '' },
        { id: 'coast', label: '先躺一阵，别折腾', hint: '不动，也是一种选择', eff: { spirit: 2, health: 2, salaryMul: 0.97 }, log: '你决定不折腾了。那年你准点下班，体重涨了六斤，睡得挺好。' },
      ],
    },

    // ------------------------------------------------------------ 40
    {
      id: 'n40', age: 40, title: '天花板',
      scene: function (S) {
        return '40 岁。你上面那个位置的人比你大 6 岁，他上面那个位置的人比他大 5 岁。你算了一下，轮到你的时候，你 51。';
      },
      options: [
        { id: 'flat', label: '中层躺平，把日子过稳', hint: '不再往上，也不再被优化', eff: { spirit: -2, health: 3, salaryMul: 1.02 }, log: '你开始准点下班，开始钓鱼，开始在群里发早安。' },
        { id: 'side2', label: '副业转正', hint: '把退路走成主路', special: 'freelance',
          show: function (S) { return S.flags.sideBusiness || S.stats.cash >= 250000; },
          eff: { spirit: 4, health: 2 }, log: '' },
        { id: 'switch', label: '换赛道，从头学', hint: '40 岁当新人，需要脸皮', eff: { salaryMul: 0.82, skill: 6, spirit: 3, health: -2, pivot: true }, log: '你去了一个更小的行业、更小的公司，名片上的头衔降了一级。' },
      ],
    },

    // ------------------------------------------------------------ 45
    {
      id: 'n45', age: 45, title: '行业下行',
      scene: function (S) {
        return '45 岁。行业不行了，不是你的错，但账算在你头上。公司开始"优化 40 岁以上中层"。';
      },
      options: [
        { id: 'sink', label: '跟着公司沉', hint: '赌它不倒', eff: { salaryMul: 0.92, spirit: -6, relation: 2, flags: { sank: true } }, log: '你留下了。两年后公司裁到只剩三分之一，你还在，工资回到了 2019 年。' },
        { id: 'leave', label: '提前撤，换行业', hint: '主动比被动体面', eff: { salaryMul: 0.78, skill: 5, spirit: 4, health: 1, pivot: true }, log: '你走了，去了一个不看年龄的行业。第一天上班，同事都比你小十岁。' },
        { id: 'own', label: '被优化后自己干', hint: '开个小店 / 接私活', special: 'freelance', eff: { spirit: 3, health: -2 }, log: '' },
      ],
    },

    // ------------------------------------------------------------ 52
    {
      id: 'n52', age: 52, title: '健康账单',
      scene: function (S) {
        return '52 岁。你的身体开始寄账单了：血压、血糖、颈椎、睡眠。医生说"这个年纪，正常"。';
      },
      options: [
        { id: 'push', label: '再拼八年，熬到退休', hint: '钱重要，还是命重要', eff: { salaryMul: 1.06, health: -8, spirit: -3 }, log: '你继续加班，把药放在工位抽屉里，跟胃药放在一起。' },
        { id: 'slow', label: '主动降速，少赚点', hint: '提前把命赎回来', eff: { salaryMul: 0.86, health: 9, spirit: 5, relation: 2 }, log: '你申请调去了清闲岗，工资降了两成，血压降了二十。' },
        { id: 'sick', label: '身体已经不允许了', hint: '病退', show: function (S) { return S.stats.health < 45; },
          eff: { special: 'retireEarly' }, log: '' },
      ],
    },
  ];

  D.nodeAges = {
    n13: 13, n15: 15, n17: 16, n18: 18, n18v: 18, n19: 19,
    n22: 22, n26: 26, n29: 29, n32: 32, n35: 35, n40: 40, n45: 45, n52: 52,
  };
})();
