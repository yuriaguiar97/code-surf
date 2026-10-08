'use strict';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// No fetch caching: forecast and shared data remain fresh.
self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{}}catch{}
  event.waitUntil(self.registration.showNotification(data.title||'CODE',{body:data.body||'Confira as condições dos seus picos.',tag:data.tag||'code-alert',icon:'icons/code-192.png?v=20261008logo1',badge:'icons/code-192.png',data:{url:data.url||'app.html#alerts'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const root=new URL(self.registration.scope),target=new URL(event.notification.data?.url||'app.html#alerts',root);
  if(target.origin!==root.origin||!target.pathname.startsWith(root.pathname))return;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    for(const client of clients)if(new URL(client.url).pathname.startsWith(root.pathname)){await client.navigate(target.href);return client.focus();}
    return self.clients.openWindow(target.href);
  }));
});
