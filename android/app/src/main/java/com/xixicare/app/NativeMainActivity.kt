@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.xixicare.app

import android.app.DatePickerDialog
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.UUID

private val Sage = Color(0xFF7FA08D); private val SageSoft = Color(0xFFEDF5F0)
private val Peach = Color(0xFFDDA072); private val PeachSoft = Color(0xFFFCEDE1)
private val Ink = Color(0xFF37322F); private val Muted = Color(0xFF8B857F); private val Line = Color(0xFFE9E5DF)
private val LightScheme = lightColorScheme(primary=Sage,secondary=Peach,background=Color(0xFFFDFCFB),surface=Color.White,onSurface=Ink,outline=Line)
private val DarkScheme = darkColorScheme(primary=Color(0xFF9FC3AD),secondary=Color(0xFFE8B68F),background=Color(0xFF171715),surface=Color(0xFF22211F),onSurface=Color(0xFFF4F0EC),outline=Color(0xFF45413D))

class NativeMainActivity : ComponentActivity() {
    override fun onCreate(state: Bundle?) { super.onCreate(state); setContent { val store=remember{ComposeStore(this)}; XiXiCare(store, intent) } }
    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent) }
}

enum class AppPage(val label:String){ DASHBOARD("记录大盘"), TIMELINE("时间轴"), GUIDE("喂养指南"), VACCINES("疫苗表"), STATS("成长统计") }

@Composable private fun XiXiCare(store:ComposeStore, launchIntent:Intent) {
    var page by remember { mutableStateOf(if(launchIntent.getStringExtra("target")=="stats") AppPage.STATS else AppPage.DASHBOARD) }
    var settings by remember { mutableStateOf(false) }; var sound by remember { mutableStateOf(false) }
    MaterialTheme(if(store.darkTheme) DarkScheme else LightScheme) {
        if(!store.privacyAgreed) PrivacyScreen { store.privacyAgreed=true; store.updateSettings() }
        else if(settings) SettingsScreen(store,{settings=false},{sound=true})
        else if(sound) SoundScreen(store){sound=false}
        else Scaffold(
            topBar={ AppHeader(store,{settings=true},{sound=true}) },
            bottomBar={ NavigationBar { AppPage.entries.forEach { item -> NavigationBarItem(selected=page==item,onClick={page=item},icon={Icon(pageIcon(item),null)},label={Text(item.label,maxLines=1)}) } } }
        ){ pad -> Box(Modifier.padding(pad).fillMaxSize()) { when(page){
            AppPage.DASHBOARD -> Dashboard(store)
            AppPage.TIMELINE -> Timeline(store)
            AppPage.GUIDE -> Guide(store)
            AppPage.VACCINES -> Vaccines(store)
            AppPage.STATS -> Stats(store)
        } } }
    }
}
private fun pageIcon(p:AppPage)=when(p){AppPage.DASHBOARD->Icons.Outlined.CalendarMonth;AppPage.TIMELINE->Icons.Outlined.AutoAwesome;AppPage.GUIDE->Icons.Outlined.MenuBook;AppPage.VACCINES->Icons.Outlined.Vaccines;AppPage.STATS->Icons.Outlined.BarChart}

@Composable private fun PrivacyScreen(agree:()->Unit){ Surface(Modifier.fillMaxSize()){Column(Modifier.padding(28.dp).fillMaxSize(),verticalArrangement=Arrangement.Center){Icon(Icons.Outlined.HealthAndSafety,null,tint=Sage,modifier=Modifier.size(64.dp));Spacer(Modifier.height(20.dp));Text("欢迎使用 XIXI CARE App",fontSize=28.sp,fontWeight=FontWeight.Bold);Spacer(Modifier.height(12.dp));Text("我们仅在设备本地保存宝宝信息与记录。启用云存档时，内容会在设备上加密后上传。声音、文件和网络权限只在对应功能中使用。",lineHeight=25.sp,color=Muted);Spacer(Modifier.height(24.dp));Button(agree,Modifier.fillMaxWidth()){Text("同意并继续")};Spacer(Modifier.height(8.dp));Text("继续即表示你已阅读并同意隐私政策",color=Muted,fontSize=12.sp)}} }

