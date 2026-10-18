import test from 'node:test';
import assert from 'node:assert/strict';
import {KEY,initialData,clone,evaluateProgress,localDate,parseBackup} from '../core.js';
import {initialCollection,load,save,activeDiary,addPatient,removePatient,parseArchive,validateCollection,restorePauses} from '../storage.js';
class MemoryStorage{
 constructor(value){this.raw=value===undefined?null:JSON.stringify(value);this.fail=false;}
 getItem(key){assert.equal(key,KEY);return this.raw;}
 setItem(key,value){assert.equal(key,KEY);if(this.fail)throw Error('QuotaExceeded');this.raw=value;}
}
function diary(name='Миша'){
 const d=initialData();d.profile.name=name;d.guideRead=true;d.plan.phenotype='nonige';d.plan.settled=true;d.plan.observeHours=48;d.revision=7;
 d.records=[{id:'existing-entry',revision:1,step:0,observeHours:48,recipe:'AUK2025-biscuit',unit:'piece',target:3,date:'2026-10-01',time:'10:00',at:'2026-10-01T07:00:00.000Z',updatedAt:'2026-10-01T07:00:00.000Z',kind:'intake',phase:'buildup',amount:.25,symptom:'pending',recipeMatch:true,voided:false,note:'Старая запись',reason:'',onset:'',treatment:'',timezone:'Europe/Moscow'}];return d;
}
test('legacy migration preserves every field and does not write until save succeeds',()=>{
 const original=diary(),storage=new MemoryStorage(original),raw=storage.raw;
 const collection=load(storage);assert.equal(storage.raw,raw);assert.deepEqual(activeDiary(collection),original);
 const next=clone(collection);addPatient(next,initialData(),'second');storage.fail=true;
 assert.throws(()=>save(storage,collection,next),/Не удалось сохранить/);assert.equal(storage.raw,raw);
 storage.fail=false;const saved=save(storage,collection,next);assert.equal(saved.schema,2);assert.equal(saved.revision,8);assert.deepEqual(saved.patients[0].diary,original);assert.deepEqual(load(storage),saved);
});
test('plans, symptoms, checklists, questions and completion counts do not cross patient boundaries',()=>{
 const a=diary();a.paused=true;a.question=true;a.daily={date:localDate(),well:true,asthma:true,changes:true,prepared:true};a.records[0].symptom='skin';a.records[0].onset='10 минут';
 const collection=initialCollection(a);addPatient(collection,initialData(),'second');const b=activeDiary(collection);
 assert.equal(b.plan.phenotype,'unknown');assert.equal(b.paused,false);assert.equal(b.question,false);assert.equal(b.daily.well,false);assert.equal(b.records.length,0);assert.equal(b.guideRead,false);
 b.profile.name='Аня';b.plan.current=1;assert.deepEqual(collection.patients[0].diary,a);
 assert.equal(evaluateProgress(a).ready,false);assert.equal(evaluateProgress(b).count,0);
 collection.activeId='patient-1';assert.deepEqual(activeDiary(collection),a);
});
test('a stale tab cannot overwrite a different active patient or newer records',()=>{
 const storage=new MemoryStorage(diary()),tabA=load(storage),tabB=load(storage),next=clone(tabA);addPatient(next,initialData(),'second');save(storage,tabA,next);const raw=storage.raw;
 const stale=clone(tabB);activeDiary(stale).profile.name='Wrong target';assert.throws(()=>save(storage,tabB,stale),/другой вкладке/);assert.equal(storage.raw,raw);
});
test('new collection rejects legacy saves and malformed or ambiguous patients',()=>{
 const collection=initialCollection(diary());assert.throws(()=>parseBackup(JSON.stringify(collection)));
 const duplicate=clone(collection);duplicate.patients.push(clone(duplicate.patients[0]));assert.throws(()=>validateCollection(duplicate),/идентификатор/);
 const missing=clone(collection);missing.activeId='missing';assert.throws(()=>validateCollection(missing),/отсутствует/);
 const invalid=clone(collection);invalid.patients[0].diary.records[0].target=999;assert.throws(()=>validateCollection(invalid));
 assert.throws(()=>parseArchive('{"__proto__":{}}'),/корректную/);
});
test('single-patient and complete backups round-trip without merging histories',()=>{
 const collection=initialCollection(diary());const original=clone(collection.patients[0]);
 const imported=parseArchive(JSON.stringify(diary('Аня')));assert.equal(imported.kind,'patient');addPatient(collection,imported.value,'imported');assert.deepEqual(collection.patients[0],original);
 const roundTrip=parseArchive(JSON.stringify(collection));assert.equal(roundTrip.kind,'collection');assert.deepEqual(roundTrip.value,collection);
 removePatient(collection,'imported');assert.deepEqual(activeDiary(collection),original.diary);
 removePatient(collection,'patient-1');assert.equal(collection.patients.length,1);assert.equal(activeDiary(collection).records.length,0);validateCollection(collection);
});
test('restored reaction blocks only the affected patient',()=>{
 const a=diary();a.records[0].symptom='skin';a.records[0].onset='10 минут';
 const collection=initialCollection(a);addPatient(collection,diary('Аня'),'second');restorePauses(collection);
 assert.equal(collection.patients[0].diary.paused,true);assert.equal(activeDiary(collection).paused,false);
});
