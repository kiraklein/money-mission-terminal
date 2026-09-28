/* Copyright 2026 Klein Consulting Ltd. See LICENCE.md. */
(function(root){
'use strict';
const SCALE=1000000000000n;
const SUPPORTED=new Set(['USD','NZD','AUD','EUR','GBP','CAD','CHF','SGD','HKD']);
const schemas={usage:['event_id','customer_id','meter','period','currency','quantity'],pricing:['customer_id','meter','currency','unit_price','included_units'],invoices:['invoice_line_id','customer_id','meter','period','currency','amount']};
function parseCSV(text){
 if(typeof text!=='string'||text.length>6000000)throw Error('Each file must be a CSV smaller than 6 MB.');
 text=text.replace(/^\uFEFF/,'');let rows=[],row=[],field='',quoted=false,closed=false;
 const cell=()=>{row.push(field.trim());field='';closed=false;};
 const line=()=>{cell();if(row.some(v=>v!==''))rows.push(row);row=[];if(rows.length>100001)throw Error('Maximum 100,000 data rows per file.');};
 for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=ch;}
 else if(ch==='"'){if(field.trim()||closed)throw Error('Unexpected quotation mark in CSV.');field='';quoted=true;}
 else if(ch===',')cell();else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;line();}
 else{if(closed&&!/\s/.test(ch))throw Error('Unexpected text after a quoted CSV field.');field+=ch;}}
 if(quoted)throw Error('A quoted CSV field is not closed.');if(field||row.length)line();
 if(!rows.length)throw Error('CSV is empty.');
 const headers=rows.shift();if(new Set(headers).size!==headers.length||headers.some(h=>!h))throw Error('CSV headers must be unique and non-empty.');
 return {headers,rows:rows.map((r,i)=>{if(r.length!==headers.length)throw Error(`CSV row ${i+2} has ${r.length} columns; expected ${headers.length}.`);return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));})};
}
function decimal(value,label,{negative=false,places=12}={}){
 const s=String(value??'').trim();if(!new RegExp(`^${negative?'-?':''}\\d+(?:\\.\\d{1,${places}})?$`).test(s))throw Error(`${label}: use a plain ${negative?'':'non-negative '}number with at most ${places} decimal places.`);
 const neg=s.startsWith('-'),[whole,fraction='']=(neg?s.slice(1):s).split('.');if(whole.length>15)throw Error(`${label}: number is too large.`);
 return (BigInt(whole)*SCALE+BigInt(fraction.padEnd(12,'0')))*(neg?-1n:1n);
}
function textValue(row,key,label){const value=String(row[key]??'').trim();if(!value||value.length>200||/[\x00-\x1f]/.test(value))throw Error(`${label}: ${key} is missing, too long, or contains a control character.`);return value;}
function periodValue(row,label){const p=textValue(row,'period',label);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(p))throw Error(`${label}: period must be YYYY-MM.`);return p;}
function currencyValue(row,label){const c=textValue(row,'currency',label).toUpperCase();if(!SUPPORTED.has(c))throw Error(`${label}: ${c} is not supported. Use ${[...SUPPORTED].join(', ')}.`);return c;}
const key=(...parts)=>JSON.stringify(parts);
function scaledString(n){const sign=n<0n?'-':'';n=n<0n?-n:n;return sign+(n/SCALE).toString()+(n%SCALE?'.'+(n%SCALE).toString().padStart(12,'0').replace(/0+$/,''):'');}
function moneyString(cents){cents=BigInt(cents);const sign=cents<0n?'-':'';cents=cents<0n?-cents:cents;return sign+(cents/100n).toString()+'.'+(cents%100n).toString().padStart(2,'0');}
function moneyCents(q,p){const n=q*p*100n,d=SCALE*SCALE;return(n+d/2n)/d;}
function load(text,type){const t=parseCSV(text);for(const h of schemas[type])if(!t.headers.includes(h))throw Error(`${type}: missing column ${h}. Use the supplied template.`);return t.rows;}
function reconcile(input){
 const u=load(input.usage,'usage'),p=load(input.pricing,'pricing'),inv=load(input.invoices,'invoices');
 if(!u.length)throw Error('Usage needs at least one event.');if(!p.length)throw Error('Pricing needs at least one rule.');
 const prices=new Map(),groups=new Map(),seenUsage=new Map(),seenInvoices=new Map(),counts={usageRows:u.length,invoiceRows:inv.length,duplicateUsage:0,duplicateInvoices:0,pricingRules:p.length};
 for(const [i,r]of p.entries()){const label=`Pricing row ${i+2}`,customer=textValue(r,'customer_id',label),meter=textValue(r,'meter',label),currency=currencyValue(r,label),price=decimal(r.unit_price,`${label} unit_price`),included=decimal(r.included_units,`${label} included_units`);const k=key(customer,meter,currency);if(prices.has(k))throw Error(`${label}: duplicate pricing rule for ${customer} / ${meter} / ${currency}.`);prices.set(k,{price,included,row:i+2});}
 function group(customer,meter,period,currency){const k=key(customer,meter,period,currency);if(!groups.has(k))groups.set(k,{customer,meter,period,currency,quantity:0n,billed:0n,events:0,lines:0});return groups.get(k);}
 for(const [i,r]of u.entries()){const label=`Usage row ${i+2}`,id=textValue(r,'event_id',label),customer=textValue(r,'customer_id',label),meter=textValue(r,'meter',label),period=periodValue(r,label),currency=currencyValue(r,label),q=decimal(r.quantity,`${label} quantity`);const fingerprint=key(customer,meter,period,currency,q.toString());if(seenUsage.has(id)){if(seenUsage.get(id)!==fingerprint)throw Error(`${label}: event_id ${id} has conflicting values. Fix this before comparing.`);counts.duplicateUsage++;continue;}seenUsage.set(id,fingerprint);const g=group(customer,meter,period,currency);g.quantity+=q;g.events++;}
 for(const [i,r]of inv.entries()){const label=`Invoice row ${i+2}`,id=textValue(r,'invoice_line_id',label),customer=textValue(r,'customer_id',label),meter=textValue(r,'meter',label),period=periodValue(r,label),currency=currencyValue(r,label),amount=decimal(r.amount,`${label} amount`,{negative:true,places:2})/(SCALE/100n);const fingerprint=key(customer,meter,period,currency,amount.toString());if(seenInvoices.has(id)){if(seenInvoices.get(id)!==fingerprint)throw Error(`${label}: invoice_line_id ${id} has conflicting values. Fix this before comparing.`);counts.duplicateInvoices++;continue;}seenInvoices.set(id,fingerprint);const g=group(customer,meter,period,currency);g.billed+=amount;g.lines++;}
 const totals=new Map(),results=[];
 for(const g of groups.values()){
  const rate=prices.get(key(g.customer,g.meter,g.currency))||prices.get(key('*',g.meter,g.currency));let expected=null,gap=null,status='matched',reason='',priceRow=null;
  if(!g.events){status='needs_review';reason='Invoice lines have no matching usage in these files.';}
  else if(!rate){status='unpriced';reason='No matching customer-specific or default pricing rule.';}
  else{const billable=g.quantity>rate.included?g.quantity-rate.included:0n;expected=moneyCents(billable,rate.price);gap=expected-g.billed;priceRow=rate.row;
   if(gap>0n){status='potential_underbilling';reason=g.lines?'Calculated charge exceeds supplied net invoice lines.':'No invoice line matches this usage.';}else if(gap<0n){status='potential_overbilling';reason='Supplied net invoice lines exceed calculated charge.';}
   if(!totals.has(g.currency))totals.set(g.currency,{currency:g.currency,expected:0n,billed:0n,under:0n,over:0n,groups:0});const t=totals.get(g.currency);t.expected+=expected;t.billed+=g.billed;t.groups++;if(gap>0n)t.under+=gap;else if(gap<0n)t.over-=gap;
  }
  results.push({customer_id:g.customer,meter:g.meter,period:g.period,currency:g.currency,quantity:scaledString(g.quantity),unit_price:rate?scaledString(rate.price):null,included_units:rate?scaledString(rate.included):null,expected:expected===null?null:moneyString(expected),invoiced:moneyString(g.billed),difference:gap===null?null:moneyString(gap),status,reason,pricing_row:priceRow,unique_events:g.events,unique_invoice_lines:g.lines});
 }
 results.sort((a,b)=>a.currency.localeCompare(b.currency)||a.customer_id.localeCompare(b.customer_id)||a.period.localeCompare(b.period)||a.meter.localeCompare(b.meter));
 return{version:'1.0.0',counts,unresolved:results.filter(r=>['unpriced','needs_review'].includes(r.status)).length,results,totals:[...totals.values()].sort((a,b)=>a.currency.localeCompare(b.currency)).map(t=>({currency:t.currency,expected:moneyString(t.expected),invoiced:moneyString(t.billed),potential_underbilling:moneyString(t.under),potential_overbilling:moneyString(t.over),priced_groups:t.groups}))};
}
function csvCell(v){let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return'"'+s.replace(/"/g,'""')+'"';}
function reportCSV(report){const headers=['customer_id','meter','period','currency','quantity','unit_price','included_units','expected','invoiced','difference','status','reason','pricing_row','unique_events','unique_invoice_lines'];return[headers.join(','),...report.results.map(r=>headers.map(h=>csvCell(r[h])).join(','))].join('\r\n');}
const api={parseCSV,reconcile,reportCSV,moneyString,schemas};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KleinBilling=api;
})(typeof window!=='undefined'?window:this);