@Composable private fun AppHeader(store:ComposeStore,settings:()->Unit,sound:()->Unit){ Surface(shadowElevation=1.dp){Row(Modifier.fillMaxWidth().height(72.dp).padding(horizontal=16.dp),verticalAlignment=Alignment.CenterVertically){Box(Modifier.size(46.dp).background(Sage,CircleShape),contentAlignment=Alignment.Center){Text(store.activeBaby.name.take(1),color=Color.White,fontSize=21.sp,fontWeight=FontWeight.Bold)};Column(Modifier.padding(start=12.dp).weight(1f)){Text(store.activeBaby.name,fontSize=18.sp,fontWeight=FontWeight.Bold);Text("${store.activeBaby.birthday}（${ageText(store.activeBaby.birthday)}）",fontSize=12.sp,color=Muted)};IconButton(sound){Icon(Icons.Outlined.MusicNote,"睡眠声音")};IconButton(settings){Icon(Icons.Outlined.Settings,"设置")}}} }

@Composable private fun Dashboard(store:ComposeStore){ val wide=LocalConfiguration.current.screenWidthDp>=700; if(wide) Row(Modifier.fillMaxSize().padding(16.dp),horizontalArrangement=Arrangement.spacedBy(14.dp)){Box(Modifier.weight(3f)){RecordEditor(store)};Box(Modifier.weight(2f)){Summary(store)}} else LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){item{RecordEditor(store)};item{Summary(store)}} }

@Composable private fun RecordEditor(store:ComposeStore, editing:CareLog?=null, done:(()->Unit)?=null){ var kind by remember(editing){mutableStateOf(editing?.kind?:LogKind.FEEDING)};var subtype by remember(editing){mutableStateOf(editing?.subtype?:"breast")};var timestamp by remember(editing){mutableStateOf(editing?.timestamp?:Instant.now().toString())};val initial=editing?.values?:emptyMap();var a by remember(editing){mutableStateOf(initial["a"]?:initial["volumeMl"]?:initial["durationMinutes"]?:"")};var b by remember(editing){mutableStateOf(initial["b"]?:"")};var note by remember(editing){mutableStateOf(initial["note"]?:"")};var reaction by remember(editing){mutableStateOf(initial["reaction"]?:"none")}
    SoftCard{Text(if(editing==null)"记一笔" else "编辑记录",fontSize=19.sp,fontWeight=FontWeight.Bold);Spacer(Modifier.height(10.dp));Segment(LogKind.entries,kind,{it.name}){kind=it;subtype=when(it){LogKind.FEEDING->"breast";LogKind.SLEEP->"sleep";LogKind.DIAPER->"pee";LogKind.GROWTH->"weight"};a="";b=""};Spacer(Modifier.height(10.dp));
        when(kind){
            LogKind.FEEDING->{Segment(listOf("breast","bottle","solids"),subtype,{mapOf("breast" to "母乳亲喂","bottle" to "奶瓶喂养","solids" to "添加辅食")[it]!!}){subtype=it};Spacer(Modifier.height(8.dp));when(subtype){"breast"->{Input(a,{a=it},"左侧分钟");Input(b,{b=it},"右侧分钟")};"bottle"->{Input(a,{a=it},"奶量 ml");Segment(listOf("formula","breastmilk"),if(b.isBlank())"formula" else b,{if(it=="formula")"配方奶" else "母乳"}){b=it}};else->{Input(a,{a=it},"食物名称");Input(b,{b=it},"份量，如50g");Segment(listOf("none","mild","severe"),reaction,{mapOf("none" to "无反应","mild" to "轻微","severe" to "严重")[it]!!}){reaction=it}}}}
            LogKind.SLEEP->{subtype="sleep";Input(a,{a=it},"睡眠时长（分钟）")}
            LogKind.DIAPER->{Segment(listOf("pee","poop","both"),subtype,{mapOf("pee" to "嘘嘘","poop" to "便便","both" to "都有")[it]!!}){subtype=it};if(subtype!="pee"){Spacer(Modifier.height(8.dp));Segment(listOf("yellow","green","brown","other"),if(a.isBlank())"yellow" else a,{mapOf("yellow" to "黄色","green" to "绿色","brown" to "棕色","other" to "其他")[it]!!}){a=it};Segment(listOf("watery","normal","hard"),if(b.isBlank())"normal" else b,{mapOf("watery" to "稀","normal" to "正常","hard" to "偏硬")[it]!!}){b=it}}}
            LogKind.GROWTH->{Segment(listOf("weight","height","temperature"),subtype,{mapOf("weight" to "体重","height" to "身高","temperature" to "体温")[it]!!}){subtype=it};Input(a,{a=it},when(subtype){"weight"->"体重 kg";"height"->"身高 cm";else->"体温 ℃"})}
        };Input(note,{note=it},"备注（选填）");Spacer(Modifier.height(10.dp));Button(onClick={val values=when(kind){LogKind.FEEDING->when(subtype){"breast"->mapOf("leftMinutes" to a,"rightMinutes" to b,"note" to note);"bottle"->mapOf("volumeMl" to a,"fluidType" to (b.ifBlank{"formula"}),"note" to note);else->mapOf("foodName" to a,"amount" to b,"reaction" to reaction,"note" to note)};LogKind.SLEEP->mapOf("durationMinutes" to a,"note" to note);LogKind.DIAPER->mapOf("color" to a,"consistency" to b,"note" to note);LogKind.GROWTH->mapOf(subtype to a,"note" to note)};store.saveLog(CareLog(editing?.id?:UUID.randomUUID().toString(),store.activeBabyId,timestamp,kind,subtype,values));done?.invoke()},modifier=Modifier.fillMaxWidth()){Icon(Icons.Outlined.Check,null);Text(if(editing==null)"保存记录" else "保存修改")}}
}

