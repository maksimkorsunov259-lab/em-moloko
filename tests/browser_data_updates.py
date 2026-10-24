"""Real worker updates block on a draft, preserve data, and expose manual checking."""
import os,json,re,hashlib,tempfile,shutil,http.server,functools,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
APP=os.environ.get('APP_NAME',Path(__file__).resolve().parents[1].name);DY=APP=='dyshu-diary';prefix='pf-' if DY else 'em-';ROOT=Path('/workspace')/APP
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as pw:
 root=Path(tmp)/APP;shutil.copytree(ROOT,root,ignore=shutil.ignore_patterns('.git','__pycache__'));server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=tmp));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/{APP}/'
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context();p=c.new_page();p.on('dialog',lambda d:d.accept());errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.goto(url);p.evaluate('navigator.serviceWorker.ready')
 if DY:expect(p.locator('#pf-loading')).to_be_hidden();p.evaluate('DyshuUpdate.prepare()');p.locator('[data-screen=settings]').click();field='#pf-patient-name'
 else:p.locator('#em-profile-button').click();field='#em-child-name'
 p.locator(field).fill('Несохранённый черновик')
 # Simulate browser installation offer, cancel it without falsely claiming installed.
 p.evaluate("window.testPromptCalls=0;const e=new Event('beforeinstallprompt');e.prompt=async()=>{window.testPromptCalls++};e.userChoice=Promise.resolve({outcome:'dismissed'});dispatchEvent(e)")
 f=root/'app.js';f.write_bytes(f.read_bytes()+b'\nwindow.testUpdatedBuild=true;\n');sw=root/'sw.js';s=sw.read_text();key='ASSETS' if DY else 'FILES';assets=json.loads(re.search(key+r'=(\[.*?\]);',s)[1]);h=hashlib.sha256(b''.join((root/a).read_bytes() for a in assets)).hexdigest()[:12]
 s=re.sub(r'const CACHE="[^"]+"','const CACHE="dyshu-dyshu-diary-'+h+'"',s,count=1) if DY else re.sub(r"const CACHE=PREFIX\+'[^']+'","const CACHE=PREFIX+'"+h+"'",s,count=1);sw.write_text(s)
 p.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update())');banner=p.locator('#pf-update-banner' if DY else '#em-update-bar');expect(banner).to_be_visible();banner.locator('button').click();expect(p.locator(field)).to_have_value('Несохранённый черновик');assert p.evaluate('window.testUpdatedBuild') is None;expect(p.locator('#'+prefix+'update-message')).to_contain_text('Сначала сохраните')
 if DY:p.locator('#pf-settings-panel [data-open-data]').click();p.evaluate('DyshuUpdate.prepare()')
 else:p.locator('.em-nav [data-view=more]').click();p.locator('[data-panel=more] [data-view=settings]').click()
 p.locator('#'+prefix+'install').click();assert p.evaluate('window.testPromptCalls')==1;expect(p.locator('#'+prefix+'install-status')).to_contain_text('отменена')
 p.locator('#'+prefix+'check-update').click();expect(p.locator('#'+prefix+'update-check-status')).to_contain_text('Обновление готово')
 with p.expect_navigation(wait_until='load'):
  p.locator('#'+prefix+('update' if DY else 'update-settings')).click()
 # Dyshu CSP prevents wait_for_function, so use locator assertions followed by evaluate.
 expect(banner).to_be_hidden(timeout=15000);assert p.evaluate('window.testUpdatedBuild') is True;assert not errors,errors;b.close();server.shutdown()
print('PASS:',APP,'manual real update, unsaved-draft protection, cancelled install and reload to new worker.')
