const pad=n=>String(n).padStart(2,'0');
const key=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const date=s=>new Date(`${s}T00:00:00`);
const short=s=>`${Number(s.slice(5,7))}/${Number(s.slice(8,10))}`;
const rounded=n=>Math.round(n*10)/10;
function build(logs,range=7) {
  const today=new Date();today.setHours(0,0,0,0);
  const start=range===365?new Date(today.getFullYear(),today.getMonth()-11,1):new Date(today.getFullYear(),today.getMonth(),today.getDate()-range+1);
  const days=[];
  for(let d=new Date(start);d<=today;d.setDate(d.getDate()+1))days.push(key(d));
  const intervals={};let previous=null;
  logs.filter(l=>l.logType==='feeding').sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.id.localeCompare(b.id)).forEach(l=>{
    const current=new Date(l.timestamp).getTime();if(!Number.isFinite(current))return;
    if(previous!==null){const minutes=Math.round((current-previous)/60000);if(minutes>30&&minutes<=1440)(intervals[l.timestamp.slice(0,10)]||=([])).push(minutes/60);if(minutes>30)previous=current;}
    else previous=current;
  });
  const dayStats=days.map(day=>{
    const items=logs.filter(l=>l.timestamp.slice(0,10)===day),weights=items.filter(l=>l.logType==='growth'&&Number(l.metadata?.weightKg)>0).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
    const milk=items.filter(l=>l.logType==='feeding'&&l.metadata?.feedingType==='bottle').reduce((sum,l)=>sum+(Number(l.metadata.bottle?.volumeMl)||0),0);
    const sleep=items.filter(l=>l.logType==='sleep').reduce((sum,l)=>sum+(Number(l.metadata?.durationMinutes)||0),0)/60;
    const gap=intervals[day]||[];
    return {day,milk,sleep,interval:gap.length?gap.reduce((a,b)=>a+b,0)/gap.length:0,pee:items.filter(l=>l.logType==='diaper'&&l.metadata?.pee).length,poop:items.filter(l=>l.logType==='diaper'&&l.metadata?.poop).length,weight:weights.length?Number(weights[weights.length-1].metadata.weightKg):0};
  });
  const summary=dayStats[dayStats.length-1]||{milk:0,sleep:0,pee:0,poop:0};
  const groups=[];
  if(range===7)dayStats.forEach(item=>groups.push({label:short(item.day),items:[item]}));
  else if(range===30){for(let i=0;i<dayStats.length;i+=7){const items=dayStats.slice(i,i+7);groups.push({label:`${short(items[0].day)}-${short(items[items.length-1].day)}`,items});}}
  else for(let i=0;i<12;i++){const d=new Date(start.getFullYear(),start.getMonth()+i,1),month=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;groups.push({label:`${d.getMonth()+1}月`,items:dayStats.filter(x=>x.day.startsWith(month))});}
  const avg=(items,field)=>{const values=items.map(x=>x[field]).filter(x=>x>0);return values.length?rounded(values.reduce((a,b)=>a+b,0)/values.length):0;};
  const config=[['weight','体重增长','kg','暂无体重数据，可以在记录大盘中补一条体重。'],['milk','瓶喂奶量','ml','当前范围暂无瓶喂数据'],['sleep','睡眠时长','小时','当前范围暂无睡眠数据'],['interval','喂养间隔','小时','当前范围暂无连续喂养间隔数据'],['elimination','排泄统计','次','当前范围暂无排泄数据']];
  const charts=config.map(([field,title,unit,empty])=>{
    const points=groups.map(group=>{
      const lastWeight=group.items.filter(x=>x.weight>0).slice(-1)[0];
      const value=field==='weight'?(lastWeight?.weight||0):field==='elimination'?avg(group.items,'pee')+avg(group.items,'poop'):avg(group.items,field);
      return {label:group.label,value:rounded(value),valueLabel:value>0?`${rounded(value)}`:'',pee:avg(group.items,'pee'),poop:avg(group.items,'poop')};
    });
    const max=Math.max(1,...points.map(p=>p.value));
    return {field,title,unit,empty,hasData:points.some(p=>p.value>0),points:points.map(p=>({...p,height:Math.max(2,Math.round(p.value/max*100)),peeHeight:p.value?Math.round(p.pee/max*100):0,poopHeight:p.value?Math.round(p.poop/max*100):0}))};
  });
  return {summary:[{label:'今日瓶喂',value:summary.milk,unit:'ml'},{label:'今日睡眠',value:rounded(summary.sleep),unit:'小时'},{label:'今日嘘嘘',value:summary.pee,unit:'次'},{label:'今日便便',value:summary.poop,unit:'次'}],charts,rangeNote:`${short(days[0])} - ${short(days[days.length-1])} · 自动${range===7?'每日':range===30?'按周日均':'按月日均'}汇总`};
}
module.exports={build};
