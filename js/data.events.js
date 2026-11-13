/* 工位 — 事件卡
 * 每张卡 2–3 个应对，不做对错，只做贵贱。
 * eff 字段：cash(元) / salaryMul(比例) / health / spirit / skill / relation / flags / industry / role / edu
 */
(function () {
  const G = (typeof window !== 'undefined' ? window : globalThis);
  const GW = G.GW = G.GW || {};
  const D = GW.DATA = GW.DATA || {};

  D.events = [
    // ------------------------------------------------ 学生时代（13–18）
    {
      id: 'ev_note', tag: '教室', weight: 10, ageMin: 13, ageMax: 17,
      title: '纸条被截了',
      text: '你传的纸条在半路被班主任截住。她当着全班念了两句，然后问："谁写的？"',
      options: [
        { label: '站起来认了', desc: '丢脸，但干脆', eff: { acad: -2, relation: 4, spirit: 2 }, log: '你站起来说"我写的"。全班安静了两秒，后排有人小声说"牛"。' },
        { label: '低头装傻', desc: '没人指认就没事', eff: { relation: -3, spirit: -3 }, log: '没有一个人说话。你趴了一整节课，后背全是汗。' },
        { label: '说是别人写的', desc: '甩锅', eff: { relation: -6, acad: 1, spirit: -2 }, log: '你报了一个名字。那个人被叫去办公室，回来时没看你。' },
      ],
    },
    {
      id: 'ev_phone', tag: '教室', weight: 9, ageMin: 13, ageMax: 18,
      title: '手机被没收',
      text: '晚自习，你抽屉里的手机亮了。班主任从后门进来，直接伸手："拿出来。"',
      options: [
        { label: '交，认罚', desc: '写检查，期末还你', eff: { acad: 2, spirit: -2 }, log: '你交了上去，写了一份 800 字的检查，抄了三遍。' },
        { label: '硬顶，说"凭啥"', desc: '有骨气，有代价', eff: { acad: -1, spirit: 4, relation: -5 }, log: '你顶了两句，然后被请了家长。你妈在办公室站了半小时。' },
        { label: '偷偷再买一个', desc: '钱能解决的问题', eff: { cash: -800, acad: -2, spirit: 2 }, log: '你用压岁钱买了个二手机。第二周又被收了。' },
      ],
    },
    {
      id: 'ev_bully', tag: '教室', weight: 7, ageMin: 14, ageMax: 18,
      title: '走廊尽头',
      text: '课间，走廊尽头围了几个人，中间是你们班那个不太说话的男生。有人在推他。',
      options: [
        { label: '过去把人拉开', desc: '可能下一个是你', eff: { relation: 5, health: -4, spirit: 3 }, log: '你挤进去说"算了"。推人的那个看了你一眼，记住了你。' },
        { label: '装作没看见', desc: '大多数人', eff: { spirit: -5, relation: -1 }, log: '你从旁边走过去。他抬头看了你一眼，你走得更快了。' },
        { label: '去叫老师', desc: '最正确，最没面子', eff: { relation: -2, spirit: 2, acad: 1 }, log: '老师赶来了，人散了。第二天起，没人再跟你一起打球。' },
      ],
    },
    {
      id: 'ev_crush', tag: '教室', weight: 10, ageMin: 14, ageMax: 18,
      title: '喜欢的人',
      text: '你发现自己会算好时间，在楼梯口"偶遇"同一个人。你们说过的话加起来不到二十句。',
      options: [
        { label: '写封信，递过去', desc: '青春只有一次', eff: { spirit: 6, acad: -3, relation: 3 }, log: '你把信塞进了她的书里。三天后她回了四个字："先好好学习。"' },
        { label: '憋着，等毕业再说', desc: '最安全，最遗憾', eff: { acad: 3, spirit: -3 }, log: '你憋了三年。毕业照上她站在第二排，你站在最后一排。' },
        { label: '约着一起上晚自习', desc: '两个人一起卷', eff: { acad: 4, spirit: 4, relation: 4, health: -1 }, log: '你们成了同桌。你发现自己居然能坐住三小时，就为了给她讲一道题。' },
      ],
    },
    {
      id: 'ev_fee', tag: '家里', weight: 8, ageMin: 13, ageMax: 18,
      title: '补课费',
      text: '班主任在群里发通知：周末提高班，一门 1200，报三门打九折。你妈在厨房算了一遍，没说话。',
      options: [
        { label: '跟家里说"我不报了"', desc: '懂事的价格', eff: { acad: -4, relation: 3, spirit: -2 }, log: '你妈把那张纸折起来放进抽屉，说"咱不上那个"，然后多给了你十块零花。' },
        { label: '报，钱家里想办法', desc: '把压力转给父母', eff: { cash: -3600, acad: 5, spirit: -1 }, log: '你报了名。你爸那个月多跑了两趟夜班，你后来才知道。' },
        { label: '自己找同学抄笔记', desc: '不花钱的路子', eff: { acad: 2, relation: 2, spirit: 1 }, log: '你借了年级第一的笔记，抄了整整两个笔记本，字迹后来变得跟他一样。' },
      ],
    },
    {
      id: 'ev_rank', tag: '成绩', weight: 10, ageMin: 14, ageMax: 18,
      title: '排名掉了',
      text: '月考排名从 12 名掉到 28 名。家长会上，你妈坐在你的座位上，看了很久那张成绩单。',
      options: [
        { label: '从今天开始熬夜补', desc: '用命换分', eff: { acad: 5, health: -5, spirit: -2 }, log: '你开始十一点半睡，六点起。三个月后排名回来了，眼睛也近视了。' },
        { label: '去找老师问哪块不行', desc: '方法比努力重要', eff: { acad: 4, relation: 2, spirit: 1 }, log: '数学老师给你画了三页知识图。你第一次觉得，成绩是可以拆开的。' },
        { label: '算了，反正也追不上', desc: '认命', eff: { acad: -4, spirit: 3, health: 2 }, log: '你把成绩单签了字交回去。那天下午你睡了高中三年最踏实的一觉。' },
      ],
    },
    {
      id: 'ev_cheat', tag: '成绩', weight: 6, ageMin: 15, ageMax: 18,
      title: '递过来的答案',
      text: '期末考，隔壁桌把答题卡往你这边推了一点。他上次排第五，你排第二十七。',
      options: [
        { label: '抄了', desc: '分数是真的，能力是假的', eff: { acad: 3, spirit: -4, relation: -2 }, log: '你抄了。那次你进了前十，家长会上你妈第一次坐在了前排。' },
        { label: '不抄，自己写', desc: '难，但干净', eff: { acad: 1, spirit: 3 }, log: '你把答题卡往自己这边挪了挪。那个学期你名次没变，但看题不慌了。' },
        { label: '考完去举报', desc: '把别人也拉下水', eff: { acad: 0, relation: -7, spirit: 1 }, log: '你去了教务处。那男生被记了过，你们班那学期没人跟你说话。' },
      ],
    },
    {
      id: 'ev_netbar', tag: '放学后', weight: 7, ageMin: 13, ageMax: 17,
      title: '网吧',
      text: '放学后，几个人拉你去网吧，五块钱三个小时。老板看见你们，把烟按灭了，说"里面坐"。',
      options: [
        { label: '去，玩到天黑', desc: '快乐是真的', eff: { spirit: 5, acad: -3, health: -2, cash: -500 }, log: '你打到七点半，回家说是"在学校写作业"。你妈信了。' },
        { label: '去，但只待一小时', desc: '自欺欺人', eff: { spirit: 2, acad: -1, cash: -500 }, log: '一小时后他们不放你走。你走的时候，他们在打最后一局。' },
        { label: '不去，回家写作业', desc: '把无聊熬成优势', eff: { acad: 3, relation: -2, spirit: -1 }, log: '你回了家。第二天他们聊昨晚的战绩，你插不上话。' },
      ],
    },
    {
      id: 'ev_teacher', tag: '教室', weight: 6, ageMin: 13, ageMax: 18,
      title: '班主任叫你去办公室',
      text: '班主任把门关上，说："我不是批评你。我是觉得你这孩子，还能再往上走一点。"',
      options: [
        { label: '认真听，按她说的做', desc: '一个愿意管你的人', eff: { acad: 5, relation: 3, spirit: 2 }, log: '她给你排了一张表，每天做什么写得很细。你照做了一个学期。' },
        { label: '点头，出门就忘', desc: '标准流程', eff: { acad: -1, spirit: 1 }, log: '你说了"知道了老师"，出门就把话交给了走廊的风。' },
        { label: '反问"那您说我该考哪"', desc: '把老师问住', eff: { acad: 2, relation: 2, spirit: 3 }, log: '她愣了一下，说"你至少能上个一本"。这句话你记了十年。' },
      ],
    },
    {
      id: 'ev_summer', tag: '假期', weight: 6, ageMin: 15, ageMax: 18,
      title: '暑假',
      text: '两个月的暑假。有人在补课，有人在家里躺着，有人去工地和餐馆干活，一天 80。',
      options: [
        { label: '去打工，挣点钱', desc: '早一点知道钱是什么', eff: { cash: 6000, acad: -2, health: -3, relation: 2, skill: 1 }, log: '你在后厨站了四十天，学会了切菜和挨骂。开学时你的手比同学黑了一圈。' },
        { label: '在家补课 / 预习', desc: '把暑假当第三个学期', eff: { acad: 6, spirit: -3, health: -2 }, log: '你把下学期的数学书翻完了。开学第一次考试，你提前二十分钟交卷。' },
        { label: '躺着，睡到中午', desc: '最后一次这样的暑假', eff: { spirit: 5, health: 3, acad: -2 }, log: '你睡了两个月。八月底你突然有点慌，但离开学只剩三天了。' },
      ],
    },
    {
      id: 'ev_sport', tag: '操场', weight: 5, ageMin: 13, ageMax: 18,
      title: '体育课',
      text: '篮球场上你落地时踩到别人的脚，脚踝当场肿起来。同学说"没事吧"，你疼得说不出话。',
      options: [
        { label: '去医务室，请假一周', desc: '身体要紧', eff: { health: 2, acad: -2, spirit: 1 }, log: '你请了一周假，回来时落下了两章内容。' },
        { label: '忍着，下午还有课', desc: '少年的逞强', eff: { health: -6, acad: 1, spirit: 2 }, log: '你瘸了半个月。现在下雨天，那只脚踝还会提醒你。' },
        { label: '让家里带你去医院拍片', desc: '花钱买个安心', eff: { cash: -1200, health: -1, relation: 1 }, log: '片子显示骨裂。医生说"再晚来两天就麻烦了"，你妈一路没说话。' },
      ],
    },

    // ------------------------------------------------ 组织
    {
      id: 'ev_newboss', tag: '组织', weight: 9, once: true, ageMin: 23, ageMax: 55,
      title: '空降领导',
      text: '部门来了新领导，开会第一句是"我不喜欢形式主义"，第二句是"以后每周交周报"。',
      options: [
        { label: '第二天就去单独汇报', desc: '先站队，后干活', eff: { relation: 7, spirit: -3, cash: 0 }, log: '你在新领导办公室待了四十分钟，出来时笑得很标准。' },
        { label: '先观察三个月', desc: '不站队，也不掉队', eff: { relation: 1, spirit: -1 }, log: '你决定让子弹飞一会儿，子弹飞了三年。' },
        { label: '开始更新简历', desc: '心里已经走了', eff: { skill: 2, spirit: 1 }, log: '你把简历改成了"结果导向型"，然后保存为 PDF。' },
      ],
    },
    {
      id: 'ev_merge', tag: '组织', weight: 7, once: true, ageMin: 25, ageMax: 52,
      title: '部门合并',
      text: '两个部门合成一个，两个总监合成一个。工位从 12 楼搬到 9 楼，理由是"方便协同"。',
      options: [
        { label: '争新部门的核心项目', desc: '位置少了，得抢', eff: { skill: 3, health: -3, relation: -2, salaryMul: 1.03 }, log: '你抢到了项目，也抢到了每周三次的跨部门对齐会。' },
        { label: '低调做手头的事', desc: '风头让别人出', eff: { spirit: -2, health: 1 }, log: '你活了下来，作为背景板。' },
        { label: '借机申请转岗', desc: '换个池子', eff: { skill: 4, relation: -3, spirit: 2 }, log: '你换了个组，重新做了一遍自我介绍。' },
      ],
    },
    {
      id: 'ev_nightmsg', tag: '组织', weight: 10, ageMin: 23, ageMax: 50,
      title: '凌晨的"收到请回复"',
      text: '晚上十一点四十，群里弹出一条消息，末尾是"收到请回复"。',
      options: [
        { label: '立刻回"收到"', desc: '手比脑子快', eff: { relation: 2, health: -2, spirit: -2 }, log: '你回得很快，快到自己都有点难过。' },
        { label: '装睡，明早再回', desc: '赌一把', eff: { relation: -3, health: 1, spirit: 1 }, log: '第二天早上你回了"昨晚睡得早"，没人信，也没人问。' },
        { label: '回"这个点不太合适"', desc: '有代价的体面', eff: { relation: -6, spirit: 5, health: 1 }, log: '你发出了那句话，手心全是汗，但睡得比过去半年都好。' },
      ],
    },
    {
      id: 'ev_compete', tag: '组织', weight: 6, once: true, ageMin: 27, ageMax: 45,
      title: '竞聘',
      text: '内部竞聘一个主管岗，报名表上要求"具备较强的抗压能力"。你看了下隔壁工位，他已经在写了。',
      options: [
        { label: '报名，全力准备', desc: '赌一次', eff: { skill: 3, health: -4, spirit: -1, relation: 2, salaryMul: 1.1 }, log: '你准备了三个通宵，PPT 里有十七页图表。' },
        { label: '不报，看戏', desc: '反正内定', eff: { spirit: -3, health: 1 }, log: '结果出来了，是那个 PPT 做得最花的。' },
        { label: '帮对手改 PPT', desc: '投资人情', eff: { relation: 8, spirit: -2 }, log: '他上去了，第二年把你调到了他的组。' },
      ],
    },
    {
      id: 'ev_blame', tag: '组织', weight: 7, ageMin: 24, ageMax: 52,
      title: '背锅',
      text: '项目出了问题，会议室里安静得能听见空调。领导环视一圈，目光在你这里多停了 0.8 秒。',
      options: [
        { label: '认下来，回头再解释', desc: '先保住场面', eff: { relation: 5, spirit: -7 }, log: '你说了"这个我来负责"，然后失眠到三点。' },
        { label: '当场把时间线摆清楚', desc: '得罪人，但清白', eff: { relation: -6, spirit: 4, skill: 2 }, log: '你打开了共享文档，会议室安静得更贵了。' },
        { label: '沉默', desc: '什么也不说', eff: { spirit: -4, relation: -1 }, log: '锅落在了你和邻座之间，最后是邻座接的。你到现在都记得他的表情。' },
      ],
    },
    {
      id: 'ev_teambuild', tag: '组织', weight: 8, ageMin: 23, ageMax: 50,
      title: '周末团建',
      text: '行政通知：本周六团建，自愿参加，不参加的请说明原因。',
      options: [
        { label: '去，笑得很大声', desc: '融入的税', eff: { relation: 5, health: -3, spirit: -3 }, log: '你在拓展训练里被举过肩，也在合照里被裁掉过。' },
        { label: '请假，说家里有事', desc: '编个理由', eff: { relation: -3, spirit: 2, health: 2 }, log: '周六你睡到十一点，醒来发现群里 99+。' },
        { label: '去了但中途消失', desc: '高难度动作', eff: { relation: -1, spirit: 1 }, log: '你在第二轮游戏时"接了个紧急电话"，然后去了商场。' },
      ],
    },
    {
      id: 'ev_credit', tag: '组织', weight: 7, ageMin: 25, ageMax: 50,
      title: '述职被抢功',
      text: '季度述职，你做的项目被组长讲成了"我们组的成果"，你的名字出现在第 14 页的致谢里。',
      options: [
        { label: '会后单独找上级说明', desc: '越级，但有记录', eff: { relation: -4, spirit: 3, salaryMul: 1.04 }, log: '上级说"我知道了"，然后什么都没发生，但也没再发生。' },
        { label: '忍着，等年终', desc: '攒着', eff: { spirit: -5, relation: 1 }, log: '年终奖发下来，比预期多了两千，你居然有点感动。' },
        { label: '把成果写成复盘发全员', desc: '公开处刑', eff: { relation: -7, spirit: 5, skill: 2 }, log: '你发的文档被转发了 200 次，组长从此叫你"老师"。' },
      ],
    },
    {
      id: 'ev_return', tag: '组织', weight: 5, once: true, ageMin: 29, ageMax: 45,
      title: '长假回来',
      text: '你休了四个月假回来，发现工位有人了，你的项目被拆成了三份，分给了三个人。',
      options: [
        { label: '从边角料重新做起', desc: '熬', eff: { spirit: -6, skill: 2, relation: 2 }, log: '你花了两年，重新拿回了一部分当年做的事。' },
        { label: '直接找老板要说法', desc: '谈', eff: { relation: -4, spirit: 3, salaryMul: 1.03 }, log: '老板说"业务需要"，然后给你加了个"高级"前缀。' },
        { label: '顺势换个赛道', desc: '不回去了', eff: { skill: 4, spirit: 4, industry: 'other' }, log: '你换了行业，从"老人"变成了"新人"，居然轻松了一些。' },
      ],
    },

    // ------------------------------------------------ 行业
    {
      id: 'ev_boom', tag: '行业', weight: 6, once: true, ageMin: 24, ageMax: 42,
      title: '风口来了',
      text: '你所在的行业突然成了风口，招聘网站上你的岗位薪资一夜之间涨了 40%，猎头开始每天给你发消息。',
      options: [
        { label: '趁热跳一次，涨薪 30%', desc: '吃周期', eff: { salaryMul: 1.3, health: -3, spirit: 3, skill: 2, flags: { jobHopper: true } }, log: '你跳了，涨了 30%，新公司的同事平均在职 11 个月。' },
        { label: '留在原地要资源', desc: '赌公司', eff: { salaryMul: 1.12, relation: 3, spirit: 1 }, log: '公司给了你 12%，还给了你一句"你是核心骨干"。' },
        { label: '冷静，啥也不做', desc: '看过太多风口', eff: { spirit: -2, skill: 2 }, log: '一年半后，风口变成了"优化"。你在原地，居然躲过了。' },
      ],
    },
    {
      id: 'ev_winter', tag: '行业', weight: 7, once: true, ageMin: 26, ageMax: 50,
      title: '行业寒冬',
      text: '行业开始下行，公司先取消了下午茶，然后取消了年会，然后取消了涨薪。',
      options: [
        { label: '主动降薪保住岗位', desc: '先活着', eff: { salaryMul: 0.85, spirit: -6, relation: 2 }, log: '你签了降薪协议，行政说这是"共渡难关"。' },
        { label: '死扛，等回暖', desc: '赌', eff: { spirit: -4, health: -2, skill: 2 }, log: '你扛了两年，行业没有回暖，你的头发先走了。' },
        { label: '立刻转行，从低做起', desc: '清盘重来', eff: { salaryMul: 0.72, skill: 6, spirit: 2, industry: 'other' }, log: '你换了行业，工资回到了五年前，但晚上能睡着了。' },
      ],
    },
    {
      id: 'ev_funding', tag: '行业', weight: 5, ageMin: 24, ageMax: 45,
      title: '融资失败',
      text: '公司 B 轮没融到，老板在全员会上说"我们账上的钱还够发 8 个月工资"，然后笑了一下。',
      options: [
        { label: '马上开始面试', desc: '跑在前面', eff: { skill: 2, spirit: -2, salaryMul: 1.08 }, log: '你成了部门里第一个走的人，也是唯一拿到涨薪的人。' },
        { label: '陪着公司到最后', desc: '讲义气', eff: { relation: 6, spirit: -5, cash: -8000 }, log: '公司撑了 11 个月，最后两个月工资打了白条。' },
        { label: '先把年假休完', desc: '躺一下', eff: { health: 3, spirit: 2, cash: -3000 }, log: '你去了趟云南，回来时公司已经搬空了一半。' },
      ],
    },
    {
      id: 'ev_headhunter', tag: '行业', weight: 8, ageMin: 25, ageMax: 42,
      title: '猎头电话',
      text: '一个陌生号码，开口就是"方便聊两句吗"，然后报了一个比你高 25% 的数字。',
      options: [
        { label: '聊，去面试', desc: '看看行情', eff: { skill: 2, spirit: 2, salaryMul: 1.18, health: -2 }, log: '你面了三轮，拿到了 offer，也发现了自己"只会一件事"。' },
        { label: '聊，但用来谈涨薪', desc: '借力', eff: { salaryMul: 1.09, relation: -2, spirit: 1 }, log: '你把 offer 截图发给了老板，涨了 9%，也被记住了。' },
        { label: '直接挂掉', desc: '不信', eff: {}, log: '半年后你听说那个岗位裁了一半人，你觉得自己很聪明。' },
      ],
    },
    {
      id: 'ev_ipo', tag: '行业', weight: 3, once: true, ageMin: 26, ageMax: 45,
      title: '公司要上市了',
      text: '公司启动 IPO，HR 说期权"未来可期"，你算了一下，如果按招股书，大概是 37 万。',
      options: [
        { label: '咬牙再干三年等解禁', desc: '赌纸面财富', eff: { health: -4, spirit: -3, relation: 2, flags: { option: true } }, log: '三年后解禁，股价打了四折，扣完税还剩 11 万。' },
        { label: '趁热跳槽走人', desc: '落袋为安', eff: { salaryMul: 1.2, spirit: 2, flags: { option: false } }, log: '你走的那年公司上市了，你刷到新闻时正在开会，愣了一下。' },
      ],
    },
    {
      id: 'ev_policy', tag: '行业', weight: 4, once: true, ageMin: 24, ageMax: 50,
      title: '政策落地',
      text: '一纸文件下来，整个行业重新定义了什么叫"合规"。公司连夜开会，第二天裁掉了三分之一的业务线。',
      options: [
        { label: '转去合规相关的岗', desc: '往安全区挪', eff: { salaryMul: 0.93, skill: 3, relation: 2 }, log: '你成了最懂新规的人，也成了最没意思的人。' },
        { label: '跟着业务线一起走', desc: '要么生要么死', eff: { salaryMul: 0.7, spirit: -8, skill: 3 }, log: '你被"优化"了，赔了 N+1，然后在三个月内找到了新工作。' },
      ],
    },

    // ------------------------------------------------ 生活
    {
      id: 'ev_rent', tag: '生活', weight: 8, ageMin: 22, ageMax: 40,
      need: function (S) { return !S.flags.house; },
      title: '房东说要涨租',
      text: '房东在微信上发来一段语音，五十秒，核心信息是"涨八百"。',
      options: [
        { label: '接受，续租', desc: '不折腾', eff: { cash: -9600, spirit: -2 }, log: '你续了租，然后开始算每个月还剩多少。' },
        { label: '搬到更远的地方', desc: '用通勤换钱', eff: { cash: -2000, health: -3, spirit: -2 }, log: '你搬到了六环外，每天多花两小时，省下六百。' },
        { label: '跟房东讲价', desc: '博弈', eff: { cash: -4800, relation: 1, spirit: 1 }, log: '你讲了二十分钟，最后涨了四百，双方都觉得亏了。' },
      ],
    },
    {
      id: 'ev_parentsick', tag: '生活', weight: 5, ageMin: 30, ageMax: 58,
      title: '父母住院',
      text: '老家的电话在开会时打进来三次。你出去接，听见"你爸住院了，先别急"。',
      options: [
        { label: '请假回老家陪护', desc: '工作在其次', eff: { cash: -25000, spirit: 4, relation: -3, health: -2 }, log: '你请了两周假，回来时项目已经给了别人，但你爸能下床了。' },
        { label: '打钱，让亲戚帮忙', desc: '现实的选择', eff: { cash: -40000, spirit: -5, relation: 1 }, log: '你转了五万，然后在深夜的工位上盯着屏幕发呆。' },
        { label: '把父母接到身边', desc: '最贵的方案', eff: { cash: -60000, spirit: 3, health: -1, flags: { parentsLive: true } }, log: '家里多了两个人，也多了两副碗筷和两种作息。' },
      ],
    },
    {
      id: 'ev_marry', tag: '生活', weight: 7, ageMin: 26, ageMax: 38,
      title: '催婚',
      text: '过年回家，亲戚围坐一圈，话题从"工资多少"平滑过渡到"什么时候办"。',
      options: [
        { label: '认真相亲，年内定下来', desc: '完成任务', eff: { spirit: 3, relation: 3, cash: -30000, flags: { partner: true } }, log: '你见了七个，第八个成了。婚礼办了 22 桌，收回 18 万。' },
        { label: '顶住，不将就', desc: '代价是每年都被问', eff: { spirit: 4, relation: -4 }, log: '你说"我自己过挺好"，你妈沉默了很久，然后给你夹了块鱼。' },
        { label: '糊弄，说在谈', desc: '缓兵之计', eff: { spirit: -2, relation: 1 }, log: '你说了三年"在谈"，最后连你自己都快信了。' },
      ],
    },
    {
      id: 'ev_reunion', tag: '生活', weight: 6, ageMin: 28, ageMax: 55,
      title: '同学会',
      text: '十年同学会，定在市里最好的酒店。你在门口犹豫了三十秒才进去。',
      options: [
        { label: '去，坦然说近况', desc: '不装', eff: { spirit: 3, relation: 3 }, log: '你说"还在老行业混"，对方说"挺好的"，你们都笑了。' },
        { label: '去，吹一吹', desc: '场面要紧', eff: { spirit: -2, relation: 2, cash: -5000 }, log: '你说年薪的时候加了 30%，散场后自己都想笑。' },
        { label: '不去，加班', desc: '错过也没损失', eff: { spirit: -3, skill: 1 }, log: '你在群里看他们发的合照，找到自己空着的那个位置。' },
      ],
    },
    {
      id: 'ev_checkup', tag: '生活', weight: 7, ageMin: 28, ageMax: 58,
      title: '体检异常',
      text: '体检报告出来，第一页有两项标红。医生的建议是"注意休息，定期复查"。',
      options: [
        { label: '立刻调整作息，办健身卡', desc: '这次当真', eff: { health: 6, cash: -4000, spirit: 2, skill: -1 }, log: '你健身了三个月，然后卡过期了，但你确实睡早了。' },
        { label: '复查一下，然后照旧', desc: '大多数人', eff: { health: -3, spirit: -1, cash: -1500 }, log: '复查结果"暂无大碍"，你把报告塞进了抽屉最底层。' },
        { label: '不管，忙完这阵再说', desc: '经典', eff: { health: -7, spirit: -1 }, log: '"这阵"持续了四年。' },
      ],
    },
    {
      id: 'ev_borrow', tag: '生活', weight: 5, ageMin: 25, ageMax: 55,
      need: function (S) { return S.stats.relation >= 35; },
      title: '朋友借钱',
      text: '一个很久没联系的朋友突然发来消息："在吗，有点事想跟你说。"',
      options: [
        { label: '借，两万', desc: '人情', eff: { cash: -20000, relation: 6, spirit: 1, flags: { lentMoney: true } }, log: '你转了钱，他说"下个月一定还"，现在已经过去三个下个月了。' },
        { label: '借五千，说手头紧', desc: '折中', eff: { cash: -5000, relation: 2 }, log: '他收了，然后你们再也没聊过。' },
        { label: '不借，找理由', desc: '保住钱', eff: { relation: -6, spirit: -2 }, log: '你说了句"最近也紧张"，然后翻出他上个月的朋友圈：马尔代夫。' },
      ],
    },
    {
      id: 'ev_school', tag: '生活', weight: 5, ageMin: 33, ageMax: 50,
      need: function (S) { return S.flags.kids > 0 && S.stats.cash > 250000; },
      title: '孩子上学',
      text: '孩子要上小学了，学区房差 40 平，私立一年 8 万，公立划片划到了隔壁区。',
      options: [
        { label: '咬牙买学区房', desc: '六个钱包', eff: { cash: -420000, spirit: -3, relation: 2, flags: { schoolDistrict: true } }, log: '你签了合同，贷款 30 年，孩子进了那所学校，成绩中等。' },
        { label: '上私立', desc: '花钱买省心', eff: { cash: -180000, spirit: 1, health: -1 }, log: '校车六点半到小区门口，你每天五点半起床。' },
        { label: '就上公立', desc: '不卷了', eff: { spirit: 2, relation: -2 }, log: '你妈说"人家都买"，你说"那就人家买"。' },
      ],
    },
    {
      id: 'ev_demolish', tag: '生活', weight: 2, once: true, ageMin: 28, ageMax: 55,
      need: function (S) {
        return ['rural', 'migrant', 'biz'].indexOf(S.draw.family.id) >= 0 ||
          ['t4', 't5', 't6'].indexOf(S.draw.tier.id) >= 0;
      },
      title: '老家的房子要拆了',
      text: '村里的通知贴出来了，你们家那栋两层小楼在红线内。你妈打电话的声音都在抖。',
      options: [
        { label: '要钱', desc: '一次性', eff: { cash: 380000, spirit: 3, relation: 1 }, log: '你拿到了 38 万，你妈说"这钱留着，别乱花"，你点头。' },
        { label: '要房', desc: '回迁两套', eff: { cash: -20000, spirit: 2, flags: { twoHouses: true } }, log: '你回迁了两套，一套给你爸妈，一套在县城，租出去了。' },
      ],
    },

    // ------------------------------------------------ 黑天鹅
    {
      id: 'ev_layoff', tag: '黑天鹅', weight: 6, once: true, ageMin: 26, ageMax: 55,
      need: function (S) { return !S.flags.civil; },
      title: '被优化',
      text: 'HR 约你去小会议室，桌上放着两份文件和一个纸箱。她说："公司最近在做组织调整。"',
      options: [
        { label: '拿 N+1，休息两个月', desc: '喘口气', eff: { cash: 0, health: 4, spirit: 2, flags: { laidOffOnce: true } }, log: '你拿了补偿，睡了半个月，然后开始投简历。那两个月是你十年里最像人的两个月。' },
        { label: '立刻开始找工作', desc: '无缝衔接', eff: { salaryMul: 0.88, spirit: -4, health: -2, flags: { laidOffOnce: true } }, log: '你两周就上班了，工资降了 12%，你告诉自己"先干着"。' },
        { label: '趁机和公司谈条件', desc: '要更多', eff: { cash: 30000, relation: -3, spirit: 3, flags: { laidOffOnce: true } }, log: '你拿出了一份劳动法条文，HR 的表情变了三次，最后多给了两个月。' },
      ],
    },
    {
      id: 'ev_injury', tag: '黑天鹅', weight: 3, ageMin: 24, ageMax: 55,
      title: '通勤路上',
      text: '早高峰，电动车在路口被一辆右转的车带倒。你躺在地上，第一个念头是"今天有个会"。',
      options: [
        { label: '住院，好好养', desc: '身体优先', eff: { health: -8, cash: -12000, spirit: 1, skill: 1 }, log: '你住了两周院，公司派了个实习生来看你，带了水果。' },
        { label: '打石膏回去上班', desc: '会不能不开', eff: { health: -14, spirit: -5, relation: 3 }, log: '你拄着拐去了公司，领导说"你太拼了"，然后给你加了活。' },
      ],
    },
    {
      id: 'ev_default', tag: '黑天鹅', weight: 3, ageMin: 26, ageMax: 55,
      title: '公司欠薪',
      text: '发薪日是 15 号，今天 22 号。财务说"再等等，老板在筹钱"。',
      options: [
        { label: '等等看', desc: '再给一个月', eff: { cash: -15000, spirit: -6, relation: 2 }, log: '等到第三个月，你和其他十几个人一起去了劳动仲裁。' },
        { label: '立刻离职走人', desc: '止损', eff: { cash: -5000, spirit: 3, skill: 1 }, log: '你走的时候，办公室还剩四个人，其中两个在打游戏。' },
        { label: '联合同事集体维权', desc: '抱团', eff: { cash: -3000, spirit: 5, relation: 4, health: -2 }, log: '你们赢了，钱分三个月补上，你成了"那个人"。' },
      ],
    },
    {
      id: 'ev_loss', tag: '黑天鹅', weight: 2, ageMin: 30, ageMax: 58,
      title: '亲人离世',
      text: '凌晨三点，电话响了。你接起来，听见的第一句话，让剩下的半辈子都轻了一点。',
      options: [
        { label: '请假处理后事，陪家人', desc: '该做的', eff: { cash: -20000, spirit: -6, health: -2, relation: 4 }, log: '你在老家待了二十天，回来后很久没说话。' },
        { label: '处理完尽快回去上班', desc: '生活要继续', eff: { spirit: -9, health: -3, relation: -2 }, log: '你三天就回去了，同事说"节哀"，你点头，然后打开电脑。' },
      ],
    },
    {
      id: 'ev_scam', tag: '黑天鹅', weight: 4, ageMin: 28, ageMax: 58,
      title: '理财爆了',
      text: '你投的那个"稳健理财"平台，App 打不开了，客服电话是空号。群里有人说"老板跑路了"。',
      options: [
        { label: '报警，跟着维权', desc: '能追回多少算多少', eff: { cash: -60000, spirit: -4, skill: 2 }, log: '两年后你拿回了 11%，群里再也没人说话了。' },
        { label: '认栽，不再提', desc: '情绪止损', eff: { cash: -80000, spirit: -3 }, log: '你把那个 App 删了，也把"稳赚"两个字从人生里删了。' },
      ],
    },
    {
      id: 'ev_lottery', tag: '黑天鹅', weight: 1, once: true, ageMin: 25, ageMax: 55,
      title: '中了个小奖',
      text: '你随手买的彩票中了三等奖，税后 8000 块。这是你今年唯一一次运气好。',
      options: [
        { label: '存起来', desc: '难得清醒', eff: { cash: 8000, spirit: 2 }, log: '你把钱存进了定期，然后继续上班。' },
        { label: '请全组吃饭', desc: '人情投资', eff: { cash: -3000, relation: 4, spirit: 3 }, log: '那顿饭花了三千二，你在饭桌上第一次被叫"哥"。' },
      ],
    },

    // ------------------------------------------------ 机会
    {
      id: 'ev_transfer', tag: '机会', weight: 6, ageMin: 24, ageMax: 50,
      title: '内部转岗',
      text: '另一个部门缺人，问你有没有兴趣。工资不变，但那边"更有前景"。',
      options: [
        { label: '转', desc: '换赛道', eff: { skill: 5, spirit: 2, relation: -2, industry: 'other' }, log: '你转了，从头学起，三个月后开始带新人。' },
        { label: '不转，深耕现在的', desc: '复利', eff: { skill: 3, relation: 2, spirit: -1 }, log: '你在原岗位又待了五年，成了"最懂这块的人"，也成了"只能干这块的人"。' },
        { label: '要求涨薪再转', desc: '讲条件', eff: { salaryMul: 1.06, relation: -3, skill: 4 }, log: '对方答应了，你去了，然后发现他们只是想找个人填坑。' },
      ],
    },
    {
      id: 'ev_mentor', tag: '机会', weight: 5, once: true, ageMin: 24, ageMax: 40,
      title: '遇到贵人',
      text: '一个比你大十几岁的前辈，在一次饭局后单独跟你说："你这个人，我看得出来。"',
      options: [
        { label: '认真跟着学', desc: '长期主义', eff: { skill: 6, relation: 8, spirit: 3, salaryMul: 1.05 }, log: '他带你见了三个人，那三个人后来成了你职业生涯里最重要的三张名片。' },
        { label: '保持礼貌距离', desc: '不想欠人情', eff: { relation: 1, spirit: 1 }, log: '你说"谢谢您"，然后就没有然后了。' },
      ],
    },
    {
      id: 'ev_sidegrow', tag: '机会', weight: 5, ageMin: 26, ageMax: 50,
      title: '副业有起色',
      text: '你下班后弄的那个小生意，这个月流水破了五万。你在工位上偷偷看了三次后台。',
      options: [
        { label: '加大投入，准备转正', desc: '赌副业', eff: { cash: 60000, skill: 3, health: -5, spirit: 4, flags: { sideBusiness: true } }, log: '你把年假全用在发货上，然后开始认真算"辞职"两个字值多少钱。' },
        { label: '保持现状，小打小闹', desc: '稳妥', eff: { cash: 20000, spirit: 1, health: -2 }, log: '你维持着每个月两万的额外收入，也维持着每天六小时睡眠。' },
        { label: '关掉，专心主业', desc: '不贪', eff: { cash: 0, skill: 1, spirit: -2 }, log: '你关掉了店铺，第二天上班时觉得工位特别大。' },
      ],
    },
    {
      id: 'ev_startup', tag: '机会', weight: 4, once: true, ageMin: 27, ageMax: 45,
      need: function (S) { return S.stats.cash > 120000 && !S.flags.startup; },
      title: '有人拉你创业',
      text: '前同事说他要做一件事，"就差一个懂你这块的人"，还发了张 BP 的截图。',
      options: [
        { label: '辞职入伙，拿股份', desc: '高方差', eff: { salaryMul: 0.5, spirit: 4, health: -6, skill: 6, flags: { startup: true } }, log: '你成了联合创始人，名片上印着"CXO"，工资是每月 8000 的生活费。' },
        { label: '兼职帮忙，不辞职', desc: '两边下注', eff: { health: -4, skill: 3, cash: 20000, spirit: 1 }, log: '你白天上班，晚上开会，持续了一年半，然后就没了下文。' },
        { label: '拒绝，但介绍人给他', desc: '稳妥的人情', eff: { relation: 4, spirit: 1 }, log: '两年后那家公司融了 A 轮，你刷到新闻时正在吃午饭。' },
      ],
    },
    {
      id: 'ev_expat', tag: '机会', weight: 3, once: true, ageMin: 26, ageMax: 45,
      title: '外派机会',
      text: '公司要派人去海外项目，补贴是工资的 1.8 倍，要求是"至少待三年"。',
      options: [
        { label: '去，赚一笔', desc: '用青春换现金', eff: { salaryMul: 1.55, health: -8, spirit: -4, relation: -3, flags: { expat: true } }, log: '你去了，三年攒下了首付，也错过了侄子的出生和奶奶的葬礼。' },
        { label: '不去，留在国内', desc: '生活优先', eff: { spirit: 2, relation: 2 }, log: '你留下了，工资没涨，但每个周末都在。' },
      ],
    },
    {
      id: 'ev_mba', tag: '机会', weight: 3, ageMin: 27, ageMax: 40, need: function (S) { return S.stats.cash > 250000; },
      title: '要不要读个 MBA',
      text: '招生老师说得很好听："人脉、视野、第二曲线。"学费 38 万。',
      options: [
        { label: '读，贷款也读', desc: '买张门票', eff: { cash: -380000, skill: 8, relation: 7, health: -3, spirit: 2, flags: { mba: true } }, log: '你读了，认识了 60 个人，其中 3 个成了真朋友，1 个成了下一份工作的面试官。' },
        { label: '不读，钱拿去买理财', desc: '务实', eff: { cash: 0, spirit: -1 }, log: '你把钱存了定期，三年后它变成了……差不多还是那些。' },
      ],
    },
  ];

  // 事件按年龄/一次性过滤后做权重抽样
  // 频率：学生阶段两年最多一次，成年后三年最多一次；再乘一个概率。
  // 这样一条命大约弹出 6–8 张事件卡，而不是几乎每年一张。
  D.eventsMeta = {
    maxPerYear: 1,
    minGapSchool: 2,
    minGapAdult: 4,
    chanceSchool: 0.42,
    chanceAdult: 0.28,
  };
})();
