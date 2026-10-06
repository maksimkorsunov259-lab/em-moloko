import {imapSteps} from './recipes.js';
export const APP='em-moloko',SCHEMA=1,KEY='em-moloko.diary.v1';
export const pieceFractions=[8,7,6,5,4,3,2,1].map(denominator=>({label:denominator===1?'1':`1/${denominator}`,amount:Number((1/denominator).toFixed(6)),approximate:[7,6,3].includes(denominator)}));
export const clone=x=>JSON.parse(JSON.stringify(x));
export const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const emptyDaily=()=>({date:localDate(),well:false,asthma:false,changes:false,prepared:false});
export function initialData(){return {app:APP,schema:SCHEMA,revision:0,updatedAt:new Date().toISOString(),profile:{name:'',dob:''},plan:{revision:1,protocol:'imap',phenotype:'unknown',current:0,observeHours:0,anaphylaxis:false,traces:false,bakedReaction:false,asthma:false,settled:false,contact:'',followup:''},records:[],paused:false,pausedAt:'',daily:emptyDaily(),guideRead:false,question:false};}
export function targets(p){const s=imapSteps[p.current];return {...p,target:s.target,unit:s.unit,recipeKey:s.key};}
export function routeBlock(p){
 if(p.phenotype!=='nonige')return 'При этом диагнозе домашний трекер использовать нельзя: для этих состояний он не валидирован, безопасность и эффективность не установлены. Рекомендована консультация лечащего аллерголога-иммунолога.';
 if(p.anaphylaxis||p.traces||p.bakedReaction||p.asthma)return 'Есть фактор риска: стандартная домашняя лестница недоступна. Обратитесь к аллергологу-иммунологу для индивидуального обследования и решения о контролируемом введении в клинике.';
 if(p.protocol!=='imap')return 'Индивидуальное обследование и ведение в клинике. Домашняя лестница отключена. Условия введения определяет аллерголог-иммунолог.';
 if(!p.settled)return 'Исходные симптомы ещё не купированы. Домашнее введение отложено до оценки лечащего аллерголога-иммунолога.';
 if(!Number.isInteger(p.observeHours)||p.observeHours<1||p.observeHours>168)return 'Укажите длительность наблюдения после приёма, согласованную с врачом.';
 return '';
}
export const hasSymptoms=r=>r.kind==='intake'&&!['none','pending'].includes(r.symptom);
export function evaluateProgress(data,now=Date.now()){
 const p=targets(data.plan),block=routeBlock(p);
 const own=data.records.filter(r=>!r.voided&&r.revision===p.revision&&r.step===p.current&&r.recipe===p.recipeKey&&r.unit===p.unit);
 const complete=r=>Date.parse(r.at)+r.observeHours*3600000<=now;
 const pending=own.some(r=>r.kind==='intake'&&(r.symptom==='pending'||!complete(r)));
 const symptoms=own.some(hasSymptoms);
 const full=own.filter(r=>r.kind==='intake'&&r.phase==='full'&&r.recipeMatch&&r.symptom==='none'&&r.amount>=p.target&&complete(r));
 const count=new Set(full.map(r=>r.date)).size;
 const daily=data.daily.date===localDate(new Date(now))&&['well','asthma','changes','prepared'].every(k=>data.daily[k]);
 const rows=[{ok:!block,text:block||'Выбрана iMAP для лёгкой / среднетяжёлой не-IgE АБКМ.'},{ok:!data.paused,text:data.paused?'Маршрут на паузе. Возобновление согласуйте с врачом.':'Пауза не отмечена.'},{ok:daily,text:daily?'Чек-лист самочувствия сегодня заполнен.':'Заполните сегодняшний чек-лист самочувствия.'},{ok:!symptoms,text:symptoms?'Есть запись о симптомах. Переход заблокирован.':'В текущем периоде симптомы не отмечены.'},{ok:!pending,text:pending?'Есть незавершённое наблюдение. Дополните запись после его окончания.':'Незавершённых наблюдений нет.'},{ok:count>=3,text:`Завершённые приёмы полной порции без реакции: ${count}. Нужно не менее 3; наращивание не учитывается.`}];
 const ready=rows.every(r=>r.ok);
 return {ready,count,pending,rows,title:block||data.paused||symptoms?'Домашний переход недоступен':ready?(p.current===5?'Критерии последней ступени выполнены. Итоговая оценка и дальнейший рацион — с врачом.':'Критерии счётчика выполнены — сверьте дальнейшие действия с планом врача'):'Условия перехода пока не выполнены'};
}
const fail=m=>{throw new Error(m);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=(x,n)=>typeof x==='string'&&x.length<=n;
export function validDate(x){if(!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;const d=new Date(x+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===x;}
const iso=x=>typeof x==='string'&&x.length<=40&&/^\d{4}-\d{2}-\d{2}T/.test(x)&&Number.isFinite(Date.parse(x));
const bool=x=>typeof x==='boolean';
const int=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
export function validateData(d){
 if(!object(d)||d.app!==APP||d.schema!==SCHEMA)fail('Это не резервная копия ЕмМолоко поддерживаемой версии.');
 if(!int(d.revision,0,Number.MAX_SAFE_INTEGER)||!iso(d.updatedAt))fail('Повреждена версия данных.');
 if(!object(d.profile)||!text(d.profile.name,80)||!text(d.profile.dob,10)||(d.profile.dob&&!validDate(d.profile.dob)))fail('Проверьте профиль ребёнка.');
 const p=d.plan;
 if(!object(p)||!int(p.revision,1,Number.MAX_SAFE_INTEGER)||!['imap','individual'].includes(p.protocol)||!['nonige','ige','fpies','severe','unknown'].includes(p.phenotype)||!int(p.current,0,5)||!int(p.observeHours,0,168))fail('Повреждены параметры плана.');
 for(const k of ['anaphylaxis','traces','bakedReaction','asthma','settled'])if(!bool(p[k]))fail('Повреждены условия допуска.');
 if(!text(p.contact,180)||!text(p.followup,10)||(p.followup&&!validDate(p.followup)))fail('Проверьте связь и контрольный приём.');
 if(!bool(d.paused)||!text(d.pausedAt,40)||(d.pausedAt&&!iso(d.pausedAt))||!bool(d.guideRead)||!bool(d.question)||!object(d.daily)||!validDate(d.daily.date))fail('Повреждены настройки дневника.');
 for(const k of ['well','asthma','changes','prepared'])if(!bool(d.daily[k]))fail('Повреждён чек-лист.');
 if(!Array.isArray(d.records)||d.records.length>20000)fail('В копии слишком много записей или неверный формат.');
 const ids=new Set();
 for(const r of d.records){
  if(!object(r)||!text(r.id,80)||!r.id||ids.has(r.id)||!int(r.revision,1,p.revision)||!int(r.step,0,5)||!int(r.observeHours,1,168))fail('Повреждена запись или повторяется её идентификатор.');ids.add(r.id);
  const s=imapSteps[r.step];
  if(r.recipe!==s.key||r.unit!==s.unit||r.target!==s.target||!validDate(r.date)||!/^\d{2}:\d{2}$/.test(r.time)||Number(r.time.slice(0,2))>23||Number(r.time.slice(3))>59||!iso(r.at)||!iso(r.updatedAt))fail('Повреждены продукт, единицы или время записи.');
  if(!['intake','skip'].includes(r.kind)||!['buildup','full'].includes(r.phase)||!bool(r.recipeMatch)||!bool(r.voided))fail('Повреждён тип записи.');
  if(r.kind==='intake'&&(!Number.isFinite(r.amount)||r.amount<=0||r.amount>1000||!['pending','none','skin','gut','other','danger'].includes(r.symptom)))fail('Проверьте порцию и наблюдение.');
  if(r.kind==='skip'&&(r.amount!==0||r.symptom!==null))fail('Повреждена запись пропуска.');
  for(const [k,max] of [['note',600],['reason',120],['onset',80],['treatment',250],['timezone',80]])if(!text(r[k],max))fail('Слишком длинное или неверное поле записи.');
 }
 return d;
}
export function parseBackup(raw){if(typeof raw!=='string'||raw.length>8_000_000)fail('Размер файла превышает 8 МБ.');let value;try{value=JSON.parse(raw,(key,v)=>{if(['__proto__','constructor','prototype'].includes(key))throw Error('Unexpected key');return v;});}catch{fail('Файл не содержит корректную резервную копию JSON.');}return validateData(value);}
export function validateRecordInput(r,now=Date.now()){
 if(!validDate(r.date)||!/^\d{2}:\d{2}$/.test(r.time)||!Number.isFinite(Date.parse(r.at))||Date.parse(r.at)>now)fail('Укажите корректные дату и время уже произошедшего приёма.');
 if(r.kind==='intake'&&(!Number.isFinite(r.amount)||r.amount<=0||r.amount>1000))fail('Введите фактически съеденную порцию больше 0 и не больше 1000.');
 if(r.kind==='intake'&&r.symptom==='none'&&Date.parse(r.at)+r.observeHours*3600000>now)fail('Время наблюдения ещё не закончилось. Выберите «наблюдение продолжается».');
 if(hasSymptoms(r)&&!r.onset)fail('Укажите время появления симптомов или выберите «неизвестно».');
 return r;
}
export function csv(data){
 const q=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 const rows=[['Дата','Время','Ступень','Продукт','Порция','Единицы','Фаза','Наблюдение','Часы наблюдения','Симптомы начались','Помощь','Заметка','Пропуск','Исключена','Период']];
 const observationNames={pending:'Наблюдение продолжается',none:'Наблюдение завершено без симптомов',skin:'Сыпь / зуд / отёк',gut:'Желудочно-кишечные симптомы',other:'Другие симптомы',danger:'Опасные признаки'};
 for(const r of data.records)rows.push([r.date,r.time,r.step+1,imapSteps[r.step].name,r.kind==='skip'?'':r.amount,r.kind==='skip'?'':r.unit==='piece'?'шт.':r.unit==='g'?'г':'мл',r.kind==='skip'?'':r.phase==='full'?'Полная порция':'Наращивание',observationNames[r.symptom]||'',r.kind==='skip'?'':r.observeHours,r.onset,r.treatment,r.note,r.reason,r.voided?'да':'нет',r.revision]);
 return '\uFEFF'+rows.map(row=>row.map(q).join(';')).join('\r\n');
}
