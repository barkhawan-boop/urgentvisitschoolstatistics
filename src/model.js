import workbook from './workbook.json' with { type: 'json' };
export { workbook };
export const defaultYear = '2025-2026';
export const editable = Object.fromEntries(workbook.sheets.map(s => [s.id, new Set(s.cells.filter(c => c.editable || c.header).map(c => c.ref))]));
export function validateData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid record');
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 150) throw new Error('School name is required (maximum 150 characters).');
  if (typeof data.year !== 'string' || !/^\d{4}-\d{4}$/.test(data.year) || +data.year.slice(5) !== +data.year.slice(0,4)+1) throw new Error('Use a school year such as 2025-2026.');
  if (!data.sheets || typeof data.sheets !== 'object' || Array.isArray(data.sheets)) throw new Error('Invalid sheets');
  for (const [id, values] of Object.entries(data.sheets)) {
    if (!editable[id] || !values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Unknown sheet');
    for (const [ref, value] of Object.entries(values)) {
      if (!editable[id].has(ref) || typeof value !== 'string' || value.length > (workbook.sheets[+id-1].cells.find(c=>c.ref===ref)?.header ? 6000 : 500)) throw new Error('Invalid field: '+id+'/'+ref);
    }
  }
  if (!Array.isArray(data.completed) || data.completed.some(id=>!editable[id])) throw new Error('Invalid saved steps');
  return { name: data.name.trim(), year: data.year, sheets: data.sheets, completed: [...new Set(data.completed)] };
}
export function initialHeader(sheet, cell, record) {
  let text=cell.text.replaceAll('2025-2026',record.year);
  if (sheet.id==='1' && cell.ref==='A2') text=text.replace(/(ناوى قوتابخانة\s*[:/]\s*)\.{2,}/,(_,label)=>label+record.name);
  if (sheet.id==='2' && cell.ref==='B1') text=text.replace('ناوى قوتابخانة/','ناوى قوتابخانة/ '+record.name+' ');
  if (sheet.id==='3' || sheet.id==='4') text=text.replace(/(ناوى قوتابخانة\s*[:/]\s*)\.{2,}/,(_,label)=>label+record.name);
  if (sheet.id==='5' && ['B4','B15','B21'].includes(cell.ref)) text=text.replace(/\.{2,}/,()=>record.name);
  return text;
}
export function cellValue(sheet, cell, record) {
  const saved=record.sheets[sheet.id]?.[cell.ref];
  if (saved!==undefined) return saved;
  if (cell.header) return initialHeader(sheet,cell,record);
  if (cell.editable) {
    if (sheet.id==='7' && cell.ref==='C3') return record.name;
    return '';
  }
  let text=cell.text.replaceAll('2025-2026',record.year);
  if ((sheet.id==='6' && cell.ref==='A1') || (sheet.id==='8' && cell.ref==='B5')) text+=' — '+record.name;
  return text;
}
export function columnLabel(sheet,cell) {
  if(sheet.id==='7' && cell.row<6) return ({C3:'ناوی قوتابخانە · School name',C4:'ژمارەی هۆبە · Sections',G3:'ژمارەی قوتابی · Students',G4:'ژمارەی پۆل · Classes'})[cell.ref] || cell.ref;
  const lastHeader={1:14,2:5,3:4,4:6,5:0,6:2,7:6,8:6}[sheet.id];
  let h=lastHeader;
  if(sheet.id==='5') h=[6,12,17,23,28].filter(n=>n<cell.row).at(-1)||6;
  const labels=sheet.cells.filter(c=>c.row<=h && c.row+c.rs-1>=h-1 && c.col<=cell.col && c.col+c.cs>cell.col && c.text && !c.header);
  return [...new Set(labels.map(c=>c.text))].join(' / ') || cell.ref;
}
export function sumRow(values, refs) {
  const entries=refs.map(r=>values[r]);
  if(entries.every(v=>v===undefined||v==='')) return '';
  if(entries.some(v=>v!==undefined&&v!==''&&!/^\d+$/.test(v))) return null;
  return String(entries.reduce((sum,v)=>sum+Number(v||0),0));
}
