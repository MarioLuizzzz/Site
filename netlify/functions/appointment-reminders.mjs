import webpush from 'web-push';
import {randomUUID} from 'node:crypto';
import {createRest,runReminders} from '../../server/reminders.mjs';
export default async () => {
 const env=process.env;
 if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY||!env.VAPID_SUBJECT||!env.SUPABASE_SERVICE_ROLE_KEY){console.warn('Notificações ainda não configuradas.');return;}
 webpush.setVapidDetails(env.VAPID_SUBJECT,env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY);
 const result=await runReminders({rest:createRest(env),send:(...args)=>webpush.sendNotification(...args),uuid:randomUUID});
 console.log('Resumo de lembretes',result);
};
