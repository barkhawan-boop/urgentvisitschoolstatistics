import { workbook,defaultYear,validateData,cellValue,columnLabel,sumRow } from './model.js';
import { downloadExcel,download,printSheets,sheetTable } from './export.js';
const $=s=>document.querySelector(s), app=$('#app'), KEY='utvt-schools-v1';
const english=['Administration','Teaching staff','Staff shortage & surplus','Employees','Students & classes','Teachers on leave','Visiting teachers','Visiting teacher summary'];
let records=[],active=null,sheetIndex=0,timer,queue=Promise.resolve(),storageError=false;
try{records=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(records))throw Error();}catch{storageError=true;}
function el(tag,attrs={},...children){const e=document.createElement(tag);for(const [k,v]of Object.entries(attrs)){if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(k==='text')e.textContent=v;else e.setAttribute(k,v);}children.flat().forEach(c=>e.append(typeof c==='string'?document.createTextNode(c):c));return e;}
function button(text,fn,cls='secondary'){return el('button',{type:'button',class:cls,onclick:fn},text);}
function toast(message,error=false){const n=$('#notice');n.textContent=message;n.className=error?'show error':'show';clearTimeout(n.timer);n.timer=setTimeout(()=>n.className='',6500);}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(records));storageError=false;return true;}catch{storageError=true;toast('Storage is full or disabled. Download a backup before closing.',true);return false;}}
function data(r){return {name:r.name,year:r.year,sheets:r.sheets,completed:r.completed};}
function stateText(r){if(storageError)return 'Local storage unavailable — download backup';if(r.conflict)return 'Cloud conflict — restore before saving';if(r.saving)return 'Saving to cloud…';if(r.dirty)return 'Draft on this device · بەم ئامێرە پاشەکەوت کرا';return r.revision?'Saved to cloud · لە هەور پاشەکەوت کرا':'Draft on this device';}
function status(){const s=$('#save-state');if(s&&active){s.textContent=stateText(active);s.classList.toggle('pending',!!active.dirty);}}
function schedule(){if(!active)return;active.dirty=true;active.localUpdated=new Date().toISOString();persist();status();clearTimeout(timer);const r=active;timer=setTimeout(()=>sync(r),1200);}
function sync(r){
  queue=queue.catch(()=>{}).then(async()=>{
    if(!r.dirty)return true;if(r.conflict)return false;
    const snapshot=JSON.stringify(data(r));r.saving=true;status();
    try{
      const response=await fetch('/api/schools/'+r.id,{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+r.token},body:JSON.stringify({data:JSON.parse(snapshot),revision:r.revision||0})});
      const result=await response.json();
      if(!response.ok){if(response.status===409)r.conflict=true;throw Error(result.error||'Cloud save failed.');}
      r.revision=result.revision;r.updatedAt=result.updatedAt;r.dirty=JSON.stringify(data(r))!==snapshot;r.error=null;
      return true;
    }catch(e){r.error=e.message;return false;}finally{r.saving=false;persist();status();}
  });return queue;
}
function recovery(r){return r.id+'.'+r.token;}
function modal(...children){$('#dialog-content').replaceChildren(...children);$('#dialog').showModal();}
function backup(r){download(JSON.stringify({version:1,...r,saving:false},null,2),r.name.replace(/[<>:"/\\|?*]/g,'-')+'-backup.json','application/json');}
function showRecovery(r){modal(el('h2',{},'کۆدی گەڕاندنەوە · Recovery code'),el('p',{},'Keep this code private. It gives access to this school record on another device. Cloud recovery works after a successful cloud save.'),el('textarea',{class:'recovery',readonly:'',dir:'ltr','aria-label':'Recovery code'},recovery(r)),button('Copy code',async()=>{try{await navigator.clipboard.writeText(recovery(r));toast('Copied');}catch{toast('Select and copy the code above.',true);}}),button('Download private backup',()=>backup(r)));}
function goSheet(index){sheetIndex=index;location.hash='sheet/'+active.id+'/'+(index+1);renderSheet();}
function openRecord(r,index=0){active=r;goSheet(index);}
function identityForm(){
  const name=el('input',{required:'',maxlength:'150',placeholder:'ناوی قوتابخانە',autocomplete:'organization','aria-label':'School name'});
  const year=el('input',{required:'',value:defaultYear,dir:'ltr',pattern:'[0-9]{4}-[0-9]{4}','aria-label':'School year'});
  const form=el('form',{class:'create-form'},el('label',{},'ناوی قوتابخانە · School name',name),el('label',{},'ساڵی خوێندن · School year',year),el('button',{type:'submit',class:'primary'},'دەستپێکردن · Create school record'));
  form.addEventListener('submit',e=>{e.preventDefault();try{
    const d=validateData({name:name.value,year:year.value,sheets:{},completed:[]});
    const token=[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');
    const r={...d,id:crypto.randomUUID(),token,revision:0,dirty:true};records.push(r);persist();openRecord(r);sync(r);showRecovery(r);
  }catch(err){toast(err.message,true);}});return form;
}
function home(){
  active=null;clearTimeout(timer);
  const heading=el('div',{class:'page-heading'},el('div',{},el('h1',{},'ئاماری ساڵانەی قوتابخانە')));
  const create=el('section',{class:'panel'},identityForm());
  const list=el('section',{class:'panel record-list'},el('div',{class:'section-heading'},el('h2',{},'تۆمارە پاشەکەوتکراوەکان · Saved records'),el('span',{class:'count'},String(records.length))));
  if(!records.length)list.append(el('p',{class:'empty'},'هێشتا هیچ تۆمارێک نییە. Create a record above.'));
  for(const r of records){const card=el('article',{class:'record'},el('div',{},el('h3',{},r.name),el('span',{class:'muted',dir:'ltr'},r.year+' · '+r.completed.length+'/8 steps saved'),el('p',{class:'record-status'},stateText(r))),button('بەردەوامبوون · Continue',()=>openRecord(r,Math.min(7,r.completed.length)),'primary'));list.append(card);}
  const recoveryInput=el('input',{dir:'ltr',placeholder:'School recovery code','aria-label':'School recovery code',autocomplete:'off'});
  const restore=el('section',{class:'panel'},el('h2',{},'گەڕاندنەوە · Resume on another device'),el('p',{class:'muted'},'Paste the private recovery code, or import a downloaded backup.'),el('div',{class:'restore-line'},recoveryInput,button('Restore from cloud',()=>restoreCloud(recoveryInput.value))));
  const upload=el('input',{type:'file',accept:'.json,application/json','aria-label':'Import school backup'});
  upload.addEventListener('change',async()=>{try{
    const file=upload.files[0];if(!file)return;if(file.size>300000)throw Error('Backup is too large.');
    const r=JSON.parse(await file.text());const valid=validateData(r);
    if(!/^[a-f0-9-]{36}$/.test(r.id)||!/^[a-f0-9]{64}$/.test(r.token))throw Error('Invalid backup.');
    if(records.some(x=>x.id===r.id))throw Error('This record is already on this device. Export its current backup before restoring a different copy.');
    const restored={...valid,id:r.id,token:r.token,revision:Number.isInteger(r.revision)?r.revision:0,dirty:true};records.push(restored);persist();openRecord(restored);
  }catch(e){toast(e.message,true);}});restore.append(el('label',{class:'upload'},'Import private backup (.json)',upload));
  app.replaceChildren(heading,el('div',{class:'home-grid'},el('div',{},create,list))); 
  if(storageError)toast('Browser storage could not be read. Existing data has not been overwritten.',true);
}
async function restoreCloud(code,force=false){
  const match=code.trim().match(/^([a-f0-9-]{36})\.([a-f0-9]{64})$/);if(!match){toast('Enter the complete recovery code.',true);return;}
  const existing=records.find(r=>r.id===match[1]);
  if(existing?.dirty && !force){modal(el('h2',{},'Unsaved local changes'),el('p',{},'Restoring replaces this device’s draft with the cloud version. Download a backup first if you need to keep these changes.'),button('Download local backup',()=>backup(existing)),button('Replace with cloud copy',()=>{$('#dialog').close();restoreCloud(code,true);}));return;}
  try{
    const response=await fetch('/api/schools/'+match[1],{headers:{Authorization:'Bearer '+match[2]}});
    const result=await response.json();if(!response.ok)throw Error(result.error);
    const r={...validateData(result.data),id:match[1],token:match[2],revision:result.revision,updatedAt:result.updatedAt,dirty:false};
    records=records.filter(x=>x.id!==r.id);records.push(r);persist();$('#dialog').close();openRecord(r);
  }catch(e){toast(e.message,true);}
}
function setField(ref,value){const id=workbook.sheets[sheetIndex].id;(active.sheets[id]??={})[ref]=value;if(active.completed.includes(id))active.completed=active.completed.filter(x=>x!==id);schedule();}
function numericField(s,c){
  if(s.id==='5')return true;
  if(s.id==='3')return c.col>=3&&c.col<=7;
  if(s.id==='7')return (c.row>=7&&c.col>=4&&c.col<=6)||['C4','G3','G4'].includes(c.ref);
  if(s.id==='8')return c.col>=3&&c.col<=5;
  return (s.id==='2'&&[4,18].includes(c.col))||(s.id==='4'&&c.col===16);
}
function field(sheet,cell){
  const label=columnLabel(sheet,cell),isNumber=numericField(sheet,cell);
  const input=el('input',{value:cellValue(sheet,cell,active),'data-ref':cell.ref,'aria-label':label+' · '+cell.ref,maxlength:'500',type:isNumber?'number':'text',...(isNumber?{min:'0',step:'1',inputmode:'numeric'}:{})});
  input.addEventListener('input',()=>{setField(cell.ref,input.value);input.setCustomValidity(isNumber&&input.value&&!/^\d+$/.test(input.value)?'Enter a whole number, zero or greater.':'');const details=input.closest('details');if(details && sheet.id!=='3')updateRowTitle(details,sheet,cell.row);});
  return el('label',{class:'field'},el('span',{},label),input,el('small',{class:'cell-ref',dir:'ltr'},cell.ref));
}
function updateRowTitle(details,sheet,row){
  const fields=sheet.cells.filter(c=>c.editable&&c.row===row),count=fields.filter(c=>cellValue(sheet,c,active)!=='').length;
  const name=fields.find(c=>c.col===2),value=name?cellValue(sheet,name,active):'';
  const title=details.querySelector('.row-title');title.textContent=value||'تۆمار '+(row-firstRow(sheet)+1)+' · Record '+(row-firstRow(sheet)+1);
  details.querySelector('.row-count').textContent=count+' / '+fields.length;
}
function firstRow(sheet){return Math.min(...sheet.cells.filter(c=>c.editable).map(c=>c.row));}
function renderSheet(){
  const r=active,s=workbook.sheets[sheetIndex];if(!r)return home();
  const nav=el('nav',{class:'steps','aria-label':'Worksheet pages'});
  workbook.sheets.forEach((sheet,i)=>nav.append(button('',()=>goSheet(i),'step '+(i===sheetIndex?'active':'')).appendChild(el('span',{},el('b',{class:'step-num'},r.completed.includes(sheet.id)?'✓':sheet.id),el('span',{},sheet.name,el('small',{},english[i])))).parentElement));
  const heading=el('div',{class:'page-heading compact'},el('div',{},el('p',{class:'eyebrow',dir:'ltr'},r.year+' / '+String(sheetIndex+1).padStart(2,'0')+' OF 08'),el('h1',{},s.name),el('p',{class:'muted'},english[sheetIndex]+' · '+r.name)),el('div',{class:'heading-actions'},button('چاپ و Excel · Print & export',()=>exportDialog(r))));
  const tools=el('div',{class:'save-bar'},el('span',{id:'save-state',role:'status'},stateText(r)),button('پاشەکەوتکردن · Save now',()=>saveStep(false),'primary'));
  const form=el('form',{id:'sheet-form',novalidate:''});form.addEventListener('submit',e=>e.preventDefault());
  const headers=s.cells.filter(c=>c.header);
  if(headers.length){
    const block=el('details',{class:'panel header-fields',...(sheetIndex===0?{open:''}:{})},el('summary',{},'زانیاریی سەرەوەی فۆرم · School details on this sheet'));
    block.append(el('p',{class:'muted'},'Fill the dotted spaces in the original heading. The school name and reporting year are already included.'));
    headers.forEach(c=>{const input=el('textarea',{rows:c.ref==='A2'?'9':'3',maxlength:'6000','data-ref':c.ref,'aria-label':'Original heading '+c.ref},cellValue(s,c,r));input.addEventListener('input',()=>setField(c.ref,input.value));block.append(el('label',{class:'header-label'},c.ref,input));});form.append(block);
  }
  const inputs=s.cells.filter(c=>c.editable),rows=[...new Set(inputs.map(c=>c.row))];
  form.append(el('div',{class:'section-heading'},el('h2',{},s.id==='5'?'قوتابی و هۆبەکان · Student and class counts':'خانەکانی فۆرم · Form entries'),el('span',{class:'muted'},'Blank = not entered · 0 = zero')));
  rows.forEach((row,i)=>{
    const cells=inputs.filter(c=>c.row===row);
    if(s.id==='5'){
      const label=s.cells.find(c=>c.row===row&&c.col===2)?.text||'';
      const section=s.cells.filter(c=>c.col===2&&c.cs>1&&c.row<row).at(-1)?.text||'';
      const panel=el('section',{class:'panel count-panel'},el('h3',{},section),el('div',{class:'section-heading'},el('h3',{},label),button('Calculate row totals',()=>calculateCounts(s,row))),el('div',{class:'fields'},cells.map(c=>field(s,c))));form.append(panel);
    }else{
      const item=el('details',{class:'entry',...(i===0?{open:''}:{})},el('summary',{},el('span',{class:'row-index'},String(i+1).padStart(2,'0')),el('span',{class:'row-title'},''),el('span',{class:'row-count',dir:'ltr'},'')),el('div',{class:'fields'},cells.map(c=>field(s,c))));
      if(s.id==='3'){const subject=s.cells.find(c=>c.col===2&&c.row===row)?.text||(row===24?'كۆی گشتی · Total':'');item.querySelector('.row-title').textContent=subject;item.querySelector('.row-count').textContent=cells.filter(c=>cellValue(s,c,r)!=='').length+' / '+cells.length;}
      else updateRowTitle(item,s,row);
      form.append(item);
    }
  });
  const footer=el('div',{class:'step-footer'},button('پێشوو · Previous',()=>sheetIndex?goSheet(sheetIndex-1):(location.hash='home'),'secondary'),el('span',{},(sheetIndex+1)+' / 8'),button(sheetIndex===7?'پاشەکەوتکردنی کۆتایی · Save final step':'پاشەکەوت و دواتر · Save & next',()=>saveStep(true),'primary'));
  app.replaceChildren(heading,el('div',{class:'workspace'},nav,el('div',{class:'worksheet'},tools,form,footer)));
  status();
  if(matchMedia('(max-width:760px)').matches) requestAnimationFrame(()=>document.querySelector('.step.active')?.scrollIntoView({block:'nearest',inline:'center'}));
}
function calculateCounts(s,row){
  const values=active.sheets[s.id]??={};const map={E:['C','D'],H:['F','G'],K:['I','J'],L:['C','F','I'],M:['D','G','J'],N:['C','D','F','G','I','J']};
  const results=Object.fromEntries(Object.entries(map).map(([col,refs])=>[col+row,sumRow(values,refs.map(c=>c+row))]));
  if(Object.values(results).some(v=>v===null)){toast('Enter whole, non-negative counts before calculating totals.',true);return;}
  for(const [ref,value]of Object.entries(results)){setField(ref,value);const input=document.querySelector('[data-ref="'+ref+'"]');if(input)input.value=value;}
  toast('Totals updated. Blank entries are counted as zero when at least one input is present.');
}
async function saveStep(next){
  const form=$('#sheet-form');if(form&&!form.reportValidity())return;
  const r=active,id=workbook.sheets[sheetIndex].id;
  if(!r.completed.includes(id))r.completed.push(id);r.dirty=true;persist();status();
  const ok=await sync(r);
  if(!ok)toast(r.error||'Saved on this device. Cloud save will retry when available.',true);
  else toast('پاشەکەوت کرا · Saved to cloud');
  if(next&&active===r){if(sheetIndex<7)goSheet(sheetIndex+1);else exportDialog(r);}
}
function exportDialog(r){
  modal(el('h2',{},'چاپ و داگرتن · Print & download'),el('p',{},r.name+' · '+r.year),
    el('div',{class:'export-options'},
      button('Download original-format Excel',async()=>{try{persist();await downloadExcel(data(r));toast('Excel downloaded. Open it in Excel and use File → Print.');}catch(e){toast(e.message,true);}},'primary'),
      button('Print current sheet / Save PDF',()=>{persist();$('#dialog').close();printSheets(data(r),workbook.sheets[sheetIndex].id);}),
      button('Print all 8 sheets / Save PDF',()=>{persist();$('#dialog').close();printSheets(data(r));}),
      button('Preview original table layout',()=>{const sheet=workbook.sheets[sheetIndex];modal(el('h2',{},sheet.name),el('div',{class:'preview-scroll'},sheetTable(sheet,data(r))));}),
      button('Download private backup',()=>backup(r))),
    el('p',{class:'print-note'},'For the original Excel formatting and page setup, download the Excel file and print it in Excel with Ali_K_Samik installed. Browser/PDF printing keeps the table structure but may differ in fonts and page breaks. Turn off browser print headers and footers.'),
    el('p',{class:'muted'},stateText(r)));
  if(r.dirty)sync(r);
}
window.addEventListener('online',()=>records.filter(r=>r.dirty).forEach(r=>sync(r)));
window.addEventListener('beforeunload',e=>{if(active?.dirty&&storageError){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',e=>{if(e.key===KEY){toast('A record changed in another tab. Reload before continuing to avoid overwriting it.',true);if(active)active.conflict=true;status();}});
function route(){const match=location.hash.match(/^#sheet\/([a-f0-9-]{36})\/([1-8])$/);if(match){const r=records.find(r=>r.id===match[1]);if(r){active=r;sheetIndex=+match[2]-1;renderSheet();return;}}home();}
$('#home-button').onclick=()=>{if(active?.dirty)sync(active);location.hash='home';};
$('#close-dialog').onclick=()=>$('#dialog').close();
window.addEventListener('hashchange',route);route();
fetch('/api/health').then(r=>{if(r.ok)records.filter(record=>record.dirty&&!record.conflict).forEach(record=>sync(record));else toast('Cloud database is not ready. Drafts save on this device; download a backup before moving devices.',true);}).catch(()=>{});
