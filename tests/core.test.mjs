import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unzipSync,strFromU8 } from 'fflate';
import { workbook,validateData,cellValue,sumRow } from '../src/model.js';
import { exportWorkbook,patchSheetXml } from '../src/export.js';
const record={name:'قوتابخانەی تاقیکردنەوە',year:'2026-2027',sheets:{'1':{'B15':'مامۆستا & <test>','AB15':'07501234567'},'2':{'B6':'Teacher','I6':'1988'},'5':{'C7':'12','D7':'10','E7':'22'}},completed:['1']};
test('all eight original worksheets and their entry ranges are mapped',()=>{
  assert.equal(workbook.sheets.length,8);assert.deepEqual(workbook.sheets.map(s=>s.cells.filter(c=>c.editable).length),[112,651,180,306,120,200,109,90]);
});
test('record validation rejects labels, unknown sheets, oversized values and invalid years',()=>{
  assert.equal(validateData(record).name,record.name);
  for(const r of [{...record,year:'2026-2030'},{...record,sheets:{9:{}}},{...record,sheets:{1:{A12:'overwrite title'}}},{...record,sheets:{1:{B15:'x'.repeat(501)}}}])assert.throws(()=>validateData(r));
});
test('totals distinguish blank from zero and reject invalid counts',()=>{
  assert.equal(sumRow({},['C7','D7']),'');assert.equal(sumRow({C7:'0'},['C7','D7']),'0');assert.equal(sumRow({C7:'12',D7:'10'},['C7','D7']),'22');assert.equal(sumRow({C7:'-1'},['C7','D7']),null);
});
test('unused birth year placeholders are cleared and source labels are retained',()=>{
 const sheet=workbook.sheets[1];assert.equal(cellValue(sheet,sheet.cells.find(c=>c.ref==='I7'),record),'');assert.match(cellValue(sheet,sheet.cells.find(c=>c.ref==='D3'),record),/2026-2027/);
});
test('original workbook package, formatting, merged ranges and print settings survive export',()=>{
  const original=unzipSync(readFileSync('public/template.xlsx'));
  const output=unzipSync(exportWorkbook(readFileSync('public/template.xlsx'),record));
  assert.deepEqual(Object.keys(output).sort(),Object.keys(original).sort());
  for(const path of Object.keys(original)){
    if(!/^xl\/worksheets\/sheet\d+\.xml$/.test(path))assert.deepEqual(output[path],original[path],path+' unchanged');
    else{
      const a=strFromU8(original[path]),b=strFromU8(output[path]);
      for(const tag of ['mergeCells','cols','pageMargins','pageSetup','sheetViews']){
        const re=new RegExp('<'+tag+'\\b[^>]*(?:\\/>|>[\\s\\S]*?<\\/'+tag+'>)');
        assert.equal(b.match(re)?.[0],a.match(re)?.[0],path+' '+tag);
      }
    }
  }
  const first=strFromU8(output['xl/worksheets/sheet1.xml']);
  assert.match(first,/مامۆستا &amp; &lt;test&gt;/);assert.match(first,/07501234567/);
  assert.match(strFromU8(output['xl/worksheets/sheet2.xml']),/<c r="I6"[^>]*><v>1988<\/v>/);
});
test('cell insertion remains ordered and untrusted text cannot become a formula',()=>{
 const xml='<worksheet><sheetData><row r="1"><c r="A1" s="2"><v>1</v></c><c r="C1" s="3"/></row></sheetData></worksheet>';
 const changed=patchSheetXml(xml,{B1:'=HYPERLINK("bad")',C1:'007'});
 assert.ok(changed.indexOf('r="B1"')<changed.indexOf('r="C1"'));assert.ok(!changed.includes('<f>'));assert.match(changed,/s="3" t="inlineStr"/);
});