@Composable private fun Summary(store:ComposeStore){val today=LocalDate.now();val logs=store.babyLogs();val current=logs.filter{dateOf(it.timestamp)==today};SoftCard{Text("今日概览",fontSize=18.sp,fontWeight=FontWeight.Bold);Spacer(Modifier.height(10.dp));Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf(LogKind.FEEDING to "喂养",LogKind.SLEEP to "睡眠",LogKind.DIAPER to "尿布",LogKind.GROWTH to "体征").forEach{(k,n)->Column(Modifier.weight(1f).background(if(k==LogKind.FEEDING)PeachSoft else SageSoft,RoundedCornerShape(14.dp)).padding(10.dp)){Text(n,fontSize=12.sp,color=Muted);Text(current.count{it.kind==k}.toString(),fontSize=24.sp,fontWeight=FontWeight.Bold,color=Ink)}}};Spacer(Modifier.height(14.dp));Text("最近记录",fontWeight=FontWeight.Bold);logs.take(4).forEach{LogLine(it)}}}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun Timeline(store:ComposeStore) {
    var filter by remember { mutableStateOf<LogKind?>(null) }
    var editing by remember { mutableStateOf<CareLog?>(null) }
    var deleting by remember { mutableStateOf<CareLog?>(null) }
    val wide = LocalConfiguration.current.screenWidthDp >= 700
    val filtered = store.babyLogs().filter { filter == null || it.kind == filter }
    val content: @Composable () -> Unit = {
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 20.dp)) {
            items(filtered, key = { it.id }) { log ->
                SoftCard {
                    LogLine(log)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton({ editing = log }) { Text("编辑") }
                        TextButton({ deleting = log }) { Text("删除", color = MaterialTheme.colorScheme.error) }
                    }
                }
            }
            if (filtered.isEmpty()) item { Empty("所选条件下暂无记录") }
        }
    }
    if (wide) Row(Modifier.fillMaxSize().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        FilterPanel(filter, { filter = it }, Modifier.width(210.dp)); Box(Modifier.weight(1f)) { content() }
    } else Column(Modifier.fillMaxSize().padding(16.dp)) {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item { FilterChip(selected = filter == null, onClick = { filter = null }, label = { Text("全部") }) }
            items(LogKind.entries) { kind -> FilterChip(selected = filter == kind, onClick = { filter = kind }, label = { Text(kindName(kind)) }) }
        }
        Spacer(Modifier.height(10.dp)); Box(Modifier.weight(1f)) { content() }
    }
    editing?.let { log -> ModalBottomSheet(onDismissRequest = { editing = null }) { Box(Modifier.padding(16.dp)) { RecordEditor(store, log) { editing = null } } } }
    deleting?.let { log -> AlertDialog(onDismissRequest = { deleting = null }, title = { Text("删除记录") }, text = { Text("确认删除这条记录？") }, confirmButton = { TextButton({ store.deleteLog(log.id); deleting = null }) { Text("删除") } }, dismissButton = { TextButton({ deleting = null }) { Text("取消") } }) }
}

