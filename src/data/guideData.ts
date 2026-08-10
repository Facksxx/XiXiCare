import type { GuideAgeStage } from '../types/baby';

export const guideData: GuideAgeStage[] = [
  {
    id: '1',
    ageRange: '0 - 1 个月 (新生儿)',
    milkRequirement: {
      amountDesc: '每次 30 - 90 ml (按需喂养)',
      frequencyDesc: '每 2 - 3 小时一次，每天约 8 - 12 次',
      breastfeedingTips: '新生儿胃容量小，应进行按需哺乳。双侧乳房交替进行，每侧吸吮 15 - 20 分钟以确保吸到高脂肪的后奶。'
    },
    vaccineGuide: {
      title: '新生儿期疫苗',
      vaccines: [
        { name: '乙肝疫苗 (第1剂)', age: '出生时', note: '出生后24小时内接种' },
        { name: '卡介苗 (BCG)', age: '出生时', note: '预防结核病' }
      ]
    },
    milestones: {
      grossMotor: ['趴卧时能尝试抬头片刻', '有强烈的本能反射（如寻乳反射、踏步反射）'],
      fineMotor: ['双手常呈握拳状态', '有抓握反射（触碰掌心会自动握紧）'],
      languageSocial: ['通过不同调子的哭声表达饥饿、疼痛或不适', '注视距离眼前 20-30 厘米的人脸或移动物体']
    }
  },
  {
    id: '2',
    ageRange: '1 - 3 个月',
    milkRequirement: {
      amountDesc: '每次 90 - 150 ml',
      frequencyDesc: '每 3 - 4 小时一次，每天约 6 - 8 次',
      breastfeedingTips: '乳汁分泌已达平稳期。如果夜间宝宝睡眠较长（如超过5小时），无需刻意唤醒喂奶，可逐步培养夜间作息。'
    },
    vaccineGuide: {
      title: '1-3个月疫苗',
      vaccines: [
        { name: '乙肝疫苗 (第2剂)', age: '1个月时', note: '与第1剂间隔≥28天' },
        { name: '脊灰灭活疫苗 (第1剂)', age: '2个月时' },
        { name: '百白破疫苗 (第1剂)', age: '3个月时' }
      ]
    },
    milestones: {
      grossMotor: ['趴着时抬头能达到 45 度甚至 90 度，并用前臂支撑身体', '身体开始变得协调，手脚踢动更平稳'],
      fineMotor: ['小手逐渐张开，开始主动将手放进嘴里吸吮', '会摆动小手尝试去触碰挂在眼前的玩具'],
      languageSocial: ['开始发出"啊"、"哦"、"咕噜"等单音（咿呀学语）', '会展现出社交性微笑（看到妈妈的脸会笑）']
    }
  },
  {
    id: '3',
    ageRange: '3 - 6 个月',
    milkRequirement: {
      amountDesc: '每次 120 - 180 ml (每日总量约 800-900ml)',
      frequencyDesc: '每 4 小时一次，每天约 5 - 6 次',
      breastfeedingTips: '本阶段可能经历婴儿猛长期（Growth Spurt），表现为胃口突然增大或情绪烦躁，通常持续数天，继续保持按需喂养即可。'
    },
    vaccineGuide: {
      title: '3-6个月疫苗',
      vaccines: [
        { name: '脊灰灭活疫苗 (第2剂)', age: '4个月时' },
        { name: '百白破疫苗 (第2剂)', age: '5个月时' },
        { name: '乙肝疫苗 (第3剂)', age: '6个月时', note: '完成乙肝免疫' }
      ]
    },
    milestones: {
      grossMotor: ['可以从仰卧轻松翻身到俯卧（或单向翻身）', '扶着腋下站立时，双腿能主动用力支撑'],
      fineMotor: ['能主动伸手抓住玩具，并能把玩具准确送到嘴里', '两只手能在胸前握在一起玩耍'],
      languageSocial: ['听到声音会迅速转头寻找声源，逗引时会发出咯咯大笑声', '可以通过不同的表情和声音与看护者互动']
    }
  },
  {
    id: '4',
    ageRange: '6 - 8 个月',
    milkRequirement: {
      amountDesc: '每次 150 - 210 ml (每日奶量约 700-800ml)',
      frequencyDesc: '每天 4 - 5 次奶，开始尝试 1 - 2 顿辅食',
      breastfeedingTips: '此阶段必须引入辅食以补充铁质，但母乳或配方奶仍是主要营养来源，辅食仅为尝试。'
    },
    vaccineGuide: {
      title: '6-8个月疫苗',
      vaccines: [
        { name: '百白破疫苗 (第3剂)', age: '6个月时' },
        { name: '麻腮风疫苗 (第1剂)', age: '8个月时', note: '预防麻疹、腮腺炎、风疹' },
        { name: '乙脑减毒活疫苗 (第1剂)', age: '8个月时', note: '夏秋季流行前接种' }
      ]
    },
    solidsGuide: {
      stageTitle: '起步阶段：细腻泥糊状',
      textureDesc: '强化铁婴儿米粉、红薯泥、南瓜泥、苹果泥、香蕉泥。性状如稀芝麻糊。',
      allergenChecklist: ['婴儿米粉（大米）', '蛋黄（可先从1/8大小试起）', '苹果泥', '胡萝卜泥', '香蕉泥'],
      tips: '每次只添加一种新食物，持续喂 3 天。观察是否有皮疹、腹泻、呕吐等过敏反应。若有，应立即暂停该食物。'
    },
    milestones: {
      grossMotor: ['能不用手支撑独立坐稳数分钟', '会尝试用小手和膝盖支撑身体前后摇晃，为爬行做准备'],
      fineMotor: ['学会了"一把抓"玩具，能将玩具从一只手换到另一只手', '能用两只手各拿一个积木'],
      languageSocial: ['开始发出双音节，如"da-da"、"ba-ba"，但通常无意识', '对自己的名字有反应，开始对陌生人表现出警惕或害羞']
    }
  },
  {
    id: '5',
    ageRange: '8 - 12 个月',
    milkRequirement: {
      amountDesc: '每次 180 - 240 ml (每日奶量约 600-700ml)',
      frequencyDesc: '每天 3 - 4 次奶，辅食增加至 2 - 3 顿',
      breastfeedingTips: '可逐渐让宝宝适应先吃辅食后喝奶的顺序，将辅食逐步代替一顿正餐。'
    },
    vaccineGuide: {
      title: '8-12个月疫苗',
      vaccines: [
        { name: '麻腮风疫苗 (第2剂)', age: '12个月时', note: '与第1剂间隔≥1年' },
        { name: '水痘疫苗 (第1剂)', age: '1岁时', note: '预防水痘' }
      ]
    },
    solidsGuide: {
      stageTitle: '进阶阶段：颗粒与软手抓食物',
      textureDesc: '烂面条、碎菜粥、小肉丸、软香蕉片、小块土豆。性状由粗泥过渡至碎末、软颗粒。',
      allergenChecklist: ['全蛋（蛋清）', '小麦（面条）', '鳕鱼/三文鱼', '豆腐/大豆制品', '番茄泥'],
      tips: '鼓励宝宝使用手抓食物（Finger Foods），锻炼手眼协调及咀嚼能力。引入软固体可降低未来挑食的概率。'
    },
    milestones: {
      grossMotor: ['能熟练地手膝爬行，并能扶着家具站立甚至横向挪步', '能从坐姿自己站起来'],
      fineMotor: ['学会用大拇指和食指对捏（Pincer Grasp）细小物件（如小饼干）', '会主动松手扔玩具让大人捡，并喜欢敲击两个玩具'],
      languageSocial: ['能理解简单的词汇（如"不要"、"过来"），会模仿挥手再见、拍手欢迎', '能含糊地发出有意识的"妈妈"或"爸爸"']
    }
  },
  {
    id: '6',
    ageRange: '12 - 18 个月',
    milkRequirement: {
      amountDesc: '每日 400 - 500 ml 奶量 (可引入巴氏鲜奶)',
      frequencyDesc: '每天 2 次奶，主食一日三餐，与大人作息同步',
      breastfeedingTips: '如果继续母乳喂养，可以按需哺乳。若使用配方奶，可在此阶段引导用吸管杯或敞口杯代替奶瓶，减少对奶嘴的依赖。'
    },
    vaccineGuide: {
      title: '12-18个月疫苗',
      vaccines: [
        { name: '水痘疫苗 (第2剂)', age: '18个月时', note: '与第1剂间隔≥3年' },
        { name: '甲肝疫苗 (第1剂)', age: '18个月时', note: '预防甲型肝炎' }
      ]
    },
    solidsGuide: {
      stageTitle: '成熟阶段：软烂家常食物',
      textureDesc: '软米饭、小饺子、剪碎的蔬菜与肉类。可以开始吃大部分家庭膳食（低盐低油）。',
      allergenChecklist: ['鲜牛奶/酸奶', '花生/坚果酱（稀释涂抹）', '虾/蟹等贝壳类', '奇异果/芒果'],
      tips: '不要给宝宝吃整颗坚果、整颗葡萄等易窒息食物。不额外添加糖，少盐。尊重宝宝的食欲，不强迫进食。'
    },
    milestones: {
      grossMotor: ['能独立行走，虽然可能双脚分得较开、步态摇晃', '能弯腰捡起地上的玩具而不会摔倒'],
      fineMotor: ['会搭 2 - 3 块积木，能尝试用勺子送饭到嘴里（虽然常洒出）', '会翻书页，喜欢用手指指着感兴趣的物品'],
      languageSocial: ['能说出 5 - 10 个有具体指代意义的单字（如"抱"、"拿"、"猫"）', '能听懂简单的指令并执行（如"把球给妈妈"）']
    }
  },
  {
    id: '7',
    ageRange: '18 - 24 个月',
    milkRequirement: {
      amountDesc: '每日 350 - 400 ml 奶量 (鲜奶或幼儿配方奶)',
      frequencyDesc: '每天 1 - 2 次奶，保证均衡膳食',
      breastfeedingTips: '乳类此时属于膳食结构的一部分，主要起补充钙和优质蛋白的作用。'
    },
    vaccineGuide: {
      title: '18-24个月疫苗',
      vaccines: [
        { name: '甲肝疫苗 (第2剂)', age: '18-24个月', note: '与第1剂间隔6个月' },
        { name: '流脑疫苗', age: '2岁时', note: '预防流行性脑膜炎' }
      ]
    },
    solidsGuide: {
      stageTitle: '多样化阶段：家庭共餐',
      textureDesc: '块状固体，正常硬度的家庭食物，剪成小块。鼓励独立用勺子和叉子进食。',
      allergenChecklist: ['蜂蜜（1岁以上可以安全食用）', '各种海鲜', '坚果碎（注意防呛）'],
      tips: '开始出现"第一叛逆期"，可能挑食或拒绝进食。提供健康选择，让宝宝自主决定吃多少，营造轻松的进餐氛围。'
    },
    milestones: {
      grossMotor: ['跑步平稳，能独立上下楼梯（一步一阶，扶扶手）', '能原地单脚踢球，可以倒退着走'],
      fineMotor: ['会搭 4 - 6 块积木，能用画笔在纸上乱涂画线', '会自己脱掉简单的鞋袜，拉下拉链'],
      languageSocial: ['词汇量爆发，能把两个词拼在一起说（如"妈妈抱"、"吃苹果"）', '开始表现出自我意识，经常说"不"或"我的"']
    }
  },
  {
    id: '8',
    ageRange: '24 - 36 个月',
    milkRequirement: {
      amountDesc: '每日 300 - 350 ml 奶量或等量奶制品（奶酪、酸奶）',
      frequencyDesc: '三餐主食外，提供 1-2 次健康点心和适量奶制品',
      breastfeedingTips: '若妈妈和宝宝都愿意，可继续母乳。若已断奶，确保每日膳食中有充足的钙来源（如奶酪、深绿叶菜、豆腐）。'
    },
    vaccineGuide: {
      title: '2-3岁疫苗',
      vaccines: [
        { name: '乙脑减毒活疫苗 (第2剂)', age: '2岁时', note: '与第1剂间隔1年以上' },
        { name: '流感疫苗', age: '每年接种', note: '每年秋季接种，预防季节性流感' }
      ]
    },
    solidsGuide: {
      stageTitle: '自主进食阶段',
      textureDesc: '与成人食物一致，避免过硬、过辣、高盐、高糖食品即可。',
      allergenChecklist: ['各种热带水果', '复合坚果制品'],
      tips: '注意培养良好的饮食习惯：定时定量，坐椅子上吃饭，不看电视或手机进食。'
    },
    milestones: {
      grossMotor: ['双脚能轻松原地跳起，能单脚站立 1 - 2 秒', '会骑三轮脚踏车，能手扶栏杆一步一阶上下楼'],
      fineMotor: ['能穿起大珠子，会用剪刀剪纸（安全剪刀），会模仿画圆圈', '能像握笔一样拿笔，会自己穿简单的套头衫'],
      languageSocial: ['能说 3 - 5 个词的短句，会询问"为什么？"、"这是什么？"', '能与同伴进行简单的分享和合作游戏，开始进行角色扮演游戏']
    }
  }
];
