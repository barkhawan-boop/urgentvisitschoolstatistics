import { unzipSync,zipSync,strFromU8,strToU8 } from 'fflate';
import { workbook,cellValue } from './model.js';
const xmlEscape=s=>String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&apos;");
export function patchSheetXml(xml, changes) {
  for(const [ref,value] of Object.entries(changes)) {
    const regex=new RegExp('<c\\b[^>]*\\br="'+ref+'"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)');
    const old=xml.match(regex)?.[0];
    // Keep the existing cell style and all unrelated worksheet XML.
    const style=old?.match(/\bs="(\d+)"/)?.[1];
    const numeric=/^(0|[1-9]\d*)(\.\d+)?$/.test(value) && value.length<15;
    const cell='<c r="'+ref+'"'+(style?' s="'+style+'"':'')+(numeric?'><v>'+value+'</v></c>':' t="inlineStr"><is><t xml:space="preserve">'+xmlEscape(value)+'</t></is></c>');
    if(old) xml=xml.replace(regex,()=>cell);
    else {
      const row=ref.match(/\d+$/)[0];
      const rowRegex=new RegExp('(<row\\b[^>]*\\br="'+row+'"[^>]*>)([\\s\\S]*?)(<\\/row>)');
      if(!rowRegex.test(xml))throw new Error('Template row missing: '+ref);
      xml=xml.replace(rowRegex,(_,open,body,close)=>{
        const cells=[...body.matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g)];
        const col=r=>[...r.replace(/\d/g,'')].reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0);
        const next=cells.find(c=>col(c[1])>col(ref));
        return open+(next?body.slice(0,next.index)+cell+body.slice(next.index):body+cell)+close;
      });
    }
  }
  return xml;
}
export function exportWorkbook(template,record) {
  const files=unzipSync(new Uint8Array(template));
  for(const [i,sheet] of workbook.sheets.entries()) {
    const path='xl/worksheets/sheet'+(i+1)+'.xml';
    const changes={};
    for(const cell of sheet.cells) {
      const value=cellValue(sheet,cell,record);
      if(value!==cell.text)changes[cell.ref]=value;
    }
    files[path]=strToU8(patchSheetXml(strFromU8(files[path]),changes));
  }
  return zipSync(files,{level:6});
}
export function download(data,name,type) {
  const url=URL.createObjectURL(new Blob([data],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export async function downloadExcel(record) {
  const response=await fetch('/template.xlsx');if(!response.ok)throw new Error('Could not load the Excel template.');
  const bytes=exportWorkbook(await response.arrayBuffer(),record);
  download(bytes,record.name.replace(/[<>:"/\\|?*]/g,'-')+'-'+record.year+'.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
export function sheetTable(sheet,record) {
  const table=document.createElement('table');table.className='original-sheet';table.dir='rtl';
  table.style.width=sheet.widths.reduce((a,b)=>a+b,0)+'px';
  const cols=document.createElement('colgroup');
  sheet.widths.forEach(w=>{const col=document.createElement('col');col.style.width=w+'px';cols.append(col);});table.append(cols);
  const body=document.createElement('tbody');
  for(let r=1;r<=sheet.rows;r++){
    const tr=document.createElement('tr');tr.style.height=sheet.heights[r-1]+'pt';
    for(const cell of sheet.cells.filter(c=>c.row===r)) {
      const td=document.createElement('td');td.rowSpan=cell.rs;td.colSpan=cell.cs;
      const box=document.createElement('div');box.textContent=cellValue(sheet,cell,record);
      Object.assign(td.style,{fontFamily:'"'+cell.font+'", Arial, sans-serif',fontSize:cell.size+'pt',fontWeight:cell.bold?'700':'400',color:cell.color,backgroundColor:cell.fill,textAlign:['left','right','center','justify'].includes(cell.align)?cell.align:'center',verticalAlign:cell.valign==='center'?'middle':cell.valign});
      for(const [side,border] of Object.entries(cell.borders))td.style['border'+side[0].toUpperCase()+side.slice(1)]=border;
      box.style.whiteSpace=cell.wrap||cell.header?'pre-wrap':'pre-line';
      // Use the source row dimensions; lengthy entered values wrap inside the original cells.
      td.append(box);tr.append(td);
    }
    body.append(tr);
  }
  table.append(body);return table;
}
export function printSheets(record,onlyId) {
  document.getElementById('print-root')?.remove();
  const root=document.createElement('div');root.id='print-root';
  for(const s of workbook.sheets.filter(s=>!onlyId||s.id===onlyId)){
    const page=document.createElement('section');page.className='print-page '+s.orientation;
    const table=sheetTable(s,record);
    const width=s.widths.reduce((a,b)=>a+b,0);
    const available=(s.orientation==='portrait'?210:297)*96/25.4-32;
    table.style.zoom=Math.min(1,available/width);
    page.append(table);root.append(page);
  }
  // Measure the real fallback-font layout before printing, then fit both axes.
  Object.assign(root.style,{display:'block',position:'absolute',left:'-100000px',top:'0'});
  document.body.append(root);
  for(const page of root.children){
    const table=page.querySelector('table');table.style.zoom=1;
    const landscape=page.classList.contains('landscape');
    const availableWidth=((landscape?297:210)-8)*96/25.4;
    const availableHeight=((landscape?210:297)-8)*96/25.4;
    table.style.zoom=Math.min(1,availableWidth/table.offsetWidth,availableHeight/(table.offsetHeight+4));
  }
  root.removeAttribute('style');window.print();
}
