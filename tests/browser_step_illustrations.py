"""Current product illustration follows the patient's plan; checklist input remains usable."""
import os
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':390,'height':844});p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.on('dialog',lambda d:d.accept());p.goto(os.environ.get('APP_URL','http://127.0.0.1:8056/em-moloko/'))
 p.evaluate('''async()=>{const {initialData,KEY}=await import('./core.js'),{initialCollection,addPatient}=await import('./storage.js');const make=i=>{const d=initialData();d.profile.name='Пациент '+(i+1);d.guideRead=true;Object.assign(d.plan,{current:i,phenotype:'nonige',settled:true,observeHours:2});return d;};const collection=initialCollection(make(0));for(let i=1;i<6;i++)addPatient(collection,make(i));const blocked=initialData();blocked.profile.name='Нужен план';addPatient(collection,blocked);collection.activeId=collection.patients[0].id;localStorage.setItem(KEY,JSON.stringify(collection));}''');p.reload()
 options=p.locator('#em-patient-select option').evaluate_all('(els)=>els.map(e=>e.value)');labels=['Печенье','Маффин','Блин','Твёрдый сыр','Йогурт','Пастеризованное молоко / смесь'];positions=['0% 0%','50% 0%','100% 0%','0% 100%','50% 100%','100% 100%'];art=p.locator('#em-current-art')
 expect(p.locator('[data-panel=today] [data-view=guide]')).to_have_text('Что важно перед началом молочной лестницы');expect(p.locator('#em-daily-result')).to_contain_text('повышение дозы')
 for i,id in enumerate(options[:6]):
  p.locator('#em-patient-select').select_option(id);expect(art).to_be_visible();expect(art).to_have_attribute('data-step',str(i));expect(art).to_have_attribute('aria-label',labels[i]);assert art.evaluate('e=>getComputedStyle(e).backgroundPosition')==positions[i]
  for width in [320,390,1440]:
   p.set_viewport_size({'width':width,'height':900});assert not p.evaluate('document.documentElement.scrollWidth>innerWidth');a=art.bounding_box();text=p.locator('.em-current-copy').bounding_box();assert a['x']>=text['x']+text['width'];assert a['width']>=75
  if i in [0,2,5]:
   p.set_viewport_size({'width':390,'height':844});p.locator('.em-current').screenshot(path=f'/tmp/milk-step-{i}.png')
 p.locator('#em-daily-checks input').first.check();expect(p.locator('#em-daily-checks input').first).to_be_checked();p.reload();expect(p.locator('#em-daily-checks input').first).to_be_checked()
 assert p.locator('#em-daily-checks .em-check').first.evaluate('e=>getComputedStyle(e).marginTop')=='0px'
 p.locator('.em-nav [data-view=plan]').click();assert p.locator('#em-plan-conditions .em-check').first.evaluate('e=>getComputedStyle(e).marginTop')=='0px'
 p.locator('#em-patient-select').select_option(options[-1]);p.locator('.em-nav [data-view=today]').click();expect(art).to_be_hidden();expect(p.locator('#em-current-body')).to_have_class('em-current-body em-current-no-art')
 p.locator('#em-patient-select').select_option(options[2]);expect(art).to_be_visible();p.evaluate('navigator.serviceWorker.ready');p.reload();c.set_offline(True);p.reload();expect(art).to_be_visible()
 assert p.evaluate("async()=>{const r=await fetch('./assets/step-products.png');const image=await createImageBitmap(await r.blob());return image.width===1536&&image.height===1024}")
 assert not errors,errors;b.close()
print('PASS: six step illustrations, patient switching, inactive route, narrow/desktop layout, checklist persistence and offline image.')
