let registration,config,client,busy=false;
const $=s=>document.querySelector(s);
function message(text){$('#push-status').textContent=text;}
function capable(){return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window&&window.isSecureContext;}
function keyBytes(key){const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
async function existing(){return registration?.pushManager.getSubscription();}
export async function setupPush(db){
 client=db;if(!capable()){message('No iPhone, adicione o painel à Tela de Início e abra pelo ícone para ativar os avisos (iOS 16.4 ou posterior).');$('#push-enable').disabled=true;return;}
 try{
  const r=await fetch('/.netlify/functions/push-config',{cache:'no-store'});if(!r.ok)throw new Error();config=await r.json();
  if(!config.ready){message('O envio automático ainda precisa ser configurado no servidor.');$('#push-enable').disabled=true;return;}
  registration=await navigator.serviceWorker.register('/admin/sw.js',{scope:'/admin/'});
  await navigator.serviceWorker.ready;
  const sub=await existing();
  let saved=false;if(sub){const {data,error}=await db.from('pd_push_subscriptions').select('id').eq('endpoint',sub.endpoint);if(error)throw error;saved=Boolean(data?.length);}
  $('#push-enable').disabled=false;$('#push-disable').hidden=!sub;$('#push-test').hidden=!saved;
  $('#push-enable').textContent=saved?'Atualizar ativação':'Ativar neste aparelho';
  message(saved?'Avisos de 30 min ativados neste aparelho. Internet e permissão de notificações são necessárias.':'Receba um aviso 30 min antes, mesmo com o painel fechado.');
 }catch{message('Não foi possível verificar os avisos. Confira a configuração do servidor e atualize a página.');$('#push-enable').disabled=true;}
}
$('#push-enable').onclick=async()=>{
 if(busy||!config?.ready||!registration)return;busy=true;$('#push-enable').disabled=true;
 try{
  // Request directly from the button gesture, before network awaits (required on iOS).
  const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Permita as notificações nos Ajustes do iPhone para receber os avisos.');
  const sub=await existing()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(config.publicKey)});
  const json=sub.toJSON();const {error}=await client.from('pd_push_subscriptions').upsert({endpoint:sub.endpoint,p256dh:json.keys.p256dh,auth:json.keys.auth},{onConflict:'endpoint'});if(error)throw new Error('Não foi possível salvar a ativação. Confira se o SQL de notificações foi executado.');
  await setupPush(client);
 }catch(e){message(e.message);}finally{busy=false;$('#push-enable').disabled=false;}
};
export async function disablePush(){
 const sub=await existing();if(!sub)return;
 // Unsubscribe on the device first: even if database removal fails it stops new sends here.
 if(!await sub.unsubscribe())throw new Error('Não foi possível desativar. Verifique os Ajustes de notificações.');
 const {error}=await client.from('pd_push_subscriptions').delete().eq('endpoint',sub.endpoint);
 $('#push-disable').hidden=true;$('#push-test').hidden=true;
 if(error)throw new Error('Avisos desativados neste aparelho; limpeza no servidor pendente.');
 message('Avisos desativados neste aparelho.');$('#push-enable').textContent='Ativar neste aparelho';
}
$('#push-disable').onclick=async()=>{if(busy)return;busy=true;try{await disablePush();}catch(e){message(e.message);}finally{busy=false;}};
$('#push-test').onclick=async()=>{try{await registration.showNotification('Prime Detail · Teste',{body:'A exibição de notificações está funcionando neste aparelho. O envio agendado depende do servidor.',tag:'prime-detail-test',icon:'/assets/logo-prime-detail.jpg',data:{url:'/admin/'}});message('Notificação de teste exibida. Este teste verifica o aparelho, não o envio do servidor.');}catch{message('Não foi possível exibir. Verifique a permissão de notificações.');}};
