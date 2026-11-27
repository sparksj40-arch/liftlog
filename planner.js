import * as C from './core.js';
import * as X from './extensions.js';
export const weekdays=(date=C.dayKey())=>{let out=[];for(let i=0;out.length<8;i++){let d=C.addDays(date,i),w=C.weekday(d);if(w>0&&w<6)out.push(d)}return out};
export const notes=db=>X.extRecords(db,'planner:note:').filter(n=>!n.deleted);
export const projects=db=>X.extRecords(db,'planner:project:').filter(n=>!n.deleted);
export const subscriptions=db=>X.extRecords(db,'subscription:record:');
export const reminders=db=>X.extRecords(db,'planner:reminder:');
export const allDone=n=>n.entries.some(e=>e.kind==='task')&&n.entries.filter(e=>e.kind==='task').every(e=>e.done);
export function archived(n,at=Date.now()){if(n.archived!==null&&n.archived!==undefined)return n.archived;if(n.pinned)return false;if(n.untilComplete&&n.entries.some(e=>e.kind==='task')&&!allDone(n))return false;return at>=Date.parse(n.archiveFrom||n.createdAt)+30*86400000}
export function saveNote(db,n,at=C.now()){if(!n.title?.trim()||!Array.isArray(n.entries)||n.entries.some(e=>!e.id||!['text','task'].includes(e.kind)||typeof e.text!=='string')||new Set(n.entries.map(e=>e.id)).size!==n.entries.length)throw Error('Invalid note');let old=X.getExt(db,'planner:note:'+n.id);let v={...C.clone(n),createdAt:old?.createdAt||at,updatedAt:at};if(!old||(v.untilComplete&&!allDone(old)&&allDone(v))||(v.untilComplete&&!old.untilComplete&&allDone(v)))v.archiveFrom=at;X.saveExt(db,'planner:note:'+v.id,v);return v}
export function reminderActive(db,r){if(r.disabled)return false;let n=notes(db).find(n=>n.id===r.noteId);if(!n)return false;let es=r.entryIds.length?n.entries.filter(e=>r.entryIds.includes(e.id)):n.entries;if(r.entryIds.length&&!es.length)return false;return !(r.untilComplete&&es.some(e=>e.kind==='task')&&es.filter(e=>e.kind==='task').every(e=>e.done))}
export function saveReminder(db,r){if(!notes(db).some(n=>n.id===r.noteId)||!Array.isArray(r.entryIds)||!r.dates.length||r.dates.some(d=>!C.isDate(d))||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)||!Number.isInteger(r.early)||r.early<0||r.early>1440||!['once','daily','weekly','weekdays'].includes(r.repeat))throw Error('Invalid reminder');X.saveExt(db,'planner:reminder:'+r.id,{...r,dates:[...new Set(r.dates)].sort()})}
export function occurs(r,date){return r.dates.some(d=>{if(d===date)return true;if(date<d)return false;if(r.repeat==='daily')return true;if(r.repeat==='weekdays')return C.weekday(date)>0&&C.weekday(date)<6;if(r.repeat==='weekly')return C.weekday(d)===C.weekday(date);return false})}
// Email evidence is not permission to change a user's cancellation decision.
export function subscriptionCandidate(db,payload,{base=null,proposalId=null}={}){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Invalid subscription candidate');
  const textFields=['company','description','currency','frequency','start','renewal','trialEnd','promoEnd','deadline','instructions'];
  if(typeof payload.company!=='string'||!payload.company.trim())throw Error('Candidate needs a company name');
  for(const k of textFields)if(payload[k]!=null&&typeof payload[k]!=='string')throw Error('Invalid candidate '+k);
  if(payload.amount!=null&&(!Number.isFinite(payload.amount)||payload.amount<0))throw Error('Invalid candidate amount');
  if(payload.currency&& !/^[A-Z]{3}$/.test(payload.currency))throw Error('Invalid candidate currency');
  if(payload.frequency&&!['weekly','monthly','quarterly','annual','other','unknown'].includes(payload.frequency))throw Error('Invalid candidate frequency');
  for(const k of ['start','renewal','trialEnd','promoEnd','deadline'])if(payload[k]&&!C.isDate(payload[k]))throw Error('Invalid candidate '+k);
  if(!Array.isArray(payload.sources)||!payload.sources.length||payload.sources.some(s=>typeof s!=='string'||!s.trim()))throw Error('Candidate needs source email references');
  if(payload.id!=null&&(typeof payload.id!=='string'||!payload.id))throw Error('Invalid candidate record ID');
  const sources=[...new Set(payload.sources.map(s=>s.trim()))],all=subscriptions(db);
  const matches=all.filter(s=>s.id===payload.id||(s.sources??[]).some(x=>sources.includes(x)));
  if(matches.length>1)throw Error('Candidate matches multiple subscriptions; review sources before importing');
  const existing=matches[0];
  if(payload.id&&existing?.id!==payload.id)throw Error('Candidate references an unknown or conflicting subscription');
  const current=existing?X.replayExt(X.initExt(db).events).heads.get('subscription:record:'+existing.id)?.id??'':'';
  if(base!==null&&base!==current)throw Error('Subscription revision changed; request a revised candidate');
  const draft=existing?C.clone(existing):{id:C.uid(),company:'',description:'',amount:null,currency:'',frequency:'unknown',status:'verification',intent:'later',start:'',renewal:'',trialEnd:'',promoEnd:'',deadline:'',cancelDate:'',instructions:'',sources:[],reminderDays:[14,7,3,2,1,0]};
  for(const k of textFields){
    const value=payload[k];
    if(typeof value!=='string'||!value.trim()||(k==='frequency'&&value==='unknown'))continue;
    // An uncertain new deadline must not postpone an existing protective cutoff.
    if(k==='deadline'&&draft.deadline&&value>draft.deadline)continue;
    if(existing&&((k==='trialEnd'&&existing.intent==='trial')||(k==='renewal'&&existing.intent==='one-period'))&&draft[k]&&value>draft[k])continue;
    draft[k]=value.trim();
  }
  if(payload.amount!=null&&payload.currency)draft.amount=payload.amount;
  if(!existing&&payload.amount!=null&&!payload.currency)draft.amount=payload.amount;
  if(existing&&payload.currency&&payload.currency!==existing.currency&&payload.amount==null){draft.currency=existing.currency;}
  draft.sources=[...new Set([...(existing?.sources??[]),...sources])];
  delete draft.proposalId;
  if(proposalId)draft.proposalId=proposalId;
  return {draft,base:current,existing:!!existing,possibleDuplicate:!existing&&all.some(s=>normalizeService(s.company)===normalizeService(draft.company)),evidenceStatus:typeof payload.status==='string'?payload.status:'unknown',evidence:C.clone(Object.fromEntries([...textFields,'amount','status'].filter(k=>Object.hasOwn(payload,k)).map(k=>[k,payload[k]])))};
}
export function normalizeService(s){return s.trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
export function saveSubscription(db,s){if(!s.company?.trim()||!['active','trial','cancelled','verification'].includes(s.status)||!['indefinite','trial','one-period','months','date','later'].includes(s.intent)||!['weekly','monthly','quarterly','annual','other','unknown'].includes(s.frequency)||s.amount!==null&&(!Number.isFinite(s.amount)||s.amount<0)||!/^([A-Z]{3})$/.test(s.currency))throw Error('Invalid subscription');for(let k of ['start','renewal','trialEnd','promoEnd','deadline','cancelDate'])if(s[k]&&!C.isDate(s[k]))throw Error('Invalid '+k);let old=X.getExt(db,'subscription:record:'+s.id);let duplicate=subscriptions(db).find(v=>v.id!==s.id&&(v.sources??[]).some(x=>(s.sources??[]).includes(x)));if(duplicate)throw Error('Source email already belongs to '+duplicate.company);let v={...C.clone(s),createdAt:old?.createdAt||C.now(),updatedAt:C.now()};X.saveExt(db,'subscription:record:'+v.id,v);return v}
export function cancellationDate(s){if(s.status==='cancelled'||['indefinite','later'].includes(s.intent))return '';let target=s.cancelDate||(s.intent==='trial'?s.trialEnd:s.intent==='one-period'?s.renewal:'');if(!target)return '';return s.deadline&&s.deadline<target?s.deadline:target}
export function cancellationDue(s,date){let d=cancellationDate(s);if(!d)return false;let days=(Date.parse(d+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000;let offsets=s.reminderDays??[14,7,3,2,1,0];return days<0||offsets.includes(days)}
export function monthlyTotals(records){let totals={};for(let s of records){if(!['active','trial'].includes(s.status)||s.amount===null)continue;let ratio={weekly:52/12,monthly:1,quarterly:1/3,annual:1/12}[s.frequency];if(ratio)totals[s.currency]=(totals[s.currency]||0)+s.amount*ratio}return totals}
export function calendarEntries(db,date){let a=reminders(db).filter(r=>reminderActive(db,r)&&occurs(r,date)).map(r=>({id:r.id,time:r.time,early:r.early,label:'Planner reminder',detail:notes(db).find(n=>n.id===r.noteId)?.title||'',noteId:r.noteId}));for(let s of subscriptions(db))if(cancellationDue(s,date)){a.push({id:'sub-'+s.id,time:'09:15',early:15,label:'Subscription reminder',detail:s.company,subscriptionId:s.id});if(date>=cancellationDate(s))for(let time of ['12:00','15:15','18:00'])a.push({id:'sub-'+s.id+'-'+time,time,early:0,label:'Subscription reminder',detail:s.company,subscriptionId:s.id})}let p=X.measurementPlan(db);if(date>=p.anchor&&C.weekday(date)===p.day&&!X.getExt(db,'assessment:'+date)?.completedAt)a.push({id:'measure-'+date,time:p.time,early:0,label:'Measurement reminder',detail:'Weekly measurement assessment'});return a.sort((a,b)=>a.time.localeCompare(b.time))}
export function dueNotifications(db,at=new Date()){let result=[];for(let date of [C.dayKey(at),C.addDays(C.dayKey(at),1)])for(let e of calendarEntries(db,date)){let due=new Date(date+'T'+e.time+':00');for(let offset of [...new Set([e.early,0])]){let t=due.getTime()-offset*60000;if(at.getTime()>=t&&at.getTime()-t<86400000)result.push({...e,deliveryId:date+'|'+e.id+'|'+e.time+'|'+offset,at:t})}}return result}
export function icsFor(db,date,days=28,base=''){const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Personal Dashboard//Planner//EN','CALSCALE:GREGORIAN'];for(let i=0;i<days;i++){let d=C.addDays(date,i);for(let e of calendarEntries(db,d)){let stamp=d.replaceAll('-','')+'T'+e.time.replace(':','')+'00',url=base?(base+'#'+(e.noteId?'note='+encodeURIComponent(e.noteId):e.subscriptionId?'subscription='+encodeURIComponent(e.subscriptionId):'measurements')):'';lines.push('BEGIN:VEVENT','UID:'+encodeURIComponent(d+'-'+e.id)+'@personal-dashboard','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),'DTSTART:'+stamp,'SUMMARY:'+e.label,...(url?['URL:'+url]:[]),'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Reminder','TRIGGER:-PT0M','END:VALARM',...(e.early?['BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Reminder','TRIGGER:-PT'+e.early+'M','END:VALARM']:[]),'END:VEVENT')}}return lines.concat('END:VCALENDAR','').join('\r\n')}

// Convert pasted/device-recognized text into editable entries, never infer completion from prose.
export function transcriptionEntries(text,mode='mixed',id=C.uid){if(typeof text!=='string'||text.length>100000||!['mixed','text','tasks'].includes(mode))throw Error('Invalid transcription');if(!text.trim())throw Error('Paste some text first');if(mode==='text')return [{id:id(),kind:'text',text:text.replace(/\r\n?/g,'\n'),done:false}];let entries=[],paragraph=[];const flush=()=>{if(paragraph.length&&paragraph.join('\n').trim())entries.push({id:id(),kind:'text',text:paragraph.join('\n'),done:false});paragraph=[]};for(let line of text.replace(/\r\n?/g,'\n').split('\n')){let box=line.match(/^\s*(?:[-*•]\s*)?\[([ xX])\]\s*(.+)$/),bullet=line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/);if(box||bullet||mode==='tasks'&&line.trim()){flush();entries.push({id:id(),kind:'task',text:box?box[2]:bullet?bullet[1]:line,done:!!box&&box[1].toLowerCase()==='x'})}else paragraph.push(line)}flush();if(entries.length>500)throw Error('Too many entries; split the transcription');return entries}
