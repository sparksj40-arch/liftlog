import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../core.js';
import * as X from '../extensions.js';
import * as U from '../extension-ui.js';
import {prepareImport} from '../backup.js';
import {readFileSync} from 'node:fs';

function fixture(){
  const d=C.newDB(),a={kind:'lift',slot:'lift',title:'Synthetic workout',exercises:[{name:'Lat pulldown',sets:2,unit:'lb'}]},w=C.blankWeek();
  w[0].activities=[a];
  d.events.push(C.eventFor(d.events,'schedule','schedule',{versions:[{id:'v1',effective:'2026-11-22',weekly:w}],overrides:{}}));
  d.draft=C.startSession('2026-11-29',a);
  X.saveExt(d,'note:assessment:2026-11-29:test',{at:C.now(),text:'Synthetic note'});
  d.extension.media['test-image']='data:image/jpeg;base64,AA==';
  return d;
}
test('backup preview preserves input, ignores cloud configuration, restores and deduplicates',()=>{
  const source=fixture(),target=C.newDB(),before=C.clone(target);
  source.config={clientId:'test-source',sheetId:'test-source'};source.extension.remoteIds=['not-local'];source.extension.calendar={id:'test-calendar'};
  const result=prepareImport(target,source);
  assert.deepEqual(target,before);assert.equal(result.added,1);assert.equal(result.extensionAdded,1);
  assert.deepEqual(result.next.events,source.events);assert.deepEqual(result.next.draft,source.draft);
  assert.deepEqual(result.next.config,before.config);assert.deepEqual(result.next.extension.remoteIds,[]);assert.equal(result.next.extension.calendar,undefined);
  const again=prepareImport(result.next,source);assert.equal(again.added,0);assert.equal(again.extensionAdded,0);assert.deepEqual(again.next.extension.media,source.extension.media);
});
test('backup ID, draft and image collisions fail before modifying destination',()=>{
  const target=fixture(),before=C.clone(target);
  let b=C.clone(target);b.events[0].payload.versions[0].weekly[0].notes='changed';
  assert.throws(()=>prepareImport(target,b),/Workout event ID collision/);
  b=C.clone(target);b.extension.events[0].payload.text='changed';assert.throws(()=>prepareImport(target,b),/Extension event ID collision/);
  b=C.clone(target);b.extension.media['test-image']='data:image/jpeg;base64,BB==';assert.throws(()=>prepareImport(target,b),/Photo ID collision/);
  b=C.clone(target);b.draft.notes='changed';assert.throws(()=>prepareImport(target,b),/different unfinished workout/);
  b=C.clone(target);b.extension.media=JSON.parse('{"__proto__":"data:image/jpeg;base64,AA=="}');assert.throws(()=>prepareImport(target,b),/Invalid backup photo/);
  assert.deepEqual(target,before);
});
test('backup merge retains distinct conflicting revisions',()=>{
  const target=fixture(),incoming=C.clone(target),key='note:assessment:2026-11-29:test';
  X.saveExt(target,key,{text:'local'});X.saveExt(incoming,key,{text:'remote'});
  const result=prepareImport(target,incoming);assert.equal(result.conflicts,1);
  assert.equal(X.getExt(result.next,key).text,'local');assert.equal(result.next.extension.events.length,3);
});
test('dashboard shortcut preferences default, deduplicate and allow empty list',()=>{
  assert.deepEqual(U.dashboardShortcuts({}),['start-workout','new-note','new-meal']);
  assert.deepEqual(U.dashboardShortcuts({dashboardShortcuts:['calendar','bad','calendar','ai']}),['calendar','ai']);
  assert.deepEqual(U.dashboardShortcuts({dashboardShortcuts:[]}),[]);
});
test('dashboard customization saves order and dispatches direct actions',async()=>{
  const state=C.newDB(),handlers={},alerts=[],actions=[];let persisted;
  const oldDoc=globalThis.document,oldAlert=globalThis.alert;
  globalThis.document={addEventListener:(type,fn)=>handlers[type]=fn,getElementById:()=>null};globalThis.alert=x=>alerts.push(x);
  try{
    U.connect({db:()=>state,persist:async()=>{persisted=C.clone(state.prefs);return true},render:()=>{},navigate:v=>actions.push(v),quickAction:id=>actions.push(id)});U.install();
    const click=async(x,id)=>{handlers.click({target:{closest:()=>({dataset:{x,id}})}});await new Promise(r=>setImmediate(r));assert.deepEqual(alerts,[])};
    await click('dashboard-toggle','calendar');await click('dashboard-up','calendar');await click('dashboard-toggle','start-workout');
    assert.deepEqual(persisted.dashboardShortcuts,['new-note','calendar','new-meal']);
    await click('dashboard-go','calendar');await click('dashboard-go','new-meal');assert.deepEqual(actions,['calendar','food']);
    await click('dashboard-reset');assert.deepEqual(persisted.dashboardShortcuts,['start-workout','new-note','new-meal']);
  }finally{globalThis.document=oldDoc;globalThis.alert=oldAlert}
});
test('classic worker precaches backup module and shares the same queue implementation',()=>{
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8'),share=readFileSync(new URL('../share.js',import.meta.url),'utf8');
  assert.doesNotMatch(sw,/^\s*(import|export)\s/m);assert.match(sw,/'\.\/backup\.js'/);
  assert.ok(sw.includes(share.split('\n').slice(1,5).join('\n').replaceAll('export ','')));
});
