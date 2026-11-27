import * as C from '../core.js';
import * as X from '../extensions.js';
import * as P from '../planner.js';
import * as G from '../cloud.js';
import * as GC from '../calendar-sync.js';
import * as M from '../media-backup.js';
import * as GD from '../gmail-discovery.js';
import {recognizePhoto} from '../ocr.js';
const $=id=>document.getElementById(id),results=$('result'),buttons=['sheets','calendar','ocr','gmail'].map($);
const log=(text)=>{results.textContent+=text+'\n';};
const require=(ok,message)=>{if(!ok)throw Error(message)};
const local=['localhost','127.0.0.1'].includes(location.hostname)&&location.port==='8765';
const stamp=new Date().toISOString(),label='LIFTLOG TEST ONLY '+stamp;
let busy=false;
const client=()=>$('client').value.trim();
async function run(button,fn){
 if(!local||busy)return;
 busy=true;buttons.forEach(b=>b.disabled=true);
 try{await fn();log('PASS '+button.textContent)}catch(e){log('FAIL '+button.textContent+': '+e.message)}finally{busy=false;buttons.forEach(b=>b.disabled=false)}
}
function image(){
 const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=240;
 const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1000,240);ctx.fillStyle='black';ctx.font='bold 60px sans-serif';ctx.fillText('BUY FURNACE FILTERS',30,95);ctx.fillText('WASH THE CAR',30,185);return canvas;
}
async function sheetDrive(){
 await G.authorize(client());log('PASS Sheets/Drive consent');
 const id=await G.createSheet(label);log('Created test spreadsheet: https://docs.google.com/spreadsheets/d/'+id+'/edit');
 let d=C.newDB(),profile=C.eventFor(d.events,'profile','profile',{synthetic:true,weight:240});d.events.push(profile);
 await G.ensureExtensionTabs(id);await G.appendEvents(id,d.events);
 P.saveNote(d,{id:'synthetic-note',title:'Synthetic note',entries:[{id:'task',kind:'task',text:'Synthetic task',done:false}],untilComplete:true,archived:null});
 await G.appendExtension(id,X.initExt(d).events);
 const first=await G.readSheet(id),ext=await G.readExtension(id);
 C.verifyUploaded(d.events,first.remote);C.verifyUploaded(X.initExt(d).events,ext.remote);
 require(!first.errors.length&&!ext.errors.length,'Unexpected inbox validation errors');
 let second=C.newDB();Object.assign(second,C.mergeRemote(second.events,first.remote));X.mergeRemoteExt(second,ext.remote);
 require(P.notes(second)[0]?.title==='Synthetic note','Clean database recovery mismatch');
 require(second.events.length===1,'Unexpected event count');
 await G.ensureExtensionTabs(id);const again=await G.readSheet(id);require(again.remote.length===1,'Unexpected duplicate events');
 log('PASS real Sheets headers, append, exact readback, clean database merge');
 X.initExt(d).media['synthetic-photo']=image().toDataURL('image/png');
 const snap=M.snapshot(d);
 const req=(path,method,data,upload)=>G.driveRequest(path,method,path==='/files?fields=id'&&method==='POST'?{...data,name:label+' photo backup.json'}:data,upload);
 const file=await M.createBackup(req,snap);log('Created test photo backup: https://drive.google.com/open?id='+file);
 const restored=await M.restoreBackup(G.driveRequest,file);
 require(M.mergeSnapshot(second,restored)===1,'Photo restore missing');require(M.mergeSnapshot(second,restored)===0,'Duplicate restore');require(X.initExt(second).media['synthetic-photo']===snap.media['synthetic-photo'],'Photo bytes differ');
 log('PASS real private Drive upload, owner/permission checks, readback and restore');
}
async function calendar(){
 await GC.authorize(client());log('PASS Calendar consent');
 const zone='America/Detroit',start=C.dayKey(),date=C.addDays(start,1),base=location.origin+'/',id=await GC.createCalendar(zone,label);
 log('Created test calendar: '+label+' ('+id+')');
 const d=C.newDB();P.saveNote(d,{id:'synthetic-note',title:'Synthetic task',entries:[{id:'task',kind:'task',text:'Test only',done:false}],untilComplete:true,archived:null});
 P.saveReminder(d,{id:'synthetic-reminder',noteId:'synthetic-note',entryIds:['task'],dates:[date],time:'09:15',early:15,repeat:'once',untilComplete:true});
 const a=await GC.mirror(id,d,start,base,zone);require(a.created>0,'No calendar events created');
 const b=await GC.mirror(id,d,start,base,zone);require(b.created===0&&b.updated===0&&b.removed===0,'Calendar not idempotent: '+JSON.stringify(b));
 let note=P.notes(d)[0];note.entries[0].done=true;P.saveNote(d,note);
 const c=await GC.mirror(id,d,start,base,zone);require(c.removed===1,'Completion did not remove exactly one reminder');
 const final=await GC.mirror(id,d,start,base,zone);require(final.created===0&&final.updated===0&&final.removed===0,'Calendar final reconciliation not stable');
 log('PASS real Calendar create, readback, idempotence, task completion cancellation');
 log('Delete the test calendar after inspection; synthetic weekly measurement events remain until deleted.');
}
async function ocr(){
 const blob=await new Promise(resolve=>image().toBlob(resolve,'image/png'));
 const text=await recognizePhoto(blob,{progress:(s,p)=>$('ready').textContent=s+(p===null?'':' '+Math.round(p*100)+'%')});
 require(/BUY\s+FURNACE\s+FILTERS/i.test(text)&&/WASH\s+THE\s+CAR/i.test(text),'OCR text mismatch: '+text);
 log('PASS recognized synthetic printed English text locally');
 $('ready').textContent='Ready';
}
async function gmail(){
 const d=C.newDB(),s=GD.state(d);
 try{
  s.account=await GD.authorize(client());s.enabled=true;log('PASS Gmail read-only consent and verified mailbox');
  const a=await GD.scan(d,{force:true,maxPages:1});
  require(a.pages===1,'No Gmail search page checked');
  require(P.subscriptions(d).length===0&&X.initExt(d).events.length===0,'Unreviewed email unexpectedly became a record');
  log('PASS real Gmail list and read: '+a.examined+' examined, '+a.added+' candidate(s); no saved records or email changes');
  log('This check intentionally reads at most one page and discards the local test state.');
 }finally{GD.disconnect()}
}
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(results.textContent);$('ready').textContent='Copied results'}catch{alert('Select and copy the result text manually.')}};
if(!local){$('ready').textContent='Blocked: use the isolated localhost server on port 8765.'}
else{
 $('sheets').onclick=()=>run($('sheets'),sheetDrive);$('calendar').onclick=()=>run($('calendar'),calendar);$('ocr').onclick=()=>run($('ocr'),ocr);$('gmail').onclick=()=>run($('gmail'),gmail);
 $('ocr').disabled=false;
 G.prepare().then(()=>{$('ready').textContent='Ready for Google consent';$('sheets').disabled=false;$('calendar').disabled=false;$('gmail').disabled=false}).catch(e=>{log('Google sign-in library unavailable: '+e.message);$('ready').textContent='OCR test remains available; reload to retry Google'});
}
