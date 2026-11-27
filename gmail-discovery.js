// Direct, read-only Gmail discovery. No server, AI API, refresh token, or scheduled ChatGPT task.
import {prepare} from './cloud.js';
import * as X from './extensions.js';
import * as P from './planner.js';
import * as C from './core.js';
export const SCOPE='https://www.googleapis.com/auth/gmail.readonly';
const ROOT='https://gmail.googleapis.com/gmail/v1/users/me',DAY=86400000,OVERLAP=7*DAY,PAGE=25;
const QUERY='-in:spam -in:trash {subject:subscription subject:renewal subject:trial subject:membership subject:receipt subject:invoice subject:payment subject:billing subject:canceled subject:cancelled subject:renewed "auto-renewing subscription" "automatically renew" "recurring payment" "trial will end" "payment declined" "next billing"}';
let token='',expiry=0,generation=0,authorizing=false,account='';
const tokenValid=()=>!!token&&Date.now()<expiry;
export const authorized=()=>tokenValid()&&!!account;
export const authorizationStatus=()=>({authorized:authorized(),authorizing,account:authorized()?account:''});
export const disconnect=()=>{generation++;token='';expiry=0;account='';authorizing=false};
export function state(db){return X.initExt(db).gmail??={enabled:false,account:'',pending:[],seen:[],lastSuccess:null,recent:null,history:null,historyDone:false}}
export function reset(db){disconnect();delete X.initExt(db).gmail;return state(db)}
export function due(db,now=Date.now()){let s=state(db);return s.enabled&&(!s.lastSuccess||now-Date.parse(s.lastSuccess)>=DAY||!!s.recent)}
async function api(path){
 if(!tokenValid())throw Error('Reconnect Gmail; authorization expired');
 if(!/^\/(?:profile|messages(?:\/[A-Za-z0-9_-]+)?(?:\?|$))/.test(path))throw Error('Unexpected Gmail resource');
 const used=token;
 let r=await fetch(ROOT+path,{method:'GET',headers:{Authorization:'Bearer '+used},signal:AbortSignal.timeout(25000),cache:'no-store',redirect:'error'});
 if(r.status===401&&token===used)disconnect();
 if(!r.ok){let data=await r.json().catch(()=>({}));throw Error('Gmail '+r.status+': '+(data.error?.message||r.statusText))}
 if(used!==token)throw Error('Gmail authorization changed during request');
 return r.json()
}
export async function authorize(clientId,expected=''){
 if(!clientId?.endsWith('.apps.googleusercontent.com'))throw Error('Configure Google OAuth client ID in Settings first');
 if(authorizing)throw Error('Gmail authorization already open');
 disconnect();let attempt=++generation;authorizing=true;
 try{
 await prepare();if(attempt!==generation)throw Error('Gmail authorization cancelled');
 await new Promise((resolve,reject)=>{
  let c=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:SCOPE,include_granted_scopes:false,callback:r=>{
   if(attempt!==generation)return reject(Error('Gmail authorization cancelled'));
   if(r.error||!r.access_token)return reject(Error(r.error||'Missing Gmail access token'));
   if(!String(r.scope||'').split(' ').includes(SCOPE))return reject(Error('Read-only Gmail permission not granted'));
   const seconds=Number(r.expires_in);if(!Number.isFinite(seconds)||seconds<=60)return reject(Error('Invalid Gmail authorization lifetime'));
   token=r.access_token;expiry=Date.now()+(seconds-60)*1000;resolve()
  },error_callback:r=>reject(Error(r.type||'Gmail consent cancelled'))});
  c.requestAccessToken({prompt:'select_account',...(expected?{login_hint:expected}:{})});
 });
 const profile=await api('/profile');
 if(attempt!==generation)throw Error('Gmail authorization cancelled');
 const address=String(profile.emailAddress||'').toLowerCase();
 if(!/^[^\s@]+@[^\s@]+$/.test(address))throw Error('Gmail account could not be verified');
 if(expected&&address!==expected.toLowerCase())throw Error('Different Gmail account selected. Reset discovery before changing accounts.');
 account=address;return address;
 }catch(e){if(attempt===generation)disconnect();throw e}finally{if(attempt===generation)authorizing=false}
}
const safeId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(id);
const header=(m,k)=>String(m.payload?.headers?.find(h=>h.name.toLowerCase()===k)?.value||'').trim();
function decode(data){if(typeof data!=='string'||data.length>400000)return '';try{return new TextDecoder().decode(Uint8Array.from(atob(data.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)))}catch{return ''}}
function htmlText(s){return s.replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<!--[\s\S]*?-->/g,' ').replace(/<(?:br|\/p|\/div|\/tr|\/li|\/td|\/h[1-6])\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|quot|apos|lt|gt|#39|#160);/gi,x=>({'&nbsp;':' ','&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&#39;':"'",'&#160;':' '})[x.toLowerCase()]||' ')}
export function messageText(m){let plain=[],html=[];function walk(p,depth=0){if(!p||depth>12||p.filename||p.mimeType==='message/rfc822')return;if(p.mimeType==='text/plain')plain.push(decode(p.body?.data));else if(p.mimeType==='text/html')html.push(htmlText(decode(p.body?.data)));for(let x of p.parts||[])walk(x,depth+1)}walk(m.payload);return (plain.filter(Boolean).join('\n')||html.filter(Boolean).join('\n')||String(m.snippet||'')).slice(0,60000).replace(/\u00a0/g,' ')}
const months='January February March April May June July August September October November December'.split(' ');
const dates='(?:20\\d{2}-\\d{2}-\\d{2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?\\s+\\d{1,2},?\\s+20\\d{2})';
function iso(s){if(!s)return '';if(C.isDate(s))return s;let m=s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(20\d{2})$/);if(!m)return '';let month=months.findIndex(x=>x.toLowerCase().startsWith(m[1].toLowerCase()));if(month<0)return '';let d=m[3]+'-'+String(month+1).padStart(2,'0')+'-'+m[2].padStart(2,'0');return C.isDate(d)?d:''}
const dateAfter=(s,words)=>iso(s.match(new RegExp('(?:'+words+')\\s*(?:(?:on|by|before|is|:|at)\\s*){0,3}('+dates+')','i'))?.[1]);
const clean=(s,max=180)=>String(s||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
function price(s){
 let r=s.match(/(?:\b(USD|EUR|GBP|CAD|AUD)\s*|([$€£])\s*)(\d{1,6}(?:[.,]\d{2})?)\s*(?:(USD|EUR|GBP|CAD|AUD)\s*)?(?:\/|per|every|each)\s*(?:(\d+)\s*)?(weeks?|months?|years?|quarters?)/i);
 if(!r)return {amount:null,currency:'',frequency:'unknown',display:''};
 let n=Number(r[3].replace(',','.')),count=Number(r[5]||1),unit=r[6].toLowerCase(),frequency='other';
 if(count===1)frequency=unit.startsWith('week')?'weekly':unit.startsWith('month')?'monthly':unit.startsWith('year')?'annual':'quarterly';
 if(count===3&&unit.startsWith('month'))frequency='quarterly';if(count===12&&unit.startsWith('month'))frequency='annual';
 return {amount:Number.isFinite(n)?n:null,currency:(r[1]||r[4]||({'€':'EUR','£':'GBP'}[r[2]])||'').toUpperCase(),frequency,display:clean(r[0],70)}
}
export function candidate(m){
 if(!safeId(m.id))return null;
 let subject=header(m,'subject'),from=header(m,'from'),body=messageText(m),t=(subject+'\n'+body).replace(/\s+/g,' ');
 if(!subject||!from||!body)return null;
 // Do not treat an offer, newsletter, cancellation of an order or non-subscription payment as a subscription.
 if(/(?:^|\b)(?:news alert|job matches|job rundown|murder trial|black friday|cyber deal|you may also like|claim .*free|register now|earn rewards automatically|order canceled|order cancelled|order completed)\b/i.test(subject))return null;
 let trial=/\b(?:you (?:have |just )?(?:signed up for|started|claimed|activated)|thank you for (?:starting|signing up for)|your (?:free )?trial (?:will end|ends|is ending|is running out|has started|will renew))\b/i.test(t)&&/\btrial\b/i.test(t);
 let cancelled=/(?:\b(?:your|the)\b.{0,90}\b(?:subscription|membership)\b.{0,45}\b(?:has been canceled|has been cancelled|will be canceled|will be cancelled|has ended|is canceled|is cancelled|was canceled|was cancelled)|\b(?:subscription|membership) cancellation confirmation\b)/i.test(t);
 let failure=/\b(?:payment (?:was |has been )?(?:declined|failed)|(?:renewal|payment) (?:could not|cannot) be (?:completed|processed)|unable to (?:charge|process your payment))\b/i.test(t)&&/\b(?:subscription|membership|renewal|recurring)\b/i.test(t);
 let change=/\b(?:subscription (?:plan )?price|membership price|price (?:increase|change|update))\b/i.test(subject)&&/\b(?:new price|will (?:increase|change)|effective|price)\b/i.test(body);
 let renew=/\b(?:renewal (?:complete|successful|confirmation)|subscription (?:renewed|confirmation)|membership (?:renewed|confirmation)|(?:your|the) (?:subscription|membership) (?:has been renewed|will renew|renews|is active)|you (?:have )?(?:subscribed|signed up for a subscription)|auto-renewing subscription|recurring payment (?:receipt|confirmation))\b/i.test(t);
 let ending=/\b(?:subscription|membership) (?:benefits )?(?:are |is )?ending soon\b/i.test(subject);
 if(!trial&&!cancelled&&!failure&&!change&&!renew&&!ending)return null;
 let company=clean(from.replace(/<[^>]+>/g,'').replace(/^["']|["']$/g,''))||clean(from);
 if(company.includes('@'))company=company.split('@')[1]||company;
 let description=clean(subject),status=failure?'payment failure':cancelled?'cancelled':ending?'ending':trial?'trial':change?'price change':'active/renewal evidence';
 let play=/\bGoogle Play\b/i.test(t)&&/\bgoogle\.com\b/i.test(from);
 if(play){const vendor=t.match(/(?:trial )?subscription from (.{1,100}?) on Google Play/i);if(vendor)company=clean(vendor[1]);const product=body.match(/Item\s+Price\s+([^\n]{3,180})\s*\n+\s*(?:[$€£]|USD|EUR|GBP)\s*\d/i);if(product)description=clean(product[1])}
 let p=price(t),trialEnd=dateAfter(t,'(?:your |free )?trial (?:will end|ends|expires|will expire)'),renewal=dateAfter(t,'(?:next (?:renewal|billing date|payment)|(?:subscription|membership) (?:will renew|renews)|automatically (?:renewed|charged))'),deadline=dateAfter(t,'cancel (?:by|before)|cancellation deadline'),start=dateAfter(t,'(?:order date|trial start(?:ed)?|subscription start(?:ed)?)');
 if(trial&&trialEnd&&!renewal&&/automatically charged/i.test(t))renewal=trialEnd;
 if(!company)return null;
 let at=Number(m.internalDate),createdAt=Number.isFinite(at)&&at>0&&at<=8640000000000000?new Date(at).toISOString():new Date().toISOString();
 const payload={company,description,amount:p.amount,currency:p.currency,frequency:p.frequency,status,start,renewal,trialEnd,promoEnd:'',deadline,instructions:play?'Manage in Google Play subscriptions.':'',sources:['gmail:'+m.id]};
 const explanation=clean(status+' · '+subject+(p.display?' · '+p.display:' · recurring amount unknown')+(p.amount!==null&&!p.currency?' · verify currency':'')+(trialEnd?' · trial ends '+trialEnd:'')+(renewal?' · renewal '+renewal:'')+' · verify against original email; no intent inferred.',500);
 return {id:'gmail-'+m.id,createdAt,kind:'subscription',base:null,payload,explanation,approval:'PENDING',local:true,messageId:m.id};
}
function alreadyHandled(db,id){let source='gmail:'+id;return !!X.getExt(db,'decision:gmail-'+id)||P.subscriptions(db).some(s=>(s.sources||[]).some(x=>x===source||x===id||String(x).endsWith('/'+id)))||(X.initExt(db).proposals||[]).some(p=>p.kind==='subscription'&&(p.payload?.sources||[]).some(x=>x===source||x===id||String(x).endsWith('/'+id)))}
export function pending(db){return state(db).pending.filter(p=>safeId(p.messageId)&&!alreadyHandled(db,p.messageId))}
export function emailLink(db,id){if(!safeId(id))return '';let a=state(db).account;return 'https://mail.google.com/mail/u/?authuser='+encodeURIComponent(a)+'#all/'+id}
export async function scan(db,{request=api,now=Date.now(),force=false,maxPages=4,save=async()=>true,progress=()=>{}}={}){
 let s=state(db);if(!s.enabled||!s.account)throw Error('Enable and authorize Gmail discovery first');
 if(request===api&&(!authorized()||account!==s.account))throw Error('Reconnect the same Gmail account first');
 if(!force&&!due(db,now)&&s.historyDone)return {skipped:true};
 if(!Number.isInteger(maxPages)||maxPages<1||maxPages>20)throw Error('Invalid scan page limit');
 let previous=s.lastSuccess?Date.parse(s.lastSuccess):now;
 if(!s.recent&&(force||due(db,now)))s.recent={after:Math.floor(Math.min(now-OVERLAP,previous-OVERLAP)/1000)-1,before:Math.floor(now/1000)+1,token:''};
 if(!s.history&&!s.historyDone)s.history={before:s.recent?.after??Math.floor((now-OVERLAP)/1000),token:''};
 let examined=0,added=0,pages=0,seen=new Set(s.seen);
 s.pending=pending(db);
 async function checkpoint(){s.seen=[...seen].slice(-50000);if(!await save())throw Error('Local save failed; scan checkpoint not verified')}
 while(pages<maxPages&&(s.recent||s.history)&&s.pending.length<300){
  const isRecent=!!s.recent, cursor=isRecent?s.recent:s.history;
  let q=QUERY+' before:'+cursor.before+(isRecent?' after:'+cursor.after:'');
  let params=new URLSearchParams({q,maxResults:String(PAGE),fields:'messages(id),nextPageToken'});
  if(cursor.token)params.set('pageToken',cursor.token);
  let list;
  try{list=await request('/messages?'+params)}catch(e){if(cursor.token&&/\b400\b/.test(e.message)){cursor.token='';await checkpoint();throw Error('Gmail page cursor expired; scan can safely resume from the start')}throw e}
  if(!list||typeof list!=='object'||(list.messages!=null&&!Array.isArray(list.messages)))throw Error('Invalid Gmail list response');
  let ids=[...new Set((list.messages||[]).map(m=>m.id))];if(ids.some(id=>!safeId(id)))throw Error('Invalid Gmail message ID');
  for(let id of ids){
   if(s.pending.length>=300)break;
   if(seen.has(id)||alreadyHandled(db,id)||s.pending.some(p=>p.messageId===id)){seen.add(id);continue}
   let m;
   try{m=await request('/messages/'+encodeURIComponent(id)+'?format=full&fields=id,internalDate,snippet,payload');}catch(e){if(/\b404\b/.test(e.message)){seen.add(id);continue}throw e}
   if(m.id!==id)throw Error('Gmail message identity mismatch');
   let p=candidate(m);examined++;seen.add(id);
   if(p){s.pending.push(p);added++}
  }
  // If queue is full, leave cursor on this page until the user reviews candidates.
  if(s.pending.length<300){
   cursor.token=String(list.nextPageToken||'');
   if(!cursor.token){if(isRecent){s.lastSuccess=new Date((cursor.before-1)*1000).toISOString();s.recent=null}else{s.history=null;s.historyDone=true}}
  }
  pages++;await checkpoint();progress({examined,added,pages,historyDone:s.historyDone,recentDone:!s.recent});
 }
 return {examined,added,pages,recentDone:!s.recent,historyDone:s.historyDone,queueFull:s.pending.length>=300}
}
