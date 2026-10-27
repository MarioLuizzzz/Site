import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedEndpoint,isDue,payloadFor,runReminders} from '../server/reminders.mjs';
const now=()=>new Date('2026-10-26T20:00:00Z');
const appointment={id:'a',cliente:'Cliente teste',descricao_servico:'Limpeza',inicio:'2026-10-26T20:30:00Z',status:'Agendado'};
const subscription={id:'s',endpoint:'https://web.push.apple.com/example',p256dh:'key',auth:'auth'};
test('30 minute window, overdue and cancelled exclusion',()=>{
 assert.ok(isDue(appointment,now()));assert.ok(!isDue({...appointment,inicio:'2026-10-26T20:30:01Z'},now()));assert.ok(!isDue({...appointment,inicio:now().toISOString()},now()));assert.ok(!isDue({...appointment,status:'Cancelado'},now()));
 assert.match(payloadFor(appointment,now()).body,/17:30.*30 min/);
});
test('only known HTTPS push providers; reject SSRF and deceptive hosts',()=>{
 for(const url of ['http://web.push.apple.com/x','https://127.0.0.1/x','https://web.push.apple.com.attacker.test/x','https://user:pass@web.push.apple.com/x','https://web.push.apple.com:9999/x'])assert.equal(allowedEndpoint(url),false);
 for(const url of [subscription.endpoint,'https://fcm.googleapis.com/x','https://updates.push.services.mozilla.com/x'])assert.ok(allowedEndpoint(url));
});
function fixture({fresh=appointment,sendError=null}={}){
 const claims=new Set(),calls=[];let sends=0,delivered=false;
 const rest=async(path,method='GET',body)=>{
  calls.push({path,method,body});
  if(path.startsWith('pd_agenda?'))return path.includes('id=eq.')?[fresh].filter(Boolean):[appointment];
  if(path.startsWith('pd_push_subscriptions?'))return method==='DELETE'?null:[subscription];
  if(path==='rpc/pd_claim_reminder'){if(delivered||claims.has(body.p_start))return false;claims.add(body.p_start);return true;}
  if(path.startsWith('pd_push_deliveries?')){delivered=true;return null;}
  throw new Error(path);
 };
 return {calls,claims,args:{rest,now,uuid:()=> 'lease',send:async()=>{sends++;if(sendError)throw sendError;}},get sends(){return sends;}};
}
test('successful sends recorded, next run deduplicated',async()=>{
 const f=fixture();assert.equal((await runReminders(f.args)).sent,1);await runReminders(f.args);assert.equal(f.sends,1);assert.ok(f.calls.some(c=>c.path.startsWith('pd_push_deliveries')&&c.method==='PATCH'));
});
test('cancellation or reschedule during execution is skipped',async()=>{
 for(const fresh of [null,{...appointment,status:'Cancelado'},{...appointment,inicio:'2026-10-26T20:25:00Z'}]){const f=fixture({fresh});await runReminders(f.args);assert.equal(f.sends,0);}
});
test('expired subscriptions removed; temporary failure not marked delivered',async()=>{
 for(const code of [410,503]){const f=fixture({sendError:{statusCode:code}});const r=await runReminders(f.args);assert.equal(r.failed,1);assert.equal(f.calls.some(c=>c.method==='DELETE'),code===410);assert.equal(f.calls.some(c=>c.method==='PATCH'),false);}
});
