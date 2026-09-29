package com.xixicare.app

data class GuideStage(val id: Int, val range: String, val amount: String, val frequency: String, val tip: String, val solids: String, val milestones: List<String>, val allergens: List<String>)
val guideStages = listOf(
    GuideStage(1,"0-1个月","每次30-90ml","每2-3小时，每天8-12次","按需哺乳，双侧乳房交替，每侧15-20分钟。","暂不添加辅食",listOf("趴卧时尝试抬头","双手常呈握拳状态","通过哭声表达需要"), emptyList()),
    GuideStage(2,"1-3个月","每次90-150ml","每3-4小时，每天6-8次","夜间睡眠较长时无需刻意唤醒。","暂不添加辅食",listOf("俯卧抬头45-90度","小手逐渐张开","开始发出单音"), emptyList()),
    GuideStage(3,"3-6个月","每次120-180ml","每4小时，每天5-6次","猛长期继续按需喂养。","满6个月前后再开始辅食",listOf("开始翻身","主动抓握玩具","会咯咯大笑"), emptyList()),
    GuideStage(4,"6-8个月","每次150-210ml","每天4-5次奶，1-2顿辅食","奶仍是主要营养来源。","强化铁米粉、蔬菜泥、水果泥",listOf("能独坐数分钟","玩具换手","对名字有反应"),listOf("婴儿米粉","蛋黄","苹果泥","胡萝卜泥","香蕉泥")),
    GuideStage(5,"8-12个月","每次180-240ml","每天3-4次奶，2-3顿辅食","逐步建立正餐顺序。","烂面、碎菜粥、软手抓食物",listOf("熟练爬行","拇指食指对捏","理解简单词汇"),listOf("全蛋","小麦","鱼类","豆制品","番茄")),
    GuideStage(6,"12-18个月","每日400-500ml","每天2次奶，一日三餐","用吸管杯或敞口杯替代奶瓶。","软米饭、小饺子、剪碎肉菜",listOf("独立行走","搭2-3块积木","能说有意义单字"),listOf("鲜奶","花生酱","虾蟹","奇异果")),
    GuideStage(7,"18-24个月","每日350-400ml","每天1-2次奶","提供均衡膳食，不强迫进食。","家庭共餐，鼓励独立使用餐具",listOf("跑步更平稳","搭4-6块积木","能说两个词短句"),listOf("蜂蜜","各种海鲜","坚果碎")),
    GuideStage(8,"24-36个月","每日300-350ml","三餐加1-2次点心","保持定时定量和专注进餐。","正常家庭食物，避免高盐高糖",listOf("能双脚跳","会模仿画圆","会说3-5词短句"),listOf("热带水果","复合坚果制品"))
)