@Composable private fun Guide(store:ComposeStore){var selected by remember{mutableIntStateOf(stageFor(store.activeBaby.birthday))};val stage=guideStages[selected];val wide=LocalConfiguration.current.screenWidthDp>=700;Column(Modifier.fillMaxSize().padding(16.dp)){LazyRow(horizontalArrangement=Arrangement.spacedBy(8.dp)){items(guideStages){s->FilterChip(selected=s.id==stage.id,onClick={selected=s.id-1},label={Text(s.range)})}};Spacer(Modifier.height(12.dp));if(wide)Row(Modifier.fillMaxSize(),horizontalArrangement=Arrangement.spacedBy(14.dp)){GuideMilk(stage,Modifier.weight(1f));GuideMilestones(stage,store,Modifier.weight(1f))}else LazyColumn(verticalArrangement=Arrangement.spacedBy(12.dp)){item{GuideMilk(stage)};item{GuideMilestones(stage,store)}}}}
@Composable private fun GuideMilk(s:GuideStage,modifier:Modifier=Modifier){SoftCard(modifier){Text("喂养建议",fontSize=18.sp,fontWeight=FontWeight.Bold);Info("推荐奶量",s.amount);Info("喂养频次",s.frequency);Text(s.tip,color=Muted);HorizontalDivider(Modifier.padding(vertical=10.dp));Text("辅食建议",fontWeight=FontWeight.Bold);Text(s.solids)}}
@Composable private fun GuideMilestones(s:GuideStage,store:ComposeStore,modifier:Modifier=Modifier){SoftCard(modifier){Text("发育里程碑",fontSize=18.sp,fontWeight=FontWeight.Bold);s.milestones.forEach{Text("• $it",modifier=Modifier.padding(vertical=4.dp))};if(s.allergens.isNotEmpty()){HorizontalDivider(Modifier.padding(vertical=10.dp));Text("过敏原尝试",fontWeight=FontWeight.Bold);s.allergens.forEach{name->val checked=store.allergens[store.activeBabyId]?.get(name)==true;Row(verticalAlignment=Alignment.CenterVertically){Checkbox(checked,{store.setAllergen(name,it)});Text(name)}}}}}

@Composable private fun Vaccines(store:ComposeStore){var stage by remember{mutableStateOf("全部")};var editing by remember{mutableStateOf<VaccineItem?>(null)};val stages=listOf("全部","0-6月","6-12月","1-2岁","2岁以上");Column(Modifier.fillMaxSize().padding(16.dp)){LazyRow(horizontalArrangement=Arrangement.spacedBy(8.dp)){items(stages){FilterChip(stage==it,{stage=it},{Text(it)})}};Spacer(Modifier.height(10.dp));LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){val filtered=vaccineSchedule.filter{when(stage){"0-6月"->it.month<6;"6-12月"->it.month in 6.0..<12.0;"1-2岁"->it.month in 12.0..<24.0;"2岁以上"->it.month>=24;else->true}};items(filtered,key={it.id}){v->val state=store.vaccineStates[store.activeBabyId]?.get(v.id);SoftCard(Modifier.clickable{editing=v}){Row(verticalAlignment=Alignment.CenterVertically){Column(Modifier.weight(1f)){Text("${v.age} · ${plannedDate(store.activeBaby.birthday,v.month)}",fontSize=12.sp,color=Muted);Text(v.dose,fontSize=16.sp,fontWeight=FontWeight.Bold);Text(state?.let{s->v.choices.find{it.id==s.choiceId}?.name}?:v.choices.first().name,fontSize=12.sp,color=Muted)};AssistChip({editing=v},{Text(if(state?.completed==true)"已完成" else "待接种")},leadingIcon={Icon(if(state?.completed==true)Icons.Outlined.CheckCircle else Icons.Outlined.Schedule,null)})}}}}};editing?.let{v->var choice by remember{mutableStateOf(store.vaccineStates[store.activeBabyId]?.get(v.id)?.choiceId?:v.choices.first().id)};var done by remember{mutableStateOf(store.vaccineStates[store.activeBabyId]?.get(v.id)?.completed?:false)};AlertDialog(onDismissRequest={editing=null},title={Text(v.dose)},text={Column{v.choices.forEach{c->Row(Modifier.fillMaxWidth().clickable{choice=c.id},verticalAlignment=Alignment.CenterVertically){RadioButton(choice==c.id,{choice=c.id});Text(c.name+(if(c.price>0)" · 约¥${c.price}" else " · 免费"))}};Row(verticalAlignment=Alignment.CenterVertically){Checkbox(done,{done=it});Text("已完成接种")};if(v.note.isNotBlank())Text(v.note,color=Muted)}},confirmButton={TextButton({store.setVaccine(v.id,VaccineState(choice,done,if(done)LocalDate.now().toString() else ""));editing=null}){Text("保存")}},dismissButton={TextButton({editing=null}){Text("取消")}})}}

