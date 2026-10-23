import test from 'node:test';
import assert from 'node:assert/strict';
import {initialData,validateData,validateRecordInput,evaluateProgress,hasSymptoms,parseBackup,csv,clone,localDate} from '../core.js';
import {initialCollection,addPatient,parseArchive,restorePauses} from '../storage.js';
const symptom=()=>({id:'symptom-1',revision:1,step:0,recipe:'AUK2025-biscuit',unit:'piece',target:3,observeHours:0,voided:false,timezone:'Europe/Moscow',date:'2026-10-01',time:'12:00',at:'2026-10-01T09:00:00.000Z',updatedAt:'2026-10-01T09:00:00.000Z',kind:'symptom',amount:0,phase:'buildup',recipeMatch:false,symptom:'skin',onset:'Дата и время появления указаны в записи',treatment:'',note:'Наблюдение без известного приёма',reason:''});
test('a standalone symptom is valid without a home plan and never counts as intake',()=>{
 const d=initialData();d.records=[symptom()];validateData(d);validateRecordInput(d.records[0]);assert(hasSymptoms(d.records[0]));assert.equal(evaluateProgress(d).count,0);
 assert.match(csv(d),/Отдельный симптом/);assert.doesNotMatch(csv(d),/Печенье/);
 for(const patch of [{amount:3},{symptom:'none'},{symptom:'pending'},{phase:'full'},{recipeMatch:true}]){const invalid=clone(d);Object.assign(invalid.records[0],patch);assert.throws(()=>validateData(invalid));}
});
test('standalone symptoms block progression and restore pauses only for their patient',()=>{
 const d=initialData();d.plan.phenotype='nonige';d.plan.settled=true;d.plan.observeHours=24;d.daily={date:localDate(),well:true,asthma:true,changes:true,prepared:true};d.records=[symptom()];
 assert.equal(evaluateProgress(d).ready,false);assert(evaluateProgress(d).rows.some(r=>!r.ok&&r.text.includes('симптомах')));
 const c=initialCollection(d);addPatient(c,initialData(),'second');restorePauses(c);assert.equal(c.patients[0].diary.paused,true);assert.equal(c.patients[1].diary.paused,false);
 d.records[0].voided=true;assert(!evaluateProgress(d).rows.some(r=>!r.ok&&r.text.includes('симптомах')));
});
test('old backups remain readable; patient questions and symptoms round-trip independently',()=>{
 const legacy=initialData();delete legacy.questions;assert.deepEqual(parseBackup(JSON.stringify(legacy)),legacy);
 const a=initialData();a.records=[symptom()];a.questions='Что обсудить?\n<script>текст</script>';const c=initialCollection(a);addPatient(c,initialData(),'second');const restored=parseArchive(JSON.stringify(c)).value;
 assert.deepEqual(restored.patients[0].diary,a);assert.equal(restored.patients[1].diary.questions,'');assert.equal(restored.patients[1].diary.records.length,0);
 for(const questions of [null,{},'a'.repeat(2001)])assert.throws(()=>validateData({...a,questions}));
});
