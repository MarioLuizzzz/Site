// Notifications only. No private API response or page is cached.
self.addEventListener('push',event=>{
 let p;try{p=event.data.json();}catch{p={};}
 event.waitUntil(self.registration.showNotification(p.title||'Prime Detail',{body:p.body||'Você tem um atendimento próximo.',icon:'/assets/logo-prime-detail.jpg',tag:p.tag||'prime-detail',data:{url:'/admin/'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=tabs.find(c=>new URL(c.url).origin===self.location.origin&&new URL(c.url).pathname.startsWith('/admin/'));
  if(existing)return existing.focus();
  return self.clients.openWindow('/admin/');
 })());
});
