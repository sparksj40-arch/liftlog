import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../core.js';
import * as X from '../extensions.js';
import * as P from '../planner.js';
import * as G from '../cloud.js';
import * as GC from '../calendar-sync.js';

test('Calendar authorization rejects invalid scope, expiry and cancelled callbacks',async()=>{
 const scope=GC.SCOPE,client='test.apps.googleusercontent.com';
 let callback;
 globalThis.window={google:{accounts:{oauth2:{}}}};
 globalThis.google={accounts:{oauth2:{initTokenClient:o=>{callback=o.callback;return {requestAccessToken:()=>{}}}}}};
 const begin=async()=>{callback=null;const p=GC.authorize(client);await new Promise(r=>setImmediate(r));return {p}};
 try{
  let {p}=await begin();callback({access_token:'test',expires_in:3600,scope:'wrong'});await assert.rejects(p,/permission/);
  ({p}=await begin());callback({access_token:'test',expires_in:1,scope});await assert.rejects(p,/lifetime/);
  ({p}=await begin());await assert.rejects(GC.authorize(client),/already open/);GC.disconnect();callback({access_token:'test',expires_in:3600,scope});await assert.rejects(p,/cancelled/);assert.equal(GC.authorized(),false);
  ({p}=await begin());callback({access_token:'test',expires_in:3600,scope});await p;assert.ok(GC.authorizationStatus().expiresAt>Date.now());
  globalThis.fetch=async()=>({ok:false,status:401,json:async()=>({})});
  await assert.rejects(GC.createCalendar('America/Detroit'),/401/);assert.equal(GC.authorized(),false);
 }finally{GC.disconnect();delete globalThis.window;delete globalThis.google;delete globalThis.fetch}
});

function subscription(db,id='one',sources=['email-1'],extra={}){
 return P.saveSubscription(db,{id,company:'Synthetic service',description:'Original plan',amount:12,currency:'USD',frequency:'monthly',status:'trial',intent:'trial',start:'2026-11-01',renewal:'2026-12-01',trialEnd:'2026-12-01',promoEnd:'',deadline:'2026-11-29',cancelDate:'',instructions:'Original instructions',sources,reminderDays:[7,3,1,0],...extra});
}
test('email candidate preserves user choices, earlier deadlines and unknown fields',()=>{
 const d=C.newDB(),old=subscription(d),before=C.clone(d),base=X.replayExt(d.extension.events).heads.get('subscription:record:one').id;
 const r=P.subscriptionCandidate(d,{id:'one',company:'Synthetic service',description:'',amount:null,currency:'EUR',status:'cancelled',intent:'indefinite',trialEnd:'2027-01-01',deadline:'2027-01-01',cancelDate:'2027-01-01',reminderDays:[],sources:['email-1','email-2']},{base,proposalId:'candidate'});
 assert.deepEqual(d,before);assert.equal(r.draft.intent,old.intent);assert.equal(r.draft.status,old.status);assert.equal(r.draft.deadline,old.deadline);assert.equal(r.draft.trialEnd,old.trialEnd);assert.equal(r.draft.currency,'USD');assert.equal(r.draft.amount,12);assert.equal(r.draft.cancelDate,'');assert.equal(r.draft.description,old.description);assert.deepEqual(r.draft.reminderDays,old.reminderDays);assert.deepEqual(r.draft.sources,['email-1','email-2']);assert.equal(r.evidenceStatus,'cancelled');assert.equal(r.draft.proposalId,'candidate');
 assert.equal(P.cancellationDate(r.draft),'2026-11-29');
});
test('new candidate requires verification and currency, rejects ambiguous or stale evidence',()=>{
 const d=C.newDB();subscription(d);subscription(d,'two',['email-2']);
 const r=P.subscriptionCandidate(d,{company:'Synthetic service',amount:5,status:'active',intent:'indefinite',sources:['email-new']});
 assert.equal(r.draft.currency,'');assert.equal(r.draft.status,'verification');assert.equal(r.draft.intent,'later');assert.equal(r.possibleDuplicate,true);assert.throws(()=>P.saveSubscription(d,r.draft),/Invalid subscription/);
 assert.throws(()=>P.subscriptionCandidate(d,{company:'Synthetic service',sources:['email-1','email-2']}),/multiple subscriptions/);
 assert.throws(()=>P.subscriptionCandidate(d,{id:'one',company:'Synthetic service',sources:['email-1']},{base:'stale'}),/revision changed/);
 assert.throws(()=>P.subscriptionCandidate(d,{id:'missing',company:'Synthetic service',sources:['email-1']}),/unknown or conflicting/);
 assert.throws(()=>P.subscriptionCandidate(d,{company:'Synthetic service',sources:[]}),/source email/);
});
test('cloud readback checks complete payload and refuses ID collisions',()=>{
 const e={id:'x',entity:'profile',key:'profile',base:'',at:'2026-11-26T12:00:00.000Z',source:'manual',payload:{weight:240}},bad={...e,payload:{weight:241}};
 assert.deepEqual(C.mergeRemote([e],[e,e]).events,[e]);assert.throws(()=>C.mergeRemote([e],[bad]),/ID collision/);
 assert.deepEqual([...C.verifyUploaded([e],[e,e])],['x']);assert.throws(()=>C.verifyUploaded([e],[bad]),/contents/);assert.throws(()=>C.verifyUploaded([e],[]),/contents/);assert.throws(()=>C.verifyUploaded([e],[e,bad]),/Conflicting remote/);
 const x={id:'ext',key:'note:test',base:'',at:e.at,payload:{text:'safe'}};
 assert.deepEqual([...C.verifyUploaded([x],[x])],['ext']);assert.throws(()=>C.verifyUploaded([x],[{...x,payload:{text:'changed'}}]),/contents/);
});
test('OAuth requires scope, valid lifetime and token; cancelled callback cannot reconnect',async()=>{
 const scope='https://www.googleapis.com/auth/drive.file',client='test.apps.googleusercontent.com';
 let callback,requestOptions;
 globalThis.window={google:{accounts:{oauth2:{}}}};
 globalThis.google={accounts:{oauth2:{initTokenClient:o=>{callback=o.callback;return {requestAccessToken:opts=>{requestOptions=opts}}}}}};
 const start=async()=>{callback=null;const p=G.authorize(client);await new Promise(r=>setImmediate(r));return {p}};
 try{
  let {p}=await start();callback({access_token:'test',expires_in:3600,scope:'wrong'});await assert.rejects(p,/permission/);
  ({p}=await start());callback({access_token:'test',expires_in:1,scope});await assert.rejects(p,/lifetime/);
  ({p}=await start());callback({expires_in:3600,scope});await assert.rejects(p,/access token/);
  ({p}=await start());assert.equal(requestOptions.prompt,'select_account');await assert.rejects(G.authorize(client),/already open/);G.disconnect();callback({access_token:'test',expires_in:3600,scope});await assert.rejects(p,/cancelled/);assert.equal(G.authorized(),false);
  ({p}=await start());callback({access_token:'test',expires_in:3600,scope});await p;assert.equal(G.authorizationStatus().authorized,true);assert.ok(G.authorizationStatus().expiresAt>Date.now());
  globalThis.fetch=async()=>({ok:false,status:401,statusText:'Unauthorized',json:async()=>({})});
  await assert.rejects(G.readSheet('synthetic'),/401/);assert.equal(G.authorized(),false);
 }finally{G.disconnect();delete globalThis.window;delete globalThis.google;delete globalThis.fetch}
});
