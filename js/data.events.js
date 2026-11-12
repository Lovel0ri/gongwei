/* 工位 — 事件卡
 * 每张卡 2–3 个应对，不做对错，只做贵贱。
 * eff 字段：cash(元) / salaryMul(比例) / health / spirit / skill / relation / flags / industry / role / edu
 */
(function () {
  const G = (typeof window !== 'undefined' ? window : globalThis);
  const GW = G.GW = G.GW || {};
  const D = GW.DATA = GW.DATA || {};

  D.events = [
    // ------------------------------------------------ 组织
    {
      id: 'ev_newboss', tag: '组织', weight: 9, once: true, ageMin: 23, ageMax: 55,
      title: '空降领导',
      text: '部门来了新领导，开会第一句是"我不喜欢形式主义"，第二句是"以后每周交周报"。',
      options: [
        { label: '第二天就去单独汇报', desc: '先站队，后干活', eff: { relation: 7, spirit: -3, cash: 0 }, log: '你在新领导办公室待了四十分钟，出来时笑得很标准。' },
        { label: '先观察三个月', desc: '不站队，也不掉队', eff: { relation: 1, spirit: -1 }, log: '你决定让子弹飞一会儿，子弹飞了三年。' },
        { label: '开始更新简历', desc: '心里已经走了', eff: { skill: 2, spirit: 1, salaryMul: 0 }, log: '你把简历改成了"结果导向型"，然后保存为 PDF。' },
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
      title: '朋友借钱',
      text: '一个很久没联系的朋友突然发来消息："在吗，有点事想跟你说。"',
      options: [
        { label: '借，两万', desc: '人情', eff: { cash: -20000, relation: 6, spirit: 1, flags: { lentMoney: true } }, log: '你转了钱，他说"下个月一定还"，现在已经过去三个下个月了。' },
        { label: '借五千，说手头紧', desc: '折中', eff: { cash: -5000, relation: 2 }, log: '他收了，然后你们再也没聊过。' },
        { label: '不借，找理由', desc: '保住钱', eff: { relation: -6, spirit: -2 }, log: '你说了句"最近也紧张"，然后翻出他上个月的朋友圈：马尔代夫。' },
      ],
    },
    {
      id: 'ev_school', tag: '生活', weight: 5, ageMin: 33, ageMax: 50, need: function (S) { return S.stats.cash > 250000; },
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
      id: 'ev_startup', tag: '机会', weight: 4, once: true, ageMin: 27, ageMax: 45, need: function (S) { return S.stats.cash > 120000; },
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
  D.eventsMeta = { maxPerYear: 1 };
})();
