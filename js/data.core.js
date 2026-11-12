/* 工位 · 1 in 740 Million — 核心数据表
 * 设计原则：每个数字都要能溯源；拿不到的宁可留空。
 * region: 'CN' 为当前唯一实现，数据结构按多地区预留。
 */
(function () {
  const G = (typeof window !== 'undefined' ? window : globalThis);
  const GW = G.GW = G.GW || {};
  const D = GW.DATA = GW.DATA || {};

  // ---------------------------------------------------------------- meta
  D.meta = {
    title: '工位',
    subtitle: '1 in 740 Million',
    version: '0.5.1',
    region: 'CN',
    currency: 'CNY',
    symbol: '¥',
    startAge: 13,           // 初一开学
    schoolEnd: 18,          // 高考出分
    gradAge: 22,            // 正式入职
    retireAge: 60,
    tickMs: 7000,           // 成年后 1x 速度下一年 7 秒
    schoolTickMs: 4500,     // 学生阶段快一点
    taxRate: 0.12,          // 五险一金+个税的粗估综合扣除
    inflation: 0.025,
  };

  D.regions = {
    CN: {
      id: 'CN',
      name: '中国',
      laborForce: 740000000,
      laborForceNote: '约 7.4 亿就业人口（七普口径推算）',
      retireAge: 60,
      currency: 'CNY',
      dataNote: '分地区数据，中国版全部比例按全国口径标定',
    },
  };

  // ---------------------------------------------------------------- 出生地
  // weight 为就业人口分布近似；cost 为生活成本系数；rent 为单人房租(元/月, 2019不变价)
  D.cityTiers = {
    CN: [
      { id: 't1', name: '一线城市', weight: 6, cost: 1.62, rent: 3400, samples: ['北京', '上海', '深圳', '广州'] },
      { id: 't2', name: '新一线', weight: 14, cost: 1.28, rent: 2100, samples: ['杭州', '成都', '武汉', '西安', '苏州', '长沙'] },
      { id: 't3', name: '二线城市', weight: 20, cost: 1.00, rent: 1400, samples: ['洛阳', '徐州', '惠州', '唐山', '绵阳'] },
      { id: 't4', name: '三四线城市', weight: 28, cost: 0.80, rent: 900, samples: ['某地级市', '某县级市', '某区'] },
      { id: 't5', name: '县域', weight: 22, cost: 0.68, rent: 600, samples: ['某县城', '某镇'] },
      { id: 't6', name: '乡村', weight: 10, cost: 0.58, rent: 300, samples: ['某村'] },
    ],
  };

  // ---------------------------------------------------------------- 家庭
  D.families = {
    CN: [
      { id: 'gov', name: '体制内双职工', weight: 11, cash0: 260000, relation0: 12, spirit0: 4, ceiling: '一本', help: 0.9, interfere: 0.56, pref: 'safe', note: '家里最早的教学理念：稳定压倒一切' },
      { id: 'mid', name: '城市中产', weight: 15, cash0: 180000, relation0: 6, spirit0: 2, ceiling: '一本', help: 0.7, interfere: 0.50, pref: 'hot', note: '父母有一套房，也有一份不甘心' },
      { id: 'worker', name: '城市双职工', weight: 20, cash0: 60000, relation0: 0, spirit0: 0, ceiling: '二本', help: 0.35, interfere: 0.42, pref: 'safe', note: '不富，但每个月都有工资进账' },
      { id: 'biz', name: '个体户', weight: 12, cash0: 90000, relation0: 3, spirit0: -1, ceiling: '二本', help: 0.4, interfere: 0.44, pref: 'hot', note: '起早贪黑，账本比你的作业本厚' },
      { id: 'migrant', name: '进城务工', weight: 21, cash0: 20000, relation0: -4, spirit0: -2, ceiling: '专科', help: 0.08, interfere: 0.26, pref: 'safe', note: '一年见两次，一次过年，一次吵架' },
      { id: 'rural', name: '农村留守', weight: 21, cash0: 8000, relation0: -6, spirit0: -3, ceiling: '专科', help: 0.02, interfere: 0.30, pref: 'safe', note: '爷爷奶奶带大的，父母在很远的地方' },
    ],
  };

  // ---------------------------------------------------------------- 学习底子（抽签）
  // 注意：这不是"高考分数"，高考分数由初中/高中六年的选择推出来。
  D.aptitudes = {
    CN: [
      { id: 'a1', name: '学得进去', weight: 13, acad: 9, note: '老师讲一遍就懂，考前不用熬夜' },
      { id: 'a2', name: '中不溜', weight: 45, acad: 0, note: '不算聪明，也不算笨，主要看跟谁比' },
      { id: 'a3', name: '坐不住', weight: 27, acad: -7, note: '四十分钟像四年，窗外的鸟比课本有意思' },
      { id: 'a4', name: '开窍晚', weight: 15, acad: -4, late: true, note: '初一还垫底，初三突然会了，老师说"这孩子可惜了"' },
    ],
  };

  // ---------------------------------------------------------------- 高考分数档
  // 不是抽签表，是「学力 → 分数档」的阈值表：min 是达到该档所需的高考基础分。
  // 实际分布由学生阶段的选择决定（见 engine.rollGaokao）。
  D.scores = {
    CN: [
      { id: 's985', name: '够 985', min: 84, edu: '本科' },
      { id: 's1', name: '够一本', min: 70, edu: '本科' },
      { id: 's2', name: '够二本', min: 55, edu: '本科' },
      { id: 'sz', name: '够专科', min: 36, edu: '专科' },
      { id: 'sn', name: '够不上', min: 4, edu: '高中' },
    ],
  };

  // ---------------------------------------------------------------- 学历系数
  D.edus = {
    高中: { id: '高中', name: '高中/中职', mul: 0.74, skill0: 0 },
    专科: { id: '专科', name: '大专', mul: 0.86, skill0: 3 },
    本科: { id: '本科', name: '本科', mul: 1.0, skill0: 6 },
    硕士: { id: '硕士', name: '硕士', mul: 1.19, skill0: 10 },
    博士: { id: '博士', name: '博士', mul: 1.31, skill0: 14 },
  };

  // ---------------------------------------------------------------- 中考分流后的学校
  // acad: 高中三年学力生长系数；bonus: 高考加成（重点高中老师确实更会押题）
  D.schoolTracks = {
    key: { id: 'key', name: '重点高中', acad: 1.18, bonus: 9, cost: 5200, note: '一个班五十个人，四十八个在补课' },
    normal: { id: 'normal', name: '普通高中', acad: 1.0, bonus: 0, cost: 3600, note: '本科率写在门口的红榜上，一年比一年短' },
    voc: { id: 'voc', name: '职业高中', acad: 0.86, bonus: -14, cost: 2800, note: '学的是技术，考的是另一张卷子' },
    tech: { id: 'tech', name: '中专 / 技校', acad: 0.8, bonus: -18, cost: 2400, note: '第三年就进厂实习，工牌上写着"实习生"' },
    none: { id: 'none', name: '不读了', acad: 0.7, bonus: -30, cost: 0, note: '十五岁，身份证还没办，行李已经收好了' },
  };

  // ---------------------------------------------------------------- 学生阶段的重心
  // 只有一件事在涨：成绩。其余全是利息。
  D.focusSchool = {
    study: { id: 'study', name: '认真学', icon: '📖', desc: '把课本翻到起毛边', acad: 6.2, health: -0.7, spirit: -1.1, relation: -0.2, key: '1' },
    cram: { id: 'cram', name: '补课刷题', icon: '🧮', desc: '周末在另一个教室继续上课', acad: 8.4, health: -1.6, spirit: -2.6, relation: -0.4, cash: -6200, key: '2' },
    play: { id: 'play', name: '打球 / 玩', icon: '🏀', desc: '操场比教室有意思', acad: -2.0, health: 2.4, spirit: 2.6, relation: 1.4, key: '3' },
    love: { id: 'love', name: '早恋 / 社交', icon: '💌', desc: '传纸条，传了整整一学期', acad: -2.6, health: -0.2, spirit: 3.4, relation: 3.2, key: '4' },
    earn: { id: 'earn', name: '打工 / 帮家里', icon: '🧾', desc: '早一点知道钱是怎么来的', acad: -1.8, health: -1.2, spirit: -0.6, relation: 1.0, skill: 0.6, cash: 9000, key: '5' },
    game: { id: 'game', name: '上网 / 游戏', icon: '🕹', desc: '网吧包夜，五块钱', acad: -4.0, health: -2.4, spirit: 4.2, relation: 0.6, key: '6' },
  };
  D.focusSchoolOrder = ['study', 'cram', 'play', 'love', 'earn', 'game'];
  D.focusTagsSchool = {
    study: ['成绩↑', '心气↓'],
    cram: ['成绩↑↑', '花钱↓'],
    play: ['健康↑', '成绩↓'],
    love: ['心气↑', '成绩↓'],
    earn: ['钱↑', '成绩↓'],
    game: ['心气↑', '健康↓'],
  };

  // ---------------------------------------------------------------- 专业门类
  D.majors = {
    CN: [
      { id: 'cs', name: '计算机', weight: 9, match: 0.86, note: '当年全村的骄傲，现在全公司的候补' },
      { id: 'fin', name: '金融/经济', weight: 8, match: 0.55, note: '以为要去华尔街，最后在卖理财' },
      { id: 'law', name: '法学', weight: 5, match: 0.42, note: '法考过了的没几个，过了的也没几个赚钱' },
      { id: 'med', name: '医学', weight: 6, match: 0.92, note: '同学都老了，你还年轻，因为你没睡过' },
      { id: 'edu', name: '师范', weight: 7, match: 0.8, note: '稳定，寒暑假，和家长的微信' },
      { id: 'eng', name: '机械/土木', weight: 13, match: 0.83, note: '画图的，后来画饼的，再后来没图可画' },
      { id: 'art', name: '艺术设计', weight: 5, match: 0.3, note: '你的作品集比他的人生规划还厚' },
      { id: 'lang', name: '外语/文学', weight: 4, match: 0.28, note: '学了一门语言，用来翻译招聘要求里的"年龄35以下"' },
      { id: 'sci', name: '理科基础', weight: 4, match: 0.35, note: '什么都学，什么都能转，什么都得重新学' },
      { id: 'mgt', name: '管理/商科', weight: 9, match: 0.4, note: '学管理，最后被管理' },
      { id: 'agr', name: '农林/生物', weight: 6, match: 0.33, note: '"天坑"两个字，是学长用十年告诉你的' },
      { id: 'soc', name: '社科/新闻', weight: 5, match: 0.25, note: '毕业那年，行业刚好"转型"' },
      { id: 'other', name: '其他', weight: 19, match: 0.4, note: '说不清学的是什么，也说不上用在哪' },
    ],
  };

  // ---------------------------------------------------------------- 行业
  // hours 为周均工时(含隐性加班)；cycle 为景气度；vol 为收入波动
  D.industries = {
    CN: [
      { id: 'internet', name: '互联网/软件', weight: 6, mul: 1.36, hours: 54, cycle: 0.8, layoff: 0.11, vol: 0.15, note: '工资高，命短，PPT 长' },
      { id: 'finance', name: '金融', weight: 4, mul: 1.31, hours: 51, cycle: 0.5, layoff: 0.08, vol: 0.3, note: '客户经理的客户，最后都是亲戚' },
      { id: 'med', name: '医疗', weight: 6, mul: 1.02, hours: 52, cycle: 1.0, layoff: 0.02, vol: 0.05, note: '铁饭碗，铁的，很重' },
      { id: 'edu', name: '教培/教育', weight: 6, mul: 0.82, hours: 46, cycle: 0.45, layoff: 0.14, vol: 0.2, note: '2021 年那一刀，很多人现在还没缓过来' },
      { id: 'gov', name: '机关/事业单位', weight: 8, mul: 0.95, hours: 43, cycle: 1.05, layoff: 0.004, vol: 0.02, note: '工资不高，但没人半夜给你发"收到请回复"' },
      { id: 'soe', name: '国企/制造', weight: 18, mul: 0.88, hours: 49, cycle: 0.85, layoff: 0.05, vol: 0.08, note: '稳定到你能看见自己 30 年后的工位' },
      { id: 'build', name: '建筑/地产', weight: 12, mul: 0.86, hours: 51, cycle: 0.35, layoff: 0.16, vol: 0.12, note: '工地上的风，比老板的话实在' },
      { id: 'retail', name: '批发零售/服务', weight: 17, mul: 0.66, hours: 50, cycle: 0.8, layoff: 0.12, vol: 0.1, note: '站着上班，坐着吃饭，躺着刷手机到两点' },
      { id: 'logi', name: '物流/运输', weight: 8, mul: 0.72, hours: 55, cycle: 0.9, layoff: 0.1, vol: 0.09, note: '你在运别人的生活' },
      { id: 'media', name: '文化/传媒', weight: 3, mul: 0.78, hours: 48, cycle: 0.4, layoff: 0.13, vol: 0.18, note: '给甲方写"有温度的品牌故事"' },
      { id: 'sales', name: '销售/渠道', weight: 10, mul: 0.75, hours: 50, cycle: 0.7, layoff: 0.15, vol: 0.35, note: '底薪是礼貌，提成是命' },
      { id: 'other', name: '其他', weight: 12, mul: 0.8, hours: 48, cycle: 0.8, layoff: 0.1, vol: 0.12, note: '介绍自己的工作时，需要先说三段背景' },
    ],
  };

  // ---------------------------------------------------------------- 岗位
  D.roles = {
    CN: [
      { id: 'exec', name: '执行岗', mul: 0.92, skill: 1.0, ceiling: 55, note: '谁都能替代你，包括打印机' },
      { id: 'tech', name: '技术岗', mul: 1.12, skill: 1.25, ceiling: 80, note: '你不会说话，所以你会干活' },
      { id: 'salesR', name: '销售岗', mul: 0.85, skill: 0.9, ceiling: 72, note: '你的 KPI 比你的感情生活稳定' },
      { id: 'mgmt', name: '管培/管理', mul: 1.05, skill: 1.1, ceiling: 88, note: '一毕业就管人，管的是比你大十岁的人' },
      { id: 'blue', name: '蓝领技工', mul: 0.88, skill: 1.05, ceiling: 46, note: '手艺是真的，社保是假的' },
    ],
  };

  // ---------------------------------------------------------------- 隐性属性（抽签）
  D.traits = {
    CN: [
      { id: 'fit', name: '底子硬', weight: 22, health0: 7, spirit0: 2, note: '熬夜后第二天还能上班' },
      { id: 'weak', name: '底子薄', weight: 18, health0: -8, spirit0: -1, note: '换季必感冒，感冒必两周' },
      { id: 'social', name: '会来事', weight: 24, relation0: 8, spirit0: 1, note: '能在电梯里跟领导聊完一个季度' },
      { id: 'quiet', name: '不太会说话', weight: 26, relation0: -6, skill0: 3, note: '群里回复永远是"1"' },
      { id: 'tough', name: '皮实', weight: 10, health0: 3, spirit0: 6, note: '被骂完还能睡着，这是天赋' },
    ],
  };

  // ---------------------------------------------------------------- 每年重心
  D.focus = {
    career: { id: 'career', name: '拼事业', icon: '💼', desc: '把命换成职级', hours: 7, health: -0.45, spirit: -0.7, skill: 2.6, relation: 1.4, growth: 0.024, key: '1' },
    learn: { id: 'learn', name: '学技能', icon: '📚', desc: '给未来留一手', hours: 3, health: -0.2, spirit: 0.1, skill: 5.0, relation: 0, growth: 0.004, key: '2' },
    network: { id: 'network', name: '搞关系', icon: '🍻', desc: '人脉是另一种学历', hours: 4, health: -0.5, spirit: -0.8, skill: 0.3, relation: 3.6, growth: 0.008, key: '3' },
    health: { id: 'health', name: '顾身体', icon: '🥗', desc: '体检报告还没出', hours: -8, health: 2.6, spirit: 0.4, skill: 0.2, relation: -0.2, growth: -0.012, key: '4' },
    family: { id: 'family', name: '陪家人', icon: '🏠', desc: '孩子只长大一次', hours: -5, health: 0.4, spirit: 1.2, skill: -0.6, relation: 1.2, growth: -0.016, key: '5' },
    side: { id: 'side', name: '搞副业', icon: '🌙', desc: '多一条退路', hours: 5, health: -0.7, spirit: 0.4, skill: 1.0, relation: 0.2, growth: -0.02, sideIncome: 0.16, key: '6' },
  };
  D.focusOrder = ['career', 'learn', 'network', 'health', 'family', 'side'];

  // ---------------------------------------------------------------- 结局
  D.endings = [
    { id: 'default', name: '普通地活着', line: '你没有成为谁的榜样，也没有成为谁的教训。' },
    { id: 'debt', name: '断供', line: '房子被收走那天，你才发现自己只拥有过它的照片。' },
    { id: 'debt2', name: '负债累累', line: '你的存款是负数，账本比人生还长。' },
    { id: 'sick', name: '提前病退', line: '体检报告上那一行加粗的字，改写了下半辈子。' },
    { id: 'burnout', name: '心气耗尽', line: '你没有辞职，也没有崩溃，只是从某一天起不再期待周一以外的事。' },
    { id: 'burn', name: '透支成功', line: '你赢了，赢的方式是把身体分期付款给了公司。' },
    { id: 'decent', name: '体面退场', line: '不算成功，但足够在同学会上笑着说"还行"。' },
    { id: 'steady', name: '稳稳的一生', line: '四平八稳，没有故事，也没有事故。' },
    { id: 'middle', name: '沉默的中层', line: '你在主管这个位置上待了十九年，名片换了四版，头衔没变。' },
    { id: 'restart', name: '重启者', line: '四十五岁那年你把前半生清盘，居然还来得及。' },
    { id: 'freelance', name: '自由职业的第十年', line: '没有领导，没有年终奖，也没有周末的概念。' },
    { id: 'forgotten', name: '没被选中的人', line: '你在每一轮名单里都不是第一个，也不是最后一个，只是没有出现。' },
    { id: 'boss', name: '自己当老板', line: '你终于不用看老板脸色了，现在有三十个人看你的脸色。' },
  ];

  // ---------------------------------------------------------------- 数据来源
  D.sources = [
    { k: '分行业平均工资 / 全国工资水平', v: '国家统计局《国民经济和社会发展统计公报》《中国统计年鉴》', type: '官方' },
    { k: '城镇调查失业率 / 周平均工作时间', v: '国家统计局月度与年度发布（周工时近年长期在 48–49 小时区间）', type: '官方' },
    { k: '居民人均可支配收入 / 城乡差距', v: '国家统计局年度统计公报（城乡收入比约 2.3–2.5）', type: '官方' },
    { k: '行业、职业、学历结构', v: '第七次全国人口普查长表数据', type: '官方' },
    { k: '各教育阶段升学率', v: '教育部《全国教育事业发展统计公报》（普高录取率约五成、本科录取率约四成）', type: '官方' },
    { k: '中考普职分流比例', v: '教育部《高中阶段教育普及攻坚计划》与各省招生计划（普职比大体相当）', type: '官方' },
    { k: '35 岁招聘门槛、跳槽涨薪幅度', v: '智联招聘 / BOSS 直聘 / 脉脉年度人才报告', type: '平台样本' },
    { k: '行业裁员率与周期', v: '上市公司年报裁员披露 + 平台样本，按行业加权', type: '估算' },
    { k: '健康衰减、慢病与过劳风险', v: '《中国卫生健康统计年鉴》、过劳相关流行病学研究', type: '官方+文献' },
    { k: '房贷利率与月供', v: '按 30 年等额本息、年利率 4.9% 近似折算', type: '建模假设' },
  ];

  // ---------------------------------------------------------------- 姓名
  D.names = {
    CN: {
      surname: [
        ['王','wang'],['李','li'],['张','zhang'],['刘','liu'],['陈','chen'],['杨','yang'],
        ['黄','huang'],['赵','zhao'],['周','zhou'],['吴','wu'],['徐','xu'],['孙','sun'],
        ['马','ma'],['朱','zhu'],['胡','hu'],['郭','guo'],['何','he'],['林','lin'],
        ['高','gao'],['罗','luo'],['郑','zheng'],['梁','liang'],['谢','xie'],['宋','song']
      ],
      male: ['伟','强','磊','军','洋','勇','杰','涛','斌','超','明','刚','平','辉','鹏','宇','浩','鑫','晨','博','一鸣','子轩','浩然'],
      female: ['芳','娜','敏','静','丽','娟','艳','霞','燕','婷','雪','颖','倩','琳','悦','欣','然','佳','璐','萱','雨桐','思远','若溪'],
    },
  };

  D.familyJobs = {
    CN: {
      gov: { father: '公务员', mother: '小学教师' },
      mid: { father: '企业中层', mother: '会计' },
      worker: { father: '工厂工人', mother: '商场店员' },
      biz: { father: '开小卖部', mother: '看店' },
      migrant: { father: '在外务工', mother: '在外务工' },
      rural: { father: '务农', mother: '务农' },
    },
  };

  D.relStatus = ['关系平顺', '关系亲密', '关系疏离', '关系紧张'];

  // 家长会替你填成什么（志愿被改时用）
  D.parentMajor = {
    safe: { name: '师范 / 医学 / 机械', line: '稳定，有编制，饿不死，也说不上喜欢' },
    hot: { name: '计算机 / 金融', line: '赚钱，体面，你爸在饭桌上能说得出口' },
  };

  D.sceneDesc = {
    t1: '高楼之间，地铁口的风',
    t2: '新区，写字楼和工地挨着',
    t3: '老城区，六层楼没有电梯',
    t4: '地级市，一条主街走到头',
    t5: '县城，晚上九点街上就没人',
    t6: '村子，狗比人多',
  };

  // 重心选项上显示的效果标签
  D.focusTags = {
    career: ['职级↑', '健康↓'],
    learn: ['能力↑', '自由↓'],
    network: ['关系↑', '心气↓'],
    health: ['健康↑', '晋升↓'],
    family: ['心气↑', '钱↓'],
    side: ['钱↑', '健康↓'],
  };

  // ---------------------------------------------------------------- 风味文本
  D.flavor = {
    tick: [
      '又是一年。你妈的微信头像换成了花开富贵。',
      '公司在群里发了新的价值观，一共八个词，你记住了两个。',
      '你在地铁上刷到"35 岁被裁后我开了家咖啡店"，划走了。',
      '今年体检加了甲状腺彩超，医生说得很快，你没听清。',
      '同事结婚了，随了 600。你算了算这个月的花呗。',
      '你把自己的简历更新了一遍，又关掉了。',
      '领导在周会上说"大家要有危机感"，然后休了年假。',
      '你开始理解为什么爸妈那辈人那么看重编制。',
      '这一年没什么大事，除了你又老了一岁。',
      '楼下的店换了三次招牌，你的工位没换。',
      '你学会了一个新词：降本增效。',
      '春节回家，亲戚问工资，你说"还行"，然后低头夹菜。',
      '你发现自己的购物车从球鞋变成了护腰。',
      '公司新来的实习生管你叫"老师"。',
      '你在深夜的工位上，第一次认真考虑回老家。',
      '今年的年终奖，是一封感谢信。',
    ],
    lowHealth: [
      '你连续第三周在凌晨两点后睡觉，早上靠咖啡因启动。',
      '体检报告上多了两个箭头，你把报告折起来放进抽屉。',
      '你开始习惯性地揉后颈，像揉一块不属于自己的肉。',
    ],
    lowSpirit: [
      '你发现自己已经很久没有期待过任何事情了。',
      '你在工位上坐着，突然想不起自己为什么在这里。',
      '你在电梯里看着镜子里的自己，觉得那个人有点陌生。',
    ],
    school: [
      '班主任在走廊上叫住你，说"你最近有点飘"。',
      '月考排名贴在教室后墙，你从下往上看，找了很久。',
      '同桌在草稿纸上写了一个名字，你假装没看见。',
      '你妈把你的手机收了，说"考完再给你"，然后忘了这回事。',
      '体育课被数学老师借走了，理由永远是"你们班进度慢"。',
      '你偷偷在课桌里看小说，被没收了一本，还剩三本。',
      '你在小卖部赊了一包辣条，老板娘记在了一个小本子上。',
      '晚自习停电，全班欢呼了三秒，然后老师拿出了手电筒。',
      '你在作文里写"我的理想"，编了一个自己都不信的回答。',
      '中考倒计时牌翻到了 100 天，你突然有点慌。',
    ],
    repeat: [
      '复读班的黑板上写着"距离高考还有 300 天"，字是上一届写的，一直没擦。',
      '你妈把这一年的补课费说成"投资"，说的时候没看你。',
      '你在复读学校的走廊上遇到了初中同桌，他去年也差 11 分。',
      '第二次进考场，你发现监考老师还是去年那个，他好像认出了你。',
      '你在复读班的排名从第 40 名到了第 12 名，老师说"早这样多好"。',
    ],
    promotion: ['你升了一级，工资涨了，会也多了。', '你被任命为小组负责人，从此要为别人的错误写检讨。', '你的名字出现在了新的组织架构图里，比上次大了一点。'],
    layoff: ['HR 约你"聊一聊"，会议室里有两杯水，只有一杯是给你的。', '你被"优化"了，补偿是 N+1，态度是 N-1。', '你的工位在一个周五下午被清空，绿植归了邻座。'],
  };

  G.GW.DATA = D;
})();