data class VaccineChoice(val id:String,val name:String,val price:Int=0)
data class VaccineItem(val id:String,val month:Double,val age:String,val dose:String,val choices:List<VaccineChoice>,val note:String="")
private fun f(id:String,name:String)=VaccineChoice(id,name)
private fun p(id:String,name:String,price:Int)=VaccineChoice(id,name,price)
val vaccineSchedule = listOf(
    VaccineItem("birth-hepb1",0.0,"出生时","乙肝第1剂",listOf(f("hepb1","乙肝疫苗"))), VaccineItem("birth-bcg",0.0,"出生时","卡介苗",listOf(f("bcg","卡介苗（BCG）"))),
    VaccineItem("m1-hepb2",1.0,"1月龄","乙肝第2剂",listOf(f("hepb2","乙肝疫苗"))), VaccineItem("m1-rota",1.5,"1.5月龄","五价轮状第1剂",listOf(p("rota1","五价轮状病毒疫苗",303))),
    VaccineItem("m1-pcv",1.5,"1.5月龄","13价肺炎第1剂",listOf(p("pcv1a","辉瑞13价肺炎",721),p("pcv1b","沃森13价肺炎",621),p("pcv1c","民海13价肺炎",481))),
    VaccineItem("m2-polio1",2.0,"2月龄","脊灰第1剂",listOf(f("polio1","脊灰灭活疫苗"))), VaccineItem("m2-dtap1",2.0,"2月龄","百白破第1剂",listOf(f("dtap1","百白破疫苗"),p("penta1","进口五联疫苗",661))),
    VaccineItem("m2-hib1",2.0,"2月龄","Hib第1剂",listOf(p("hib1","Hib疫苗",125))), VaccineItem("m2-rota2",2.5,"2.5月龄","五价轮状第2剂",listOf(p("rota2","五价轮状病毒疫苗",303))),
    VaccineItem("m2-pcv2",2.5,"2.5月龄","13价肺炎第2剂",listOf(p("pcv2a","辉瑞13价肺炎",721),p("pcv2b","沃森13价肺炎",621))), VaccineItem("m3-polio2",3.0,"3月龄","脊灰第2剂",listOf(f("polio2","脊灰灭活疫苗"))),
    VaccineItem("m3-dtap2",3.0,"3月龄","百白破第2剂",listOf(f("dtap2","百白破疫苗"),p("penta2","进口五联疫苗",661))), VaccineItem("m3-mencwy1",3.0,"3月龄","ACWY流脑第1剂",listOf(p("mencwy1","ACWY135流脑结合疫苗",443))),
    VaccineItem("m3-rota3",3.5,"3.5月龄","五价轮状第3剂",listOf(p("rota3","五价轮状病毒疫苗",303))), VaccineItem("m3-pcv3",3.5,"3.5月龄","13价肺炎第3剂",listOf(p("pcv3","13价肺炎球菌疫苗",621))),
    VaccineItem("m4-polio3",4.0,"4月龄","脊灰第3剂",listOf(f("polio3","脊灰灭活疫苗"))), VaccineItem("m4-dtap3",4.0,"4月龄","百白破第3剂",listOf(f("dtap3","百白破疫苗"),p("penta3","进口五联疫苗",661))),
    VaccineItem("m4-hib2",4.0,"4月龄","Hib第2剂",listOf(p("hib2","Hib疫苗",125))), VaccineItem("m6-hepb3",6.0,"6月龄","乙肝第3剂",listOf(f("hepb3","乙肝疫苗"))),
    VaccineItem("m6-mena",6.0,"6月龄","A群流脑第1剂",listOf(f("mena1","A群流脑疫苗"),p("mencwyA","ACWY135流脑结合疫苗",443))), VaccineItem("m6-ev71",6.5,"6.5月龄","EV71第1剂",listOf(p("ev711","EV71手足口疫苗",211))),
    VaccineItem("m7-ev71",7.5,"7.5月龄","EV71第2剂",listOf(p("ev712","EV71手足口疫苗",211))), VaccineItem("m8-mmr",8.0,"8月龄","麻腮风第1剂",listOf(f("mmr1","麻腮风疫苗"))),
    VaccineItem("m8-je",8.0,"8月龄","乙脑第1剂",listOf(f("je1","乙脑减毒活疫苗"))), VaccineItem("m9-mena",9.0,"9月龄","A群流脑第2剂",listOf(f("mena2","A群流脑疫苗"))),
    VaccineItem("m12-pcv",12.0,"12-15月龄","13价肺炎加强剂",listOf(p("pcv4","13价肺炎球菌疫苗",621))), VaccineItem("m15-var",15.0,"15月龄","水痘第1剂",listOf(p("var1","水痘疫苗",159))),
    VaccineItem("m18-mmr",18.0,"18-24月龄","麻腮风第2剂",listOf(f("mmr2","麻腮风疫苗"))), VaccineItem("m18-hepa",18.0,"18-24月龄","甲肝第1剂",listOf(f("hepa1","甲肝灭活疫苗"))),
    VaccineItem("m18-dtap",18.0,"18-24月龄","百白破第4剂",listOf(f("dtap4","百白破疫苗"),p("penta4","进口五联疫苗",661))), VaccineItem("m24-hepa",24.0,"2周岁","甲肝第2剂",listOf(f("hepa2","甲肝灭活疫苗"))),
    VaccineItem("m24-je",24.0,"2周岁","乙脑第2剂",listOf(f("je2","乙脑减毒活疫苗"))), VaccineItem("m24-pcv23",24.0,"2周岁","23价肺炎",listOf(p("pcv23","23价肺炎疫苗",271))),
    VaccineItem("m36-menc",36.0,"3周岁","流脑A+C第1剂",listOf(f("menac1","流脑A+C疫苗"),p("acwy1","流脑ACWY135多糖疫苗",159))), VaccineItem("m36-var",36.0,"3周岁","水痘第2剂",listOf(p("var2","水痘疫苗",159))),
    VaccineItem("m72-menc",72.0,"6周岁","流脑A+C第2剂",listOf(f("menac2","流脑A+C疫苗"))), VaccineItem("m72-dtap",72.0,"6周岁","百白破加强剂",listOf(f("dtap5","百白破疫苗"))),
    VaccineItem("m156-hpv",156.0,"13周岁及以上","HPV疫苗",listOf(f("hpv2","2价HPV疫苗"),p("hpv9","9价HPV疫苗",1321)))
)
