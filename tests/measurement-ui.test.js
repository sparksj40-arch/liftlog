import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../core.js';
import * as X from '../extensions.js';
import * as U from '../extension-ui.js';

test('measurement UI saves Skip, Undo, reading and notes to the actual database', async () => {
  const state=C.newDB(), handlers={}, fields={}, alerts=[];
  let snapshot, renders=0;
  const originalDoc=globalThis.document, originalAlert=globalThis.alert;
  globalThis.document={addEventListener:(type,fn)=>{handlers[type]=fn},getElementById:id=>fields[id]??null};
  globalThis.alert=message=>alerts.push(message);
  try {
    U.connect({db:()=>state,persist:async()=>{snapshot=C.clone(state);return true},render:()=>{renders++}});
    U.install();
    handlers.change({target:{id:'assessment-date',value:'2026-11-29',dataset:{}}});
    const click=async(x,id)=>{
      handlers.click({target:{closest:()=>({dataset:{x,id}})}});
      await new Promise(resolve=>setImmediate(resolve));
      assert.deepEqual(alerts,[]);
    };
    await click('measurement-skip','back');
    assert.equal(X.assessment(snapshot,'2026-11-29').items.find(i=>i.id==='back').status,'skipped');
    assert.match(U.measurements(),/data-x="measurement-undo" data-id="back"/);
    await click('measurement-undo','back');
    assert.equal(X.assessment(snapshot,'2026-11-29').items.find(i=>i.id==='back').status,'pending');
    fields['m-waist-0']={value:'36'};
    fields['assessment-notes']={value:'Synthetic note'};
    fields['notes-waist']={value:'Synthetic individual note'};
    await click('measurement-record','waist');
    const a=X.assessment(snapshot,'2026-11-29');
    assert.equal(a.items.find(i=>i.id==='waist').values[0],36);
    assert.equal(a.notes,'Synthetic note');
    assert.equal(a.items.find(i=>i.id==='waist').notes,'Synthetic individual note');
    assert.equal(renders,4);
    assert.throws(()=>X.saveExt(()=>state,'assessment:test',{}),/Invalid extension database/);
  } finally {globalThis.document=originalDoc;globalThis.alert=originalAlert}
});
