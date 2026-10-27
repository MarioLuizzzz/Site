export const OWNER='63d8e063-4755-430c-a582-d25d24416dfa';
export function allowedEndpoint(endpoint){
 try {const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(
 u.hostname==='web.push.apple.com'||u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.notify.windows.com'));
 }catch{return false;}
}
export function isDue(a,now){const ms=new Date(a.inicio).getTime()-now.getTime();return a.status==='Agendado'&&ms>0&&ms<=30*60000;}
export function payloadFor(a,now){const minutes=Math.max(1,Math.ceil((new Date(a.inicio)-now)/60000));const time=new Date(a.inicio).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'});return {title:'Prime Detail · Atendimento próximo',body:`${String(a.cliente).slice(0,100)} às ${time} · ${String(a.descricao_servico).slice(0,140)}. Em cerca de ${minutes} min.`,tag:'pd-'+a.id+'-'+new Date(a.inicio).getTime(),url:'/admin/',startsAt:a.inicio};}
export function createRest(env,fetcher=fetch){
 const key=env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw new Error('Configuração de notificações incompleta.');
 const origin='https://eorupwlmcitkiyczrcvk.supabase.co/rest/v1/';
 return async function rest(path,method='GET',body){
  const response=await fetcher(origin+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=minimal'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw new Error('Falha de banco HTTP '+response.status); // never log tokens or records
  const text=await response.text();return text?JSON.parse(text):null;
 };
}
export async function runReminders({rest,send,now=()=>new Date(),uuid,deadline=Date.now()+20000}){
 const current=now(),end=new Date(current.getTime()+30*60000);
 const query=new URLSearchParams({select:'id,cliente,descricao_servico,inicio,status',status:'eq.Agendado',inicio:'gt.'+current.toISOString(),and:'(inicio.lte.'+end.toISOString()+')',order:'inicio.asc,id.asc',limit:'100'});
 const appointments=await rest('pd_agenda?'+query);
 const subs=await rest('pd_push_subscriptions?'+new URLSearchParams({select:'*',user_id:'eq.'+OWNER,order:'id.asc',limit:'100'}));
 const result={sent:0,failed:0,skipped:0};
 for(const a of appointments){for(const s of subs){
  if(Date.now()>deadline)return result;
  if(!isDue(a,now())||!allowedEndpoint(s.endpoint)){result.skipped++;continue;}
  const lease=uuid();
  const claimed=await rest('rpc/pd_claim_reminder','POST',{p_appointment:a.id,p_start:a.inicio,p_subscription:s.id,p_lease:lease});
  if(!claimed){result.skipped++;continue;}
  // Re-read after claiming to skip cancellations/reschedules before the send.
  const fresh=await rest('pd_agenda?'+new URLSearchParams({select:'id,cliente,descricao_servico,inicio,status',id:'eq.'+a.id}));
  if(!fresh?.[0]||!isDue(fresh[0],now())||new Date(fresh[0].inicio).getTime()!==new Date(a.inicio).getTime()){result.skipped++;continue;}
  const filter=new URLSearchParams({appointment_id:'eq.'+a.id,starts_at:'eq.'+a.inicio,subscription_id:'eq.'+s.id,lease:'eq.'+lease});
  try{
   const ttl=Math.max(1,Math.floor((new Date(a.inicio)-now())/1000));
   await send({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify(payloadFor(fresh[0],now())),{TTL:ttl,urgency:'high',timeout:5000});
   await rest('pd_push_deliveries?'+filter,'PATCH',{sent_at:now().toISOString()});result.sent++;
  }catch(error){
   result.failed++;
   if([404,410].includes(error.statusCode))await rest('pd_push_subscriptions?'+new URLSearchParams({id:'eq.'+s.id}),'DELETE');
   // Other failures retain the 2-minute lease and retry (up to 5 attempts).
  }
 }}return result;
}
