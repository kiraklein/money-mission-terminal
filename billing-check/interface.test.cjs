'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
// Application event-flow checks using a small DOM stand-in. These do not verify
// browser rendering, browser file permissions or the native download UI.
function application(){
 const html=fs.readFileSync(__dirname+'/dist/Klein-Billing-Check.html','utf8'),downloads=[],elements={};let printed=0;
 class Element{constructor(id=''){this.id=id;this.listeners={};this.files=[];this.value='';this.textContent='';this.innerHTML='';this.hidden=false;this.disabled=false;this.checked=false;this.dataset={};}addEventListener(name,fn){this.listeners[name]=fn;}replaceChildren(){this.innerHTML='';this.textContent='';}async click(){if(this.download)downloads[downloads.length-1].name=this.download;return this.listeners.click?.();}remove(){}}
 for(const m of html.matchAll(/\bid="([^"]+)"/g))elements[m[1]]=new Element(m[1]);
 for(const id of ['report','error'])elements[id].hidden=true;for(const id of ['export','print'])elements[id].disabled=true;
 const templates=['usage','pricing','invoices'].map(type=>{const e=new Element();e.dataset.template=type;return e;});
 const context={console,Blob,document:{getElementById:id=>{assert.ok(elements[id],'Unknown element '+id);return elements[id];},querySelectorAll:selector=>{assert.equal(selector,'[data-template]');return templates;},createElement:tag=>{assert.equal(tag,'a');return new Element();},body:{appendChild(){}}},URL:{createObjectURL(blob){downloads.push({blob});return 'blob:local-test';},revokeObjectURL(){}},setTimeout(fn){fn();}};
 context.window=context;context.print=()=>{printed++;};vm.createContext(context);
 for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(match[1],context);
 return {elements,downloads,templates,printed:()=>printed,async upload(type,text){elements[type].files=[{name:type+'.csv',size:Buffer.byteLength(text),text:async()=>text}];await elements[type].listeners.change();}};
}
test('worked example renders separate totals, exports findings, prints and clears',async()=>{
 const a=application(),e=a.elements;assert.match(e.checkout.href,/^https:\/\/buy\.stripe\.com\//);await e.sample.click();assert.equal(e.report.hidden,false);assert.match(e.totals.innerHTML,/4\.50/);assert.match(e.totals.innerHTML,/3\.50/);assert.match(e.totals.innerHTML,/10\.00/);assert.match(e.quality.textContent,/2 unresolved/);assert.match(e['result-label'].textContent,/Example data/);
 await e.export.click();assert.match(a.downloads[0].name,/-example\.csv$/);const csv=await a.downloads[0].blob.text();assert.match(csv,/potential_underbilling/);assert.match(csv,/NZD/);await e.print.click();assert.equal(a.printed(),1);
 await e.clear.click();assert.equal(e.report.hidden,true);assert.equal(e.export.disabled,true);assert.equal(e.ack.checked,false);assert.equal(e.rows.innerHTML,'');
});
test('customer file flow enforces acknowledgement and prevents stale reports',async()=>{
 const a=application(),e=a.elements;await e.run.click();assert.match(e.error.textContent,/Confirm/);
 await a.upload('usage','event_id,customer_id,meter,period,currency,quantity\nu1,client<one>,minutes,2026-08,USD,120\n');
 await a.upload('pricing','customer_id,meter,currency,unit_price,included_units\n*,minutes,USD,0.15,20\n');
 await a.upload('invoices','invoice_line_id,customer_id,meter,period,currency,amount\nil1,client<one>,minutes,2026-08,USD,10.00\n');
 e.ack.checked=true;await e.run.click();assert.equal(e.error.hidden,true);assert.equal(e.report.hidden,false);assert.match(e.totals.innerHTML,/5\.00/);assert.match(e.rows.innerHTML,/client&lt;one&gt;/);assert.doesNotMatch(e.rows.innerHTML,/<one>/);assert.match(e['result-label'].textContent,/Your supplied data/);
 await a.upload('pricing','broken_header\n1\n');assert.equal(e.report.hidden,true);assert.equal(e.export.disabled,true);assert.equal(e.ack.checked,false);e.ack.checked=true;await e.run.click();assert.equal(e.error.hidden,false);assert.equal(e.run.disabled,false);assert.equal(e.report.hidden,true);
});
test('all downloadable templates contain the required source headers',async()=>{
 const a=application();for(const button of a.templates)await button.click();assert.equal(a.downloads.length,3);assert.match(await a.downloads[0].blob.text(),/^event_id,customer_id,meter,period,currency,quantity/);assert.match(await a.downloads[1].blob.text(),/^customer_id,meter,currency,unit_price,included_units/);assert.match(await a.downloads[2].blob.text(),/^invoice_line_id,customer_id,meter,period,currency,amount/);
});
