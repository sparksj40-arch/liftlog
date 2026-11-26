// Local text recognition only. No image bytes or recognized text leave the browser.
let loading;
const directory=new URL('./ocr-assets/',import.meta.url);
export async function loadEngine(){
  if(globalThis.Tesseract?.createWorker)return globalThis.Tesseract;
  return loading??=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=new URL('tesseract.min.js',directory).href;
    script.onload=()=>globalThis.Tesseract?.createWorker?resolve(globalThis.Tesseract):reject(Error('Local OCR engine did not initialize'));
    script.onerror=()=>{script.remove();reject(Error('Local OCR assets are not installed. Use Samsung text recognition or paste text.'))};
    document.head.append(script);
  }).catch(err=>{loading=null;throw err});
}
export async function recognizePhoto(file,{engine=loadEngine,progress=()=>{}}={}){
  if(!file||typeof file.type!=='string'||!file.type.startsWith('image/')||!Number.isFinite(file.size)||file.size<=0||file.size>25*1024*1024)throw Error('Select an image up to 25 MiB');
  let worker,timeout,aborted=false;
  const work=async()=>{
    const t=await engine();
    if(aborted)throw Error('Recognition timed out');
    worker=await t.createWorker('eng',1,{workerPath:new URL('worker.min.js',directory).href,corePath:new URL('core/',directory).href,langPath:new URL('lang/',directory).href,workerBlobURL:false,logger:m=>{if(!aborted)progress(m.status||'Recognizing text',Number.isFinite(m.progress)?m.progress:null)}});
    if(aborted){await worker.terminate();worker=null;throw Error('Recognition timed out')}
    const result=await worker.recognize(file),text=String(result?.data?.text??'').trim();
    if(!text)throw Error('No text detected. Try a clearer photo or paste text manually.');
    if(text.length>100000)throw Error('Recognized text is too long. Split the image.');
    return text;
  };
  try{return await Promise.race([work(),new Promise((_,reject)=>{timeout=setTimeout(()=>{aborted=true;reject(Error('Recognition timed out. Try a smaller image.'))},120000)})])}
  finally{clearTimeout(timeout);aborted=true;if(worker){const w=worker;worker=null;await w.terminate().catch(()=>{})}}
}