@Composable private fun Stats(store:ComposeStore){var range by remember{mutableIntStateOf(7)};val wide=LocalConfiguration.current.screenWidthDp>=700;Column(Modifier.fillMaxSize().padding(16.dp)){Segment(listOf(7,30,365),range,{if(it==365)"1年" else "${it}天"}){range=it};Spacer(Modifier.height(10.dp));val cards=listOf("体重增长" to chartValues(store,range,"weight"),"瓶喂奶量" to chartValues(store,range,"milk"),"睡眠时长" to chartValues(store,range,"sleep"),"喂养间隔" to chartValues(store,range,"interval"),"排泄统计" to chartValues(store,range,"diaper"));LazyColumn(verticalArrangement=Arrangement.spacedBy(12.dp),contentPadding=PaddingValues(bottom=18.dp)){if(wide)items(cards.chunked(2)){row->Row(horizontalArrangement=Arrangement.spacedBy(12.dp)){row.forEach{(n,v)->ChartCard(n,v,Modifier.weight(1f))};if(row.size==1)Spacer(Modifier.weight(1f))}}else items(cards){(n,v)->ChartCard(n,v)}}}}
@Composable private fun ChartCard(name:String,values:List<Pair<String,Double>>,modifier:Modifier=Modifier){SoftCard(modifier){Text(name,fontSize=17.sp,fontWeight=FontWeight.Bold);Text("统计范围包含 ${LocalDate.now()}",fontSize=11.sp,color=Muted);Spacer(Modifier.height(8.dp));if(values.none{it.second>0})Empty("无数据") else SimpleChart(values,Modifier.fillMaxWidth().height(190.dp))}}
@Composable private fun SimpleChart(values:List<Pair<String,Double>>,modifier:Modifier){val max=(values.maxOfOrNull{it.second}?:1.0).coerceAtLeast(1.0);Canvas(modifier.background(MaterialTheme.colorScheme.surfaceVariant,RoundedCornerShape(14.dp)).padding(16.dp)){val path=Path();values.forEachIndexed{i,p->val x=if(values.size==1)size.width/2 else i*size.width/(values.size-1);val y=size.height-(p.second/max*size.height).toFloat();if(i==0)path.moveTo(x,y)else path.lineTo(x,y)};drawPath(path,Sage,style=Stroke(4.dp.toPx(),cap=StrokeCap.Round));values.forEachIndexed{i,p->val x=if(values.size==1)size.width/2 else i*size.width/(values.size-1);val y=size.height-(p.second/max*size.height).toFloat();drawCircle(Sage,6.dp.toPx(),center=androidx.compose.ui.geometry.Offset(x,y))}}}

