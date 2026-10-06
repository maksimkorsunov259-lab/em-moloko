import {KEY,validateData,initialData,clone} from './core.js';
export function load(storage){const raw=storage.getItem(KEY);return raw===null?initialData():validateData(JSON.parse(raw));}
// Save first; only then may the UI adopt the proposed state. Never overwrite a newer tab.
export function save(storage,previous,next){
 const currentRaw=storage.getItem(KEY);
 const current=currentRaw===null?null:validateData(JSON.parse(currentRaw));
 if((current?.revision??0)!==previous.revision)throw new Error('Дневник изменён в другой вкладке. Обновите страницу перед сохранением.');
 const result=clone(next);result.revision=previous.revision+1;result.updatedAt=new Date().toISOString();validateData(result);
 try{storage.setItem(KEY,JSON.stringify(result));}catch{throw new Error('Не удалось сохранить дневник на устройстве. Проверьте свободное место и разрешение браузера на хранение данных.');}
 return result;
}
