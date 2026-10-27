"""Diary actions, standalone symptoms, report files, questions and contextual returns."""
import os,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('APP_URL','http://127.0.0.1:8055/em-moloko/')
with sync_playwright() as pw,tempfile.TemporaryDirectory() as tmp:
 c=pw.chromium.launch_persistent_context(tmp,executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'],viewport={'width':390,'height':844});p=c.new_page();errors=[];accept=[True];prompts=[]
 p.on('pageerror',lambda e:errors.append(str(e)))
 def answer(d):
  prompts.append(d.type);d.accept() if accept[0] else d.dismiss()
 p.on('dialog',answer);p.goto(URL);expect(p.locator('#em-profile-button')).to_be_visible()
 p.evaluate('''async()=>{const {initialData,KEY}=await import('./core.js'),{initialCollection,addPatient}=await import('./storage.js');const d=initialData();d.profile.name='Миша';d.guideRead=true;d.plan.phenotype='nonige';d.plan.settled=true;d.plan.observeHours=24;d.records=[{id:'old-intake',revision:1,step:0,observeHours:24,recipe:'AUK2025-biscuit',unit:'piece',target:3,date:'2026-10-01',time:'10:00',at:'2026-10-01T07:00:00.000Z',updatedAt:'2026-10-01T07:00:00.000Z',kind:'intake',phase:'buildup',amount:.25,symptom:'none',recipeMatch:true,voided:false,note:'Старая запись',reason:'',onset:'',treatment:'',timezone:'Europe/Moscow'}];const col=initialCollection(d),second=initialData();second.profile.name='Аня';second.guideRead=true;addPatient(col,second,'second');col.activeId='patient-1';localStorage.setItem(KEY,JSON.stringify(col));}''');p.reload()
 def panel(name):return p.locator('[data-panel="'+name+'"]')
 def diary():p.locator('.em-nav [data-view=diary]').click();expect(panel('diary')).to_be_visible()
 def stored():return p.evaluate("JSON.parse(localStorage.getItem('em-moloko.diary.v1'))")
 def report():panel('diary').locator('[data-view=report]').click();expect(panel('report')).to_be_visible()
 expect(panel('today')).to_be_visible();panel('today').get_by_role('button',name='Что важно перед началом молочной лестницы',exact=True).click();expect(panel('guide')).to_be_visible();expect(p.locator('#em-guide-back')).to_have_text('← Сегодня');p.locator('#em-guide-back').click();expect(panel('today')).to_be_visible()
 p.locator('#em-current-recipe').click();expect(p.locator('#em-recipe-back')).to_have_text('← Сегодня');p.locator('#em-recipe-back').click();expect(panel('today')).to_be_visible()
 diary();assert panel('diary').get_by_role('button',name='Для врача',exact=True).count()==0
 for width in [320,390,1440]:
  p.set_viewport_size({'width':width,'height':900});actions=panel('diary').locator('.em-diary-actions').bounding_box();r=panel('diary').locator('[data-view=report]').bounding_box();assert r['y']>=actions['y']+actions['height'];assert abs(r['width']-actions['width'])<1;assert not p.evaluate('document.documentElement.scrollWidth>innerWidth')
 p.set_viewport_size({'width':390,'height':844});panel('diary').locator('[data-view=record]').click();p.locator('#em-amount').fill('.5');p.locator('#em-note').fill('Новый приём');p.locator('#em-save-record').click();expect(panel('diary')).to_be_visible();assert len(stored()['patients'][0]['diary']['records'])==2
 p.locator('[data-edit=old-intake]').click();p.locator('#em-note').fill('Уточнённая запись');p.locator('#em-save-record').click();expect(panel('diary')).to_be_visible();p.locator('[data-void=old-intake]').click();expect(p.locator('#em-entries .em-voided')).to_contain_text('Уточнённая запись');assert len(stored()['patients'][0]['diary']['records'])==2
 panel('diary').locator('[data-view=record]').click();p.locator('#em-kind').select_option('skip');p.locator('#em-save-record').click();expect(panel('diary')).to_be_visible()
 panel('diary').locator('[data-view=symptom]').click();p.locator('#em-event-symptom').select_option('danger');expect(p.locator('#em-event-warning')).to_contain_text('112');p.locator('#em-event-note').fill('Симптом без известного приёма');panel('symptom').locator('[data-view=help]').click();expect(p.locator('#family-help')).to_be_visible();p.locator('#family-help [data-family-about-close]').click();expect(p.locator('#em-event-note')).to_have_value('Симптом без известного приёма');p.locator('#em-event-symptom').select_option('skin');p.locator('#em-save-event').click();expect(panel('diary')).to_be_visible()
 a=stored()['patients'][0]['diary'];assert a['paused'];symptom=next(r for r in a['records'] if r['kind']=='symptom');assert symptom['amount']==0 and not symptom['recipeMatch'];assert len(a['records'])==4
 p.locator('[data-edit="'+symptom['id']+'"]').click();p.locator('#em-event-note').fill('Уточнённый симптом');p.locator('#em-save-event').click();expect(panel('diary')).to_be_visible()
 report();questions='Что делать дальше?\n<script>window.bad=true</script>';p.locator('#em-report-questions').fill(questions)
 p.evaluate('window.print=()=>{window.printCalled=true}');p.locator('#em-print-report').click();p.wait_for_function('window.printCalled===true')
 html=p.locator('#em-report').inner_html();assert questions not in html;assert '&lt;script&gt;' in html and 'Уточнённый симптом' in html and 'Исключена из подсчёта' in html;assert stored()['patients'][0]['diary']['questions']==questions
 assert p.evaluate('window.bad') is None;expect(p.locator('#em-report')).to_contain_text('Миша');expect(p.locator('#em-report')).not_to_contain_text('Аня');assert p.locator('#em-download-report').count()==0
 p.evaluate('window.printCalled=false')
 p.locator('#em-report-questions').fill('Вопрос для печати');p.evaluate('window.print=()=>window.printCalled=true');p.locator('#em-print-report').click();p.wait_for_function('window.printCalled===true');expect(p.locator('#em-report-body')).to_contain_text('Вопрос для печати')
 p.emulate_media(media='print');expect(p.locator('#em-report-questions')).to_be_hidden();expect(p.locator('#em-report')).to_be_visible();p.emulate_media(media='screen');p.screenshot(path='/tmp/moloko-report.png')
 p.locator('#em-report-questions').fill('Несохранённый вопрос');accept[0]=False;p.locator('#em-patient-select').select_option('second');expect(p.locator('#em-patient-select')).to_have_value('patient-1');expect(p.locator('#em-report-questions')).to_have_value('Несохранённый вопрос');accept[0]=True;p.locator('#em-patient-select').select_option('second');expect(panel('today')).to_be_visible()
 diary();expect(panel('diary').locator('[data-view=record]')).to_be_disabled();panel('diary').locator('[data-view=symptom]').click();p.locator('#em-event-symptom').select_option('gut');p.locator('#em-save-event').click();expect(panel('diary')).to_be_visible();report();expect(p.locator('#em-report-questions')).to_have_value('');assert len(stored()['patients'][1]['diary']['records'])==1
 p.locator('#em-patient-select').select_option('patient-1');expect(panel('today')).to_be_visible();diary();report();expect(p.locator('#em-report-questions')).to_have_value('Вопрос для печати');assert len(stored()['patients'][0]['diary']['records'])==4
 p.evaluate('navigator.serviceWorker.ready');p.reload();expect(panel('today')).to_be_visible();c.set_offline(True);p.reload();expect(panel('today')).to_be_visible();diary();report();expect(p.locator('#em-report-log')).to_contain_text('Уточнённый симптом');expect(p.locator('#em-report-questions')).to_have_value('Вопрос для печати');assert not errors,errors;c.close()
print('PASS: diary actions, intake/skip/edit/void, standalone symptoms and blocked-plan access, help draft preservation, contextual returns, report PDF/print/questions, escaping, patient isolation, cancellation and offline.')