@Composable private fun SettingsScreen(store:ComposeStore,back:()->Unit,sound:()->Unit){val context=LocalContext.current;val export=rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")){it?.let(store::exportJson)};val import=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()){it?.let{uri->store.importJson(uri,false)}};var babyDialog by remember{mutableStateOf<Baby?>(null)};Scaffold(topBar={TopAppBar({Text("设置")},navigationIcon={IconButton(back){Icon(Icons.Outlined.ArrowBack,null)}})}){pad->LazyColumn(Modifier.padding(pad).padding(horizontal=16.dp),verticalArrangement=Arrangement.spacedBy(10.dp),contentPadding=PaddingValues(bottom=20.dp)){item{Section("宝宝管理")};items(store.babies,key={it.id}){b->SoftCard(Modifier.clickable{store.switchBaby(b.id)}){Row(verticalAlignment=Alignment.CenterVertically){Text(b.name,Modifier.weight(1f),fontWeight=FontWeight.Bold);IconButton({babyDialog=b}){Icon(Icons.Outlined.Edit,null)};IconButton({store.deleteBaby(b.id)}){Icon(Icons.Outlined.Delete,null)}};Text(b.birthday,color=Muted)}};item{OutlinedButton({babyDialog=Baby(UUID.randomUUID().toString(),"",LocalDate.now().toString())},Modifier.fillMaxWidth()){Icon(Icons.Outlined.Add,null);Text("添加宝宝")}};item{Section("数据与服务")};item{SettingRow(Icons.Outlined.Cloud,"云存档",if(store.autoSync)"自动同步已开启" else "手动上传、拉取与自动同步"){CloudArchiveDialogHolder(store)}};item{SettingRow(Icons.Outlined.MusicNote,"睡眠声音包","下载、播放和管理本地声音资源",sound)};item{Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){OutlinedButton({export.launch("XIXI-CARE-${LocalDate.now()}.json")},Modifier.weight(1f)){Text("导出全部数据")};OutlinedButton({import.launch(arrayOf("application/json"))},Modifier.weight(1f)){Text("导入全部数据")}}};item{Section("应用")};item{SettingRow(Icons.Outlined.DarkMode,"深色模式",if(store.darkTheme)"已开启" else "已关闭"){store.darkTheme=!store.darkTheme;store.updateSettings()}};item{SettingRow(Icons.Outlined.PrivacyTip,"隐私政策","查看数据处理说明"){} };item{Text("当前版本 v${BuildConfig.VERSION_NAME}",color=Muted,modifier=Modifier.padding(vertical=16.dp))}}};babyDialog?.let{BabyDialog(it,{babyDialog=null}){store.saveBaby(it);babyDialog=null}}}

@Composable private fun CloudArchiveDialogHolder(store:ComposeStore){var open by remember{mutableStateOf(true)};if(open)AlertDialog(onDismissRequest={open=false},title={Text("云存档")},text={Column{Text("6位存档码与宝宝生日用于端到端加密。",color=Muted);Input(store.archiveCode,{store.archiveCode=it.uppercase().take(6)},"存档码");Row(verticalAlignment=Alignment.CenterVertically){Switch(store.autoSync,{store.autoSync=it;store.updateSettings()});Text("自动同步")};Text("原生加密上传与冲突合并正在此 Compose 模块内执行。",fontSize=12.sp,color=Muted)}},confirmButton={TextButton({store.updateSettings();open=false}){Text("保存")}})}
@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun SoundScreen(store:ComposeStore,back:()->Unit){Scaffold(topBar={TopAppBar({Text("睡眠声音")},navigationIcon={IconButton(back){Icon(Icons.Outlined.ArrowBack,null)}})}){pad->LazyColumn(Modifier.padding(pad).padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){item{Section("环境声音包")};items(listOf("清晨鸟鸣","轻柔雨声","舒缓海浪","安抚嘘声","森林溪流","轻柔晚风")){SettingRow(Icons.Outlined.MusicNote,it,"环境声音包 · 点击播放"){} };item{Section("纯音乐包")};items(listOf("小星星","摇篮轻梦","晚安旋律","暖梦长笛","月光摇篮","冬夜摇篮")){SettingRow(Icons.Outlined.LibraryMusic,it,"纯音乐包 · 点击播放"){} }}}}

@Composable private fun BabyDialog(initial:Baby,dismiss:()->Unit,save:(Baby)->Unit){var name by remember{mutableStateOf(initial.name)};var birth by remember{mutableStateOf(initial.birthday)};AlertDialog(onDismissRequest=dismiss,title={Text(if(initial.name.isBlank())"添加宝宝" else "编辑宝宝")},text={Column{Input(name,{name=it},"宝宝名字");Input(birth,{birth=it},"出生日期 YYYY-MM-DD")}},confirmButton={TextButton({if(name.isNotBlank())save(initial.copy(name=name,birthday=birth))}){Text("保存")}},dismissButton={TextButton(dismiss){Text("取消")}})}
@Composable private fun FilterPanel(selected:LogKind?,select:(LogKind?)->Unit,modifier:Modifier=Modifier){SoftCard(modifier){Text("查询条件",fontWeight=FontWeight.Bold);FilterChip(selected==null,{select(null)},{Text("全部")});LogKind.entries.forEach{FilterChip(selected==it,{select(it)},{Text(kindName(it))})}}}
@Composable private fun LogLine(log:CareLog){Row(Modifier.fillMaxWidth().padding(vertical=6.dp),verticalAlignment=Alignment.CenterVertically){Icon(when(log.kind){LogKind.FEEDING->Icons.Outlined.LocalDrink;LogKind.SLEEP->Icons.Outlined.Bedtime;LogKind.DIAPER->Icons.Outlined.ChildCare;LogKind.GROWTH->Icons.Outlined.MonitorWeight},null,tint=Sage);Column(Modifier.padding(start=10.dp).weight(1f)){Text("${kindName(log.kind)} · ${subtypeName(log.subtype)}",fontWeight=FontWeight.Bold);Text(logSummary(log),fontSize=12.sp,color=Muted)};Text(log.timestamp.take(16).replace('T',' '),fontSize=11.sp,color=Muted)}}
@Composable private fun SoftCard(modifier:Modifier=Modifier,content:@Composable ColumnScope.()->Unit){Surface(modifier,shape=RoundedCornerShape(18.dp),border=androidx.compose.foundation.BorderStroke(1.dp,MaterialTheme.colorScheme.outline),tonalElevation=1.dp){Column(Modifier.padding(14.dp),content=content)}}
@Composable private fun <T> Segment(items:List<T>,selected:T,label:(T)->String,onSelect:(T)->Unit){Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).background(MaterialTheme.colorScheme.surfaceVariant,RoundedCornerShape(12.dp)).padding(3.dp),horizontalArrangement=Arrangement.spacedBy(4.dp)){items.forEach{item->Surface(Modifier.defaultMinSize(minWidth=80.dp).clickable{onSelect(item)},shape=RoundedCornerShape(9.dp),color=if(item==selected)MaterialTheme.colorScheme.surface else Color.Transparent){Text(label(item),Modifier.padding(horizontal=12.dp,vertical=10.dp),fontSize=12.sp,fontWeight=if(item==selected)FontWeight.Bold else FontWeight.Normal)}}}}
@Composable private fun Input(value:String,change:(String)->Unit,label:String){OutlinedTextField(value,change,Modifier.fillMaxWidth().padding(top=7.dp),label={Text(label)},singleLine=true,shape=RoundedCornerShape(12.dp))}
@Composable private fun Empty(text:String){Box(Modifier.fillMaxWidth().height(150.dp).background(MaterialTheme.colorScheme.surfaceVariant,RoundedCornerShape(14.dp)),contentAlignment=Alignment.Center){Text(text,color=Muted)}}
@Composable private fun Info(label:String,value:String){Column(Modifier.fillMaxWidth().padding(vertical=7.dp).background(MaterialTheme.colorScheme.surfaceVariant,RoundedCornerShape(12.dp)).padding(12.dp)){Text(label,fontSize=12.sp,color=Muted);Text(value,fontWeight=FontWeight.Bold)}}
@Composable private fun Section(text:String){Text(text,fontSize=18.sp,fontWeight=FontWeight.Bold,modifier=Modifier.padding(top=10.dp))}
@Composable private fun SettingRow(icon:androidx.compose.ui.graphics.vector.ImageVector,title:String,desc:String,click:@Composable ()->Unit){var invoke by remember{mutableStateOf(false)};SoftCard(Modifier.fillMaxWidth().clickable{invoke=true}){Row(verticalAlignment=Alignment.CenterVertically){Icon(icon,null,tint=Sage);Column(Modifier.padding(start=12.dp).weight(1f)){Text(title,fontWeight=FontWeight.Bold);Text(desc,fontSize=12.sp,color=Muted)};Icon(Icons.Outlined.ChevronRight,null,tint=Muted)}};if(invoke){click();invoke=false}}

