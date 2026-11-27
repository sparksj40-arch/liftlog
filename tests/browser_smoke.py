import os, pathlib, threading, http.server, functools
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1]
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None); page=b.new_page(viewport={'width':390,'height':844},service_workers='block');
 page.set_default_timeout(8000)
 errors=[]; dialogs=[];page.on('pageerror',lambda e:(errors.append(str(e)),print('BROWSER ERROR:',e,flush=True)));page.on('dialog',lambda d:(dialogs.append(d.message),print('BROWSER DIALOG:',d.message,flush=True),d.accept()))
 page.goto(url);page.get_by_role('heading',name='Personal dashboard').wait_for();page.locator('#status').get_by_text('Saved locally',exact=True).wait_for();print('PASS dashboard')
 page.locator('[data-x="dashboard-edit"]').click()
 page.locator('[data-x="dashboard-toggle"][data-id="calendar"]').click()
 page.locator('[data-x="dashboard-up"][data-id="calendar"]').click()
 from playwright.sync_api import expect
 expect(page.locator('[data-x="dashboard-go"]')).to_have_count(4)
 for i, key in enumerate(['start-workout','new-note','calendar','new-meal']):
  expect(page.locator('[data-x="dashboard-go"]').nth(i)).to_have_attribute('data-id',key)
 page.locator('#status').get_by_text('Saved locally',exact=True).wait_for()
 page.reload()
 page.get_by_role('heading',name='Personal dashboard').wait_for()
 assert page.locator('[data-x="dashboard-go"]').evaluate_all('(els) => els.map(el=>el.dataset.id)')==['start-workout','new-note','calendar','new-meal']
 page.locator('[data-x="dashboard-go"][data-id="calendar"]').click()
 page.locator('#planner-date').wait_for()
 page.locator('.dashboard-home').click()
 page.locator('[data-x="dashboard-go"][data-id="new-note"]').click()
 page.locator('#pn-title').fill('Shortcut note')
 page.locator('[id^="pn-text-"]').fill('Synthetic shortcut task')
 page.locator('[data-p="note-save"]').click()
 page.locator('#pn-list').get_by_role('heading',name='Shortcut note').wait_for()
 page.locator('.dashboard-home').click()
 page.locator('[data-x="dashboard-edit"]').click()
 page.locator('[data-x="dashboard-reset"]').click()
 page.locator('[data-x="dashboard-go"][data-id="calendar"]').wait_for(state='detached')
 page.locator('#status').get_by_text('Saved locally',exact=True).wait_for()
 page.reload()
 page.get_by_role('heading',name='Personal dashboard').wait_for()
 assert page.locator('[data-x="dashboard-go"]').evaluate_all('(els) => els.map(el=>el.dataset.id)')==['start-workout','new-note','new-meal']
 print('PASS dashboard customization, direct actions and saved preferences')
 page.get_by_role('button',name='Measurements Check-ins and history').click();page.locator('#assessment-date').fill('2026-11-29');page.locator('#assessment-date').dispatch_event('change');
 page.locator('[data-x="measurement-skip"][data-id="back"]').click();page.locator('[data-x="measurement-undo"][data-id="back"]').wait_for();page.locator('[data-x="measurement-undo"][data-id="back"]').click();page.locator('[data-x="measurement-skip"][data-id="back"]').wait_for();print('PASS skip and undo')
 page.locator('#m-waist-0').fill('36');page.locator('[data-x="measurement-record"][data-id="waist"]').click();page.get_by_text('Average: 36 in').wait_for();page.locator('#assessment-notes').fill('Synthetic note');page.locator('[data-x="assessment-notes"]').click();page.wait_for_timeout(200);assert page.locator('#assessment-notes').input_value()=='Synthetic note';print('PASS measurement and note')
 page.locator('#assessment-date').fill('2026-12-06');page.locator('#assessment-date').dispatch_event('change');page.locator('#m-chest-fold-0').fill('12');page.locator('#m-chest-fold-1').fill('14');page.locator('#m-chest-fold-2').fill('16');page.locator('[data-x="measurement-record"][data-id="chest-fold"]').click();page.get_by_text('Average: 14 mm').wait_for();print('PASS three readings')
 page.locator('.dashboard-home').click();page.locator('[data-x="dashboard-go"][data-id="new-meal"]').click();page.locator('#food-description').fill('Synthetic meal');page.locator('#food-calories').fill('333');page.locator('#food-samsungCalories').fill('330');page.locator('[data-x="food-save"]').click();page.locator('#food-list').get_by_text('Synthetic meal',exact=True).wait_for();print('PASS food save')
 page.locator('.dashboard-home').click();page.get_by_role('button',name='Planner Notes, tasks and reminders').click()
 page.locator('[data-p="note-new"]').click();page.locator('#pn-title').fill('Synthetic errands');page.locator('[id^="pn-text-"]').fill('Buy test filters');page.locator('#pn-until').check();page.locator('[data-p="note-save"]').click();page.locator('#pn-list').get_by_role('heading',name='Synthetic errands').wait_for();print('PASS Planner note creation')
 page.locator('#pn-list .card').filter(has=page.get_by_role('heading',name='Synthetic errands',exact=True)).locator('[data-p="reminder-open"]').click();assert page.locator('[data-rem-date]').count()==8;assert page.locator('#rem-time').input_value()=='09:15';assert page.locator('#rem-early').input_value()=='15';page.locator('[id^="rem-entry-"]').check();page.locator('[data-rem-date]').first.check();date=page.locator('[data-rem-date]').first.input_value();page.locator('#rem-until').check();page.locator('[data-p="reminder-save"]').click();page.locator('#pn-list').get_by_role('heading',name='Synthetic errands').wait_for();page.locator('[data-p="tab"][data-id="calendar"]').click();page.locator('#planner-date').fill(date);page.locator('#planner-date').dispatch_event('change');page.get_by_text('09:15 · Synthetic errands',exact=True).wait_for();page.get_by_text('Planner reminder · also 15 min early',exact=True).wait_for();page.locator('[data-p="reminder-edit"]').click();assert page.locator('[id^="rem-entry-"]').is_checked();assert page.locator('#rem-until').is_checked();page.locator('[data-p="reminder-close"]').click();page.get_by_text('09:15 · Synthetic errands',exact=True).wait_for();print('PASS Planner linked reminder')
 page.locator('[data-p="tab"][data-id="active"]').click();page.locator('#pn-list .card').filter(has=page.get_by_role('heading',name='Synthetic errands',exact=True)).locator('[data-p-check]').check();page.get_by_text('1/1 tasks',exact=True).wait_for();page.locator('[data-p="tab"][data-id="calendar"]').click();page.locator('#planner-date').fill(date);page.locator('#planner-date').dispatch_event('change');page.get_by_text('No reminders for this date.',exact=True).wait_for();print('PASS completing linked task stops reminder')
 page.locator('.dashboard-home').click();page.get_by_role('button',name='Subscriptions Renewals and cancellations').click();page.locator('[data-p="sub-new"]').click();page.locator('#sub-company').fill('Synthetic service');page.locator('#sub-amount').fill('12');page.locator('#sub-frequency').select_option('monthly');page.locator('#sub-status').select_option('active');page.locator('#sub-intent').select_option('indefinite');page.locator('[data-p="sub-save"]').click();page.get_by_text('Synthetic service · active',exact=True).wait_for();page.get_by_text('USD 12.00 / month · 144.00 / year',exact=True).wait_for();print('PASS subscription creation and totals')
 # Exercise actual review UI with synthetic local Gmail candidates and a mock connector inbox.
 page.wait_for_timeout(200)
 page.evaluate("""async () => {
   const S=await import('./storage.js'),G=await import('./gmail-discovery.js'),C=await import('./core.js'),X=await import('./extensions.js');
   let d=await S.load(),s=G.state(d);s.enabled=true;s.account='synthetic@example.invalid';
   const make=(id,body)=>G.candidate({id,internalDate:String(Date.now()),payload:{mimeType:'text/plain',headers:[{name:'Subject',value:'Subscription renewal confirmation'},{name:'From',value:'Synthetic service <billing@example.invalid>'}],body:{data:btoa(body)}}});
   s.pending=[make('synthetic-renewal','Your subscription has been renewed. USD 15 per month.'),make('synthetic-reject','Your subscription has been renewed. USD 18 per month.')];
   X.initExt(d).proposals=[{id:'synthetic-connector',createdAt:C.now(),kind:'subscription',base:'',payload:{company:'Connector trial',amount:9.99,currency:'USD',frequency:'monthly',status:'trial',trialEnd:'2026-12-26',sources:['synthetic-connector-source']},explanation:'Synthetic connector evidence',approval:'PENDING'}];
   await S.save(d);
 }""")
 page.reload();page.get_by_role('heading',name='Personal dashboard').wait_for()
 expect(page.locator('#gmail-dashboard-status')).to_contain_text('2 Gmail candidate(s) awaiting review')
 page.locator('[data-act="nav"][data-v="subscriptions"]').click()
 expect(page.locator('[data-p="sub-proposal"]')).to_have_count(3)
 # Confirm new connector evidence without automatically accepting an intent or status.
 page.locator('[data-p="sub-proposal"][data-id="synthetic-connector"]').click()
 expect(page.locator('#sub-status')).to_have_value('verification')
 expect(page.locator('#sub-intent')).to_have_value('later')
 page.locator('#sub-status').select_option('trial');page.locator('#sub-intent').select_option('trial')
 page.locator('[data-p="sub-save"]').click();page.get_by_text('Connector trial · trial',exact=True).wait_for()
 # A known company is never silently merged; explicitly choose the existing record.
 page.locator('[data-p="sub-proposal"][data-id="gmail-synthetic-renewal"]').click()
 page.locator('#sub-existing').select_option(label='Synthetic service — active')
 page.locator('[data-p="sub-match-existing"]').click()
 expect(page.locator('#sub-status')).to_have_value('active')
 expect(page.locator('#sub-intent')).to_have_value('indefinite')
 expect(page.locator('#sub-amount')).to_have_value('15')
 page.locator('[data-p="sub-save"]').click()
 page.get_by_text('Synthetic service · active',exact=True).wait_for()
 page.locator('[data-p="sub-reject"][data-id="gmail-synthetic-reject"]').click()
 expect(page.locator('[data-p="sub-proposal"]')).to_have_count(0)
 page.locator('#status').get_by_text('Saved locally',exact=True).wait_for()
 page.reload();page.get_by_role('heading',name='Personal dashboard').wait_for()
 page.locator('[data-act="nav"][data-v="subscriptions"]').click()
 expect(page.locator('[data-p="sub-proposal"]')).to_have_count(0)
 assert page.evaluate("""async () => {let d=await (await import('./storage.js')).load(),P=await import('./planner.js'),X=await import('./extensions.js');let s=P.subscriptions(d);return s.length===2&&s.find(v=>v.company==='Synthetic service').amount===15&&X.getExt(d,'decision:gmail-synthetic-reject').status==='rejected'}""")
 assert len(dialogs)==2 and 'Possible duplicate' in dialogs[0] and 'selected record' in dialogs[1],dialogs
 dialogs.clear()
 print('PASS Gmail and connector review, explicit matching, rejection and reload deduplication')
 page.locator('.dashboard-home').click();page.get_by_role('button',name='LiftLog Training, recovery and progress').click();page.locator('[data-act="unscheduled"][data-kind="lift"]').click();page.locator('#exercise-search').fill('lat pulldown');page.locator('[data-x="picker-select"][data-bank="builtin:lat pulldown"]').click();page.get_by_role('heading',name='Lat pulldown').wait_for();page.locator('[data-act="add-ex"]').click();page.locator('#exercise-search').fill('plank');page.locator('[data-x="picker-select"][data-bank="builtin:plank"]').click();page.get_by_role('heading',name='Plank',exact=True).wait_for();print('PASS workout exercise picker')
 page.get_by_text('Saved locally',exact=True).wait_for();page.reload();page.get_by_role('heading',name='Lat pulldown').wait_for();page.get_by_role('heading',name='Plank',exact=True).wait_for();print('PASS draft persists after reload')
 assert not errors,errors;assert not dialogs,dialogs
 b.close()
server.shutdown()
