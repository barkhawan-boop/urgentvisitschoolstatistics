import { validateData } from './model.js';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
async function hash(token) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(v=>v.toString(16).padStart(2,'0')).join(''); }
function equal(a,b) { if(a.length!==b.length)return false; let v=0; for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0; }
async function bodyLimited(request) {
  const reader=request.body?.getReader(); if(!reader)throw new Error('Missing data');
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();throw new Error('Record exceeds 256 KB');}chunks.push(value);}
  const buffer=new Uint8Array(size);let offset=0;for(const c of chunks){buffer.set(c,offset);offset+=c.length;}
  return JSON.parse(new TextDecoder().decode(buffer));
}
export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if(url.pathname==='/api/health') {
      try { if(!env.DB) return json({ready:false},503); await env.DB.prepare('SELECT id FROM schools LIMIT 1').first(); return json({ready:true}); }
      catch { return json({ready:false},503); }
    }
    const match=url.pathname.match(/^\/api\/schools\/([a-f0-9-]{36})$/);
    if(!match) return json({error:'Not found'},404);
    if(!['GET','PUT'].includes(request.method))return json({error:'Method not allowed'},405);
    const origin=request.headers.get('Origin');
    if(origin && origin!==url.origin)return json({error:'Cross-origin request denied'},403);
    const token=request.headers.get('Authorization')?.replace(/^Bearer /,'') || '';
    if(!/^[a-f0-9]{64}$/.test(token))return json({error:'A valid recovery code is required.'},401);
    if(!env.DB)return json({error:'Cloud database is not configured. Your local draft is safe.'},503);
    try {
      const id=match[1], digest=await hash(token);
      const existing=await env.DB.prepare('SELECT * FROM schools WHERE id = ?').bind(id).first();
      if(existing && !equal(existing.token_hash,digest))return json({error:'Record not found or recovery code is incorrect.'},404);
      if(request.method==='GET')return existing ? json({data:JSON.parse(existing.data),revision:existing.revision,updatedAt:existing.updated_at}) : json({error:'Record not found.'},404);
      let body,data;
      try { body=await bodyLimited(request);data=validateData(body.data);if(!Number.isInteger(body.revision)||body.revision<0)throw new Error('Invalid revision'); }
      catch(e){return json({error:e.message||'Invalid data'},400);}
      const now=new Date().toISOString();
      if(!existing) {
        if(body.revision!==0)return json({error:'The cloud record is missing. Restore or create a new record.'},409);
        const result=await env.DB.prepare('INSERT OR IGNORE INTO schools (id,token_hash,name,year,data,revision,updated_at) VALUES (?,?,?,?,?,1,?)').bind(id,digest,data.name,data.year,JSON.stringify(data),now).run();
        if(!result.meta.changes)return json({error:'The record changed in another window. Reload the cloud copy.'},409);
        return json({revision:1,updatedAt:now},201);
      }
      const result=await env.DB.prepare('UPDATE schools SET name=?,year=?,data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(data.name,data.year,JSON.stringify(data),now,id,body.revision).run();
      if(!result.meta.changes)return json({error:'A newer cloud copy exists. Download your backup before restoring the cloud copy.'},409);
      return json({revision:body.revision+1,updatedAt:now});
    } catch { return json({error:'Cloud save is unavailable. Your draft remains on this device. Please retry.'},503); }
  }
};
