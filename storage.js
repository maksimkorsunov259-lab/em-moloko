import {KEY,APP,validateData,initialData,clone,parseBackup,hasSymptoms} from './core.js';
export const COLLECTION_SCHEMA=2,MAX_PATIENTS=100;
const fail=message=>{throw new Error(message);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function initialCollection(diary=initialData()){
 return {app:APP,schema:COLLECTION_SCHEMA,revision:diary.revision,updatedAt:diary.updatedAt,activeId:'patient-1',patients:[{id:'patient-1',diary:clone(validateData(diary))}]};
}
export function validateCollection(value){
 if(!object(value)||value.app!==APP||value.schema!==COLLECTION_SCHEMA)fail('Это не резервная копия ЕмМолоко поддерживаемой версии.');
 if(!Number.isSafeInteger(value.revision)||value.revision<0||typeof value.updatedAt!=='string'||value.updatedAt.length>40||!/^\d{4}-\d{2}-\d{2}T/.test(value.updatedAt)||!Number.isFinite(Date.parse(value.updatedAt)))fail('Повреждена версия данных пациентов.');
 if(!Array.isArray(value.patients)||!value.patients.length||value.patients.length>MAX_PATIENTS)fail('Проверьте список пациентов: от 1 до 100 профилей.');
 const ids=new Set();
 for(const patient of value.patients){
  if(!object(patient)||typeof patient.id!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(patient.id)||ids.has(patient.id))fail('Повреждён или повторяется идентификатор пациента.');
  ids.add(patient.id);validateData(patient.diary);
 }
 if(!ids.has(value.activeId))fail('Выбранный пациент отсутствует в копии.');
 return value;
}
export function activeDiary(collection){return collection.patients.find(patient=>patient.id===collection.activeId).diary;}
export function addPatient(collection,diary=initialData(),id=crypto.randomUUID()){
 if(collection.patients.length>=MAX_PATIENTS)fail('В этом браузере уже 100 пациентов. Сохраните резервные копии перед удалением ненужных профилей.');
 collection.patients.push({id,diary:clone(validateData(diary))});collection.activeId=id;
 validateCollection(collection);
}
export function removePatient(collection,id){
 collection.patients=collection.patients.filter(patient=>patient.id!==id);
 if(!collection.patients.length){const fresh=initialCollection();collection.patients=fresh.patients;collection.activeId=fresh.activeId;}
 else if(!collection.patients.some(patient=>patient.id===collection.activeId))collection.activeId=collection.patients[0].id;
}
// Read the old single-patient diary without writing. The first successful save
// atomically replaces it with the collection; a failed write leaves it intact.
export function load(storage){
 const raw=storage.getItem(KEY);
 if(raw===null)return initialCollection();
 const value=JSON.parse(raw);
 return value?.schema===1?initialCollection(validateData(value)):validateCollection(value);
}
export function save(storage,previous,next){
 const current=load(storage);
 if(current.revision!==previous.revision)fail('Дневники изменены в другой вкладке. Обновите страницу перед сохранением.');
 const result=clone(next);result.revision=previous.revision+1;result.updatedAt=new Date().toISOString();validateCollection(result);
 try{storage.setItem(KEY,JSON.stringify(result));}catch{fail('Не удалось сохранить данные пациентов на устройстве. Проверьте свободное место и разрешение браузера на хранение данных.');}
 return result;
}
export function parseArchive(raw){
 if(typeof raw!=='string'||raw.length>30_000_000)fail('Размер файла превышает 30 МБ.');
 let value;
 try{value=JSON.parse(raw,(key,v)=>{if(['__proto__','constructor','prototype'].includes(key))throw Error();return v;});}catch{fail('Файл не содержит корректную резервную копию JSON.');}
 return value?.schema===1?{kind:'patient',value:parseBackup(raw)}:{kind:'collection',value:validateCollection(value)};
}
export function restorePauses(collection){
 for(const {diary} of collection.patients)if(diary.records.some(r=>!r.voided&&r.revision===diary.plan.revision&&hasSymptoms(r)))diary.paused=true;
}
