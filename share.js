// Local-only incoming Android/PWA share queue. No text in URLs or network requests.
const open=()=>new Promise((resolve,reject)=>{let r=indexedDB.open('personal-dashboard-share-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('shares',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
async function tx(mode,fn){let db=await open();try{return await new Promise((resolve,reject)=>{let t=db.transaction('shares',mode),r=fn(t.objectStore('shares'));t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)})}finally{db.close()}}
export function shareRecord(fields,id,at=new Date().toISOString()){let title=String(fields.title||'').trim(),text=String(fields.text||'').trim(),url=String(fields.url||'').trim();if(title.length>500||text.length+url.length>100000)throw Error('Shared content too large');let content=[text,url&&!text.includes(url)?url:''].filter(Boolean).join('\n');if(!content&&!title)throw Error('Nothing to share');return {id,at,title,content:content||title}}
export const saveShare=r=>tx('readwrite',s=>s.put(r));
export const listShares=()=>tx('readonly',s=>s.getAll());
export const removeShare=id=>tx('readwrite',s=>s.delete(id));
export function appendShare(note,r,kind,uid){if(!['text','task'].includes(kind))throw Error('Invalid shared entry type');if((note.shareIds||[]).includes(r.id))return note;return {...note,shareIds:[...(note.shareIds||[]),r.id],entries:[...note.entries,{id:uid,kind,text:r.content,done:false}]}}