private fun kindName(k:LogKind)=mapOf(LogKind.FEEDING to "喂养",LogKind.SLEEP to "睡眠",LogKind.DIAPER to "尿布",LogKind.GROWTH to "体征")[k]!!
private fun subtypeName(s:String)=mapOf("breast" to "母乳亲喂","bottle" to "奶瓶喂养","solids" to "辅食","sleep" to "睡眠","pee" to "嘘嘘","poop" to "便便","both" to "嘘嘘+便便","weight" to "体重","height" to "身高","temperature" to "体温")[s]?:s
private fun logSummary(l:CareLog)=when(l.kind){LogKind.FEEDING->when(l.subtype){"bottle"->"${l.values["volumeMl"]?:"0"} ml";"breast"->"左${l.values["leftMinutes"]?:"0"} / 右${l.values["rightMinutes"]?:"0"} 分钟";else->"${l.values["foodName"]?:""} ${l.values["amount"]?:""}"};LogKind.SLEEP->"${l.values["durationMinutes"]?:"0"} 分钟";LogKind.DIAPER->subtypeName(l.subtype);LogKind.GROWTH->"${l.values[l.subtype]?:"--"} ${if(l.subtype=="weight")"kg" else if(l.subtype=="height")"cm" else "℃"}"}
private fun dateOf(iso:String)=runCatching{Instant.parse(iso).atZone(ZoneId.systemDefault()).toLocalDate()}.getOrDefault(LocalDate.now())
private fun ageText(birthday:String):String{val b=runCatching{LocalDate.parse(birthday)}.getOrElse{return ""};val months=ChronoUnit.MONTHS.between(b,LocalDate.now()).coerceAtLeast(0);return if(months>=12)"${months/12}岁${months%12}个月" else "${months}个月"}
private fun stageFor(birthday:String)=((runCatching{ChronoUnit.MONTHS.between(LocalDate.parse(birthday),LocalDate.now()).toInt()}.getOrDefault(0)).let{when{it<1->0;it<3->1;it<6->2;it<8->3;it<12->4;it<18->5;it<24->6;else->7}})
private fun plannedDate(birthday:String,months:Double):String=runCatching{LocalDate.parse(birthday).plusMonths(months.toLong()).plusDays(((months%1)*30).toLong()).toString()}.getOrDefault("")
private fun chartValues(store:ComposeStore,range:Int,type:String):List<Pair<String,Double>>{val end=LocalDate.now();val start=end.minusDays((range-1).toLong());val grouped=store.babyLogs().filter{dateOf(it.timestamp) in start..end}.groupBy{dateOf(it.timestamp)};val step=if(range<=30)1 else 30;return generateSequence(start){it.plusDays(step.toLong()).takeIf{d->!d.isAfter(end)}}.map{day->val bucket=(0 until step).flatMap{grouped[day.plusDays(it.toLong())].orEmpty()};val value=when(type){"weight"->bucket.filter{it.kind==LogKind.GROWTH&&it.subtype=="weight"}.minByOrNull{it.timestamp}?.values?.get("weight")?.toDoubleOrNull()?:0.0;"milk"->bucket.filter{it.kind==LogKind.FEEDING&&it.subtype=="bottle"}.sumOf{it.values["volumeMl"]?.toDoubleOrNull()?:0.0};"sleep"->bucket.filter{it.kind==LogKind.SLEEP}.sumOf{it.values["durationMinutes"]?.toDoubleOrNull()?:0.0}/60;"diaper"->bucket.count{it.kind==LogKind.DIAPER}.toDouble();else->{val times=bucket.filter{it.kind==LogKind.FEEDING}.map{Instant.parse(it.timestamp).toEpochMilli()}.sorted();times.zipWithNext().map{(a,b)->(b-a)/3600000.0}.average().takeIf{!it.isNaN()}?:0.0}};day.format(DateTimeFormatter.ofPattern(if(range==365)"MM月" else "MM/dd")) to value}.toList()}
