import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../core.js';
import * as X from '../extensions.js';
import * as P from '../planner.js';
import * as G from '../gmail-discovery.js';
const now=Date.parse('2026-11-27T15:00:00Z');
const fixture=(id,subject,body,from='Example Service <billing@example.invalid>')=>({id,internalDate:String(now),payload:{mimeType:'text/plain',headers:[{name:'Subject',value:subject},{name:'From',value:from}],body:{data:Buffer.from(body).toString('base64url')}}});
const trial=fixture('test1','Your Google Play Order Receipt','You have signed up for a trial subscription from Example Labs on Google Play. Your trial will end on Nov 29, 2026. You will be automatically charged the subscription cost (currently $5.99/3 months) at the end of your trial unless canceled.\nOrder date: Nov 22, 2026 8:42 PM EST\nItem\nPrice\nExample Running Pass\n$0.00\nAuto-renewing subscription','Google Play <googleplay-noreply@google.com>');
const renewal=fixture('test2','Subscription renewal confirmation','Your subscription has been renewed. USD 12.00 per month. Next billing date: December 27, 2026.');
const marketing=fixture('test3','Earn rewards automatically when you sign up','Register for a free account. Paid plans automatically renew unless canceled.');
const cancelled=fixture('test4','Your membership has been cancelled','Your membership has been cancelled. USD 9.99 per month.');
const failed=fixture('test5','Payment failed','Your subscription payment was declined. USD 4 per month.');
const dbase=()=>{let d=C.newDB();Object.assign(G.state(d),{enabled:true,account:'synthetic@example.invalid'});return d};
test('Gmail trial extracts explicit period, trial, renewal and start; currency remains unknown for bare dollar sign',()=>{
 let p=G.candidate(trial).payload;
 assert.equal(p.company,'Example Labs');assert.equal(p.description,'Example Running Pass');assert.equal(p.status,'trial');assert.equal(p.amount,5.99);assert.equal(p.frequency,'quarterly');assert.equal(p.currency,'');assert.equal(p.start,'2026-11-22');assert.equal(p.renewal,'2026-11-29');assert.equal(p.trialEnd,'2026-11-29');assert.equal(p.deadline,'');assert.deepEqual(p.sources,['gmail:test1']);assert.equal(p.intent,undefined)
});
test('Gmail renewal, cancellation, failure evidence are distinguished',()=>{
 let p=G.candidate(renewal).payload;assert.equal(p.amount,12);assert.equal(p.currency,'USD');assert.equal(p.renewal,'2026-12-27');assert.equal(p.frequency,'monthly');
 assert.equal(G.candidate(cancelled).payload.status,'cancelled');assert.equal(G.candidate(failed).payload.status,'payment failure');
});
test('Gmail excludes offers, utility stop-order cancellation and unrelated purchases',()=>{
 assert.equal(G.candidate(marketing),null);
 assert.equal(G.candidate(fixture('x','Order Canceled','Your stop service order was canceled. Electricity will remain on.')),null);
 assert.equal(G.candidate(fixture('y','Receipt','Thank you for buying a shirt. $18.00.')),null);
 assert.equal(G.candidate(fixture('z','News alert','The murder trial started yesterday.')),null)
});
test('Gmail strips markup and excludes attachment text',()=>{
 let m=fixture('x','Subscription renewed','');m.payload={mimeType:'multipart/mixed',headers:m.payload.headers,parts:[{mimeType:'text/html',body:{data:Buffer.from('<script>evil()</script><p>Your subscription has been renewed.</p><p>USD 8 per month</p>').toString('base64url')}},{filename:'invoice.txt',mimeType:'text/plain',body:{data:Buffer.from('confidential attachment').toString('base64url')}}]};
 let t=G.messageText(m);assert(!t.includes('evil'));assert(!t.includes('confidential'));assert.equal(G.candidate(m).payload.amount,8)
});
test('Gmail scan pages recent then history, suppresses duplicates and does not save subscriptions',async()=>{
 let d=dbase(),messages={test1:trial,test2:renewal,test3:marketing},calls=[],checks=0;
 const request=async path=>{calls.push(path);if(path.startsWith('/messages?')){let q=new URLSearchParams(path.split('?')[1]);if(q.has('pageToken'))return {messages:[{id:'test1'},{id:'test2'}]};if(q.get('q').includes(' after:'))return {messages:[{id:'test1'},{id:'test3'}],nextPageToken:'more'};return {messages:[{id:'test2'}]}}return messages[path.split('/')[2].split('?')[0]]};
 let a=await G.scan(d,{request,now,maxPages:1,save:async()=>{checks++;return true}});
 assert.equal(a.recentDone,false);assert.equal(G.state(d).lastSuccess,null);assert.equal(G.pending(d).length,1);
 let b=await G.scan(d,{request,now:now+3600000,maxPages:4,save:async()=>{checks++;return true}});
 assert.equal(b.historyDone,true);assert.equal(b.recentDone,true);assert.equal(G.state(d).lastSuccess,new Date(now).toISOString());assert.equal(G.pending(d).length,2);assert.equal(P.subscriptions(d).length,0);assert.equal(X.initExt(d).events.length,0);assert.equal(checks,3);assert.equal(calls.filter(x=>x.startsWith('/messages/test1?')).length,1);
 let n=calls.length;assert.equal((await G.scan(d,{request,now:now+7200000})).skipped,true);assert.equal(calls.length,n);
 X.saveExt(d,'decision:gmail-test1',{status:'rejected',at:new Date(now).toISOString()});assert.equal(G.pending(d).length,1);
 let c=await G.scan(d,{request,now:now+7200000,force:true});assert.equal(c.added,0);assert.equal(G.pending(d).length,1)
});
test('Gmail failed page does not advance successful checkpoint',async()=>{
 let d=dbase(),request=async path=>{if(path.startsWith('/messages?'))return {messages:[{id:'test1'}]};throw Error('Gmail 503')};
 await assert.rejects(G.scan(d,{request,now}),/503/);assert.equal(G.state(d).lastSuccess,null);assert.equal(G.state(d).recent.token,'')
});
test('Gmail candidate must be explicitly reviewed and existing status/intent preserved',()=>{
 let d=dbase(),p=G.candidate(renewal),r=P.subscriptionCandidate(d,p.payload,{proposalId:p.id});assert.equal(r.draft.status,'verification');assert.equal(r.draft.intent,'later');r.draft.status='active';r.draft.intent='indefinite';P.saveSubscription(d,r.draft);
 let next=P.subscriptionCandidate(d,{...G.candidate(cancelled).payload,id:r.draft.id},{proposalId:'gmail-test4'});assert.equal(next.draft.status,'active');assert.equal(next.draft.intent,'indefinite');assert.equal(next.evidenceStatus,'cancelled');assert.equal(P.subscriptions(d).length,1)
});
