export default async () => {
 const env=process.env;
 const ready=Boolean(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT&&env.SUPABASE_SERVICE_ROLE_KEY);
 return new Response(JSON.stringify({ready,publicKey:ready?env.VAPID_PUBLIC_KEY:null}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
};
