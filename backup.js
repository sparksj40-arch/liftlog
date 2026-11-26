import * as C from './core.js';
import * as X from './extensions.js';

const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validId=x=>/^[A-Za-z0-9_-]{1,160}$/.test(x)&&!['__proto__','constructor','prototype'].includes(x);
const image=x=>typeof x==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(x);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function uniqueEvents(events,incoming,label){
  const seen=new Map(),out=[];
  for(const e of [...events,...incoming]){
    if(!obj(e)||typeof e.id!=='string'||!e.id)throw Error('Invalid '+label+' event');
    if(seen.has(e.id)){
      if(!equal(seen.get(e.id),e))throw Error(label+' event ID collision; import stopped without changes');
    }else{seen.set(e.id,e);out.push(C.clone(e))}
  }
  return out;
}

export function prepareImport(current,incoming){
  C.validateDB(incoming);
  if(!incoming.events.length&&!incoming.draft&&!incoming.extension?.events?.length)throw Error('No records to import');
  if(current.draft&&incoming.draft&&!equal(current.draft,incoming.draft))throw Error('Backup contains a different unfinished workout or revision. Finish or export current draft before importing it.');
  if(incoming.extension!=null){
    const x=incoming.extension;
    if(!obj(x)||x.version!==1||!Array.isArray(x.events)||!obj(x.media))throw Error('Invalid extension backup');
    for(const e of x.events)X.encodeExt(e);
    for(const [k,v] of Object.entries(x.media))if(!validId(k)||!image(v))throw Error('Invalid backup photo');
  }
  const next=C.clone(current),ext=X.initExt(next),source=incoming.extension;
  next.events=uniqueEvents(current.events,incoming.events,'Workout');
  if(source){
    ext.events=uniqueEvents(ext.events,source.events,'Extension');
    for(const [k,v] of Object.entries(source.media)){
      if(Object.hasOwn(ext.media,k)&&ext.media[k]!==v)throw Error('Photo ID collision; import stopped without changes');
      if(!Object.hasOwn(ext.media,k))ext.media[k]=v;
    }
  }
  next.legacy??=incoming.legacy??null;
  next.legacyPreferences??=incoming.legacyPreferences;
  if(!next.draft)next.draft=C.clone(incoming.draft??null);
  for(const k of Object.keys(C.newDB().prefs)){
    if(Object.hasOwn(incoming.prefs,k))next.prefs[k]=C.clone(incoming.prefs[k]);
  }
  if(Array.isArray(incoming.prefs.dashboardShortcuts))next.prefs.dashboardShortcuts=incoming.prefs.dashboardShortcuts.filter(k=>typeof k==='string');
  if(incoming.inbox!=null&&!Array.isArray(incoming.inbox))throw Error('Invalid backup inbox');
  next.inbox??=[];
  for(const p of incoming.inbox??[]){
    C.inboxItem([p.id,p.createdAt,p.kind,p.base,JSON.stringify(p.payload),p.explanation,p.approval]);
    if(!next.inbox.some(x=>x.id===p.id))next.inbox.push(C.clone(p));
  }
  // Never import cloud identifiers, authorization, remote confirmations or notification delivery state.
  C.validateDB(next);
  return {next,added:next.events.length-current.events.length,extensionAdded:ext.events.length-(current.extension?.events.length??0),conflicts:C.replay(next.events).conflicts.length+X.replayExt(ext.events).conflicts.length};
}
