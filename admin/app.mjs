import {setupPush} from './push.mjs';
import {OWNER,money,localDateTime,toInstant,overlaps,validate} from './core.mjs';
const $ = s => document.querySelector(s);
const state={tab:'agenda',data:{agenda:[],servicos:[],materiais:[]},day:localDateTime().slice(0,10),month:localDateTime().slice(0,7),ready:false,user:null,epoch:0,loading:false,editing:null};
let db, noticeTimer;
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,fn,cls){const n=el('button',text,cls);n.type='button';n.onclick=fn;return n;}
function notify(text){clearTimeout(noticeTimer);$('#notice').textContent=text;noticeTimer=setTimeout(()=>$('#notice').textContent='',5000);}
function errorText(error){
 if(!navigator.onLine)return 'Sem internet. Seus dados não foram enviados. Reconecte e tente novamente.';
 if(error?.code==='42501')return 'Acesso negado. Confira se esta é a conta autorizada e se as permissões do banco foram configuradas.';
 if(['PGRST205','42P01'].includes(error?.code))return 'As tabelas do painel não foram encontradas. Confira o SQL no Supabase.';
 if(error?.code==='invalid_credentials')return 'E-mail ou senha incorretos.';
 if(error?.code==='email_not_confirmed')return 'Confirme o e-mail da conta no Supabase.';
 return error?.message || 'Não foi possível concluir. Tente novamente.';
}
function reset(){state.epoch++;state.user=null;state.ready=false;state.loading=false;state.data={agenda:[],servicos:[],materiais:[]};$('#app').hidden=true;$('#login').hidden=false;$('#agenda-list').replaceChildren();$('#other-list').replaceChildren();$('#stats').replaceChildren();$('#fields').replaceChildren();$('#editor').close();$('#sync').textContent='';$('#load-error').hidden=true;}
async function readAll(kind){let out=[];for(let from=0;;from+=500){const {data,error}=await db.from('pd_'+kind).select('*').order('id').range(from,from+499);if(error)throw error;out.push(...data);if(data.length<500)return out;}}
async function load(){
 if(!state.user||state.loading)return;
 const epoch=state.epoch;state.loading=true;state.ready=false;$('#add').disabled=true;$('#refresh').disabled=true;$('#sync').textContent='Atualizando…';$('#load-error').hidden=true;
 try{const rows=await Promise.all(['agenda','servicos','materiais'].map(readAll));if(epoch!==state.epoch)return;['agenda','servicos','materiais'].forEach((k,i)=>state.data[k]=rows[i]);state.ready=true;render();$('#sync').textContent='Atualizado às '+new Date().toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})+' · Horários de Brasília';}
 catch(error){if(epoch!==state.epoch)return;state.data={agenda:[],servicos:[],materiais:[]};render();$('#load-error span').textContent=errorText(error);$('#load-error').hidden=false;$('#sync').textContent='Não foi possível carregar os dados.';}
 finally{if(epoch===state.epoch){state.loading=false;$('#add').disabled=!state.ready;$('#refresh').disabled=false;}}
}
function changeTab(tab){state.tab=tab;$('#search').value='';const labels={agenda:['Agenda','Cada atendimento, no seu tempo.','Novo atendimento','Buscar cliente, veículo ou serviço…'],servicos:['Serviços','Seu catálogo interno, sempre organizado.','Novo serviço','Buscar serviço…'],materiais:['Reposição','Tudo o que falta para o próximo detalhe.','Novo material','Buscar material…']};const l=labels[tab];$('#title').textContent=l[0];$('#subtitle').textContent=l[1];$('#add').textContent='+ '+l[2];$('#search').placeholder=l[3];document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false');});const opts=tab==='agenda'?['Todos os status','Agendado','Em andamento','Concluído','Cancelado']:tab==='servicos'?['Ativos','Todos','Inativos']:['Pendentes','Todos','Comprados','Alta prioridade'];$('#filter').replaceChildren(...opts.map(x=>{const o=el('option',x);o.value=x;return o;}));$('#agenda-layout').hidden=tab!=='agenda';$('#other-list').hidden=tab==='agenda';render();}
function stat(label,value){const box=el('div',undefined,'stat');box.append(el('span',label),el('strong',String(value)));return box;}
function render(){
 const d=state.data,today=localDateTime().slice(0,10),active=d.agenda.filter(a=>a.status!=='Cancelado');
 const stats=state.tab==='agenda'?[['Hoje',active.filter(a=>localDateTime(a.inicio).startsWith(today)).length],['Em andamento',active.filter(a=>a.status==='Em andamento').length],['A receber',money(active.filter(a=>!a.pago).reduce((s,a)=>s+Number(a.valor),0))]]:state.tab==='servicos'?[['Serviços ativos',d.servicos.filter(s=>s.ativo).length],['Carros',d.servicos.filter(s=>s.ativo&&s.categoria==='Carro').length],['Motos',d.servicos.filter(s=>s.ativo&&s.categoria==='Moto').length]]:[['Para comprar',d.materiais.filter(m=>!m.comprado).length],['Alta prioridade',d.materiais.filter(m=>!m.comprado&&m.prioridade==='Alta').length],['Comprados',d.materiais.filter(m=>m.comprado).length]];
 $('#stats').replaceChildren(...stats.map(([k,v])=>stat(k,state.ready?v:'—')));
 const q=$('#search').value.toLocaleLowerCase('pt-BR'),filter=$('#filter').value;
 let rows=[...d[state.tab]].filter(r=>Object.values(r).some(v=>typeof v==='string'&&v.toLocaleLowerCase('pt-BR').includes(q)));
 if(state.tab==='agenda'){
  renderCalendar();rows=rows.filter(r=>(!state.day||localDateTime(r.inicio).startsWith(state.day))&&(filter==='Todos os status'||r.status===filter)).sort((a,b)=>new Date(a.inicio)-new Date(b.inicio));
  $('#list-title').textContent=state.day?new Date(state.day+'T12:00:00-03:00').toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo',day:'numeric',month:'long'}):'Todos os atendimentos';$('#count').textContent=rows.length+' registro(s)';$('#agenda-list').replaceChildren(...rows.map(appointmentCard));if(!rows.length)empty($('#agenda-list'),'Sua agenda tem espaço','Crie um atendimento ou escolha outra data.');
 }else{
  if(state.tab==='servicos')rows=rows.filter(r=>filter==='Todos'||(filter==='Ativos'?r.ativo:!r.ativo)).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  else rows=rows.filter(r=>filter==='Todos'||(filter==='Pendentes'?!r.comprado:filter==='Comprados'?r.comprado:!r.comprado&&r.prioridade==='Alta')).sort((a,b)=>Number(a.comprado)-Number(b.comprado)||({Alta:0,Normal:1,Baixa:2}[a.prioridade]-{Alta:0,Normal:1,Baixa:2}[b.prioridade])||a.nome.localeCompare(b.nome,'pt-BR'));
  $('#other-list').replaceChildren(...rows.map(state.tab==='servicos'?serviceCard:materialCard));if(!rows.length)empty($('#other-list'),state.tab==='servicos'?'Seu catálogo começa aqui':'Tudo em ordem por aqui',state.tab==='servicos'?'Cadastre os serviços e os valores usados nos atendimentos.':'Adicione um material ou ajuste o filtro.');
 }
}
function empty(target,title,subtitle){const n=el('div',undefined,'empty');n.append(el('h3',state.ready?title:'Dados indisponíveis'),el('p',state.ready?subtitle:'Use Atualizar para tentar novamente.'));target.append(n);}
function baseCard(title,badge,badgeClass=''){const card=el('article',undefined,'card'),top=el('div',undefined,'card-top');top.append(el('h3',title),el('span',badge,'badge '+badgeClass));card.append(top);return card;}
function actions(card,...buttons){const row=el('div',undefined,'actions');row.append(...buttons);card.append(row);}
function appointmentCard(r){const c=baseCard(r.cliente,r.status,r.status==='Concluído'?'done':'');const date=new Date(r.inicio).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});c.prepend(el('p',date+' → '+new Date(r.fim).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}),'time'));c.append(el('p',[r.veiculo,r.placa].filter(Boolean).join(' · ')),el('p',r.descricao_servico),el('strong',money(r.valor)+' · '+(r.pago?'Pago':'Pendente')));if(r.telefone)c.append(el('p','Contato: '+r.telefone));if(r.observacoes)c.append(el('p',r.observacoes));actions(c,button('Editar',()=>edit('agenda',r)),button('Excluir',()=>remove('agenda',r)));return c;}
function serviceCard(r){const c=baseCard(r.nome,r.ativo?r.categoria:'Inativo');c.append(el('div',money(r.preco),'price'),el('p',r.duracao_minutos+' minutos'));if(r.descricao)c.append(el('p',r.descricao));actions(c,button('Editar',()=>edit('servicos',r)),button(r.ativo?'Desativar':'Ativar',()=>patch('servicos',r,{ativo:!r.ativo})));return c;}
function materialCard(r){const c=baseCard(r.nome,r.comprado?'Comprado':r.prioridade,r.comprado?'done':r.prioridade==='Alta'?'high':'');c.append(el('div',Number(r.quantidade).toLocaleString('pt-BR')+' '+r.unidade,'price'));if(r.observacoes)c.append(el('p',r.observacoes));actions(c,button(r.comprado?'Voltar à lista':'Marcar comprado',()=>patch('materiais',r,{comprado:!r.comprado})),button('Editar',()=>edit('materiais',r)),button('Excluir',()=>remove('materiais',r)));return c;}
function renderCalendar(){const [year,month]=state.month.split('-').map(Number);$('#month-title').textContent=new Date(Date.UTC(year,month-1,15)).toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});const grid=$('#calendar');grid.replaceChildren(...['D','S','T','Q','Q','S','S'].map(x=>el('span',x,'weekday')));const start=new Date(Date.UTC(year,month-1,1)).getUTCDay(),days=new Date(Date.UTC(year,month,0)).getUTCDate();for(let i=0;i<start;i++)grid.append(el('span'));for(let n=1;n<=days;n++){const day=state.month+'-'+String(n).padStart(2,'0');const b=button(String(n),()=>{state.day=day;render();});b.setAttribute('aria-label',day.split('-').reverse().join('/'));b.setAttribute('aria-pressed',String(day===state.day));b.classList.toggle('selected',day===state.day);b.classList.toggle('is-today',day===localDateTime().slice(0,10));b.classList.toggle('has-event',state.data.agenda.some(a=>a.status!=='Cancelado'&&localDateTime(a.inicio).startsWith(day)));grid.append(b);}}
function shiftMonth(n){const [y,m]=state.month.split('-').map(Number);state.month=new Date(Date.UTC(y,m-1+n,15)).toISOString().slice(0,7);renderCalendar();}
function field(name,label,type,value='',options){const wrap=el('label',label);let input;if(type==='select'){input=el('select');for(const o of options){const [v,text]=Array.isArray(o)?o:[o,o];const opt=el('option',text);opt.value=v;input.append(opt);}}else if(type==='textarea'){input=el('textarea');wrap.className='full';}else{input=el('input');input.type=type;}input.name=name;if(type==='checkbox'){wrap.className='check';input.checked=Boolean(value);}else input.value=value??'';if(type==='text'||type==='textarea')input.maxLength=type==='textarea'?3000:200;if(type==='number'){input.min='0';input.step=['duracao_minutos'].includes(name)?'1':name==='quantidade'?'0.001':'0.01';}wrap.append(input);$('#fields').append(wrap);return input;}
function edit(kind,r={}){
 if(!state.ready||state.loading)return;state.editing={kind,id:r.id};$('#fields').replaceChildren();$('#form-error').textContent='';$('#save').disabled=false;$('#editor-title').textContent=(r.id?'Editar ':'Novo ')+({agenda:'atendimento',servicos:'serviço',materiais:'material'}[kind]);
 if(kind==='agenda'){
  field('cliente','Cliente *','text',r.cliente).required=true;field('telefone','Telefone','tel',r.telefone);field('veiculo','Veículo *','text',r.veiculo).required=true;field('placa','Placa','text',r.placa);
  const services=state.data.servicos.filter(s=>s.ativo||s.id===r.servico_id);const select=field('servico_id','Serviço do catálogo','select',r.servico_id||'',[['','Personalizado / selecionar'],...services.map(s=>[s.id,s.nome+' · '+s.categoria])]);
  const description=field('descricao_servico','Serviço combinado *','text',r.descricao_servico);description.required=true;
  const start=field('inicio','Início *','datetime-local',r.inicio?localDateTime(r.inicio):(state.day||localDateTime().slice(0,10))+'T09:00');start.required=true;
  const end=field('fim','Término *','datetime-local',r.fim?localDateTime(r.fim):(state.day||localDateTime().slice(0,10))+'T10:00');end.required=true;
  const price=field('valor','Valor (R$) *','number',r.valor??0);price.required=true;
  field('status','Situação','select',r.status||'Agendado',['Agendado','Em andamento','Concluído','Cancelado']);field('pago','Pagamento recebido','checkbox',r.pago);field('observacoes','Observações','textarea',r.observacoes);
  select.onchange=()=>{const s=services.find(s=>s.id===select.value);if(!s)return;description.value=s.nome;price.value=s.preco;if(start.value){try{end.value=localDateTime(new Date(new Date(toInstant(start.value)).getTime()+s.duracao_minutos*60000));}catch{}}};
 }else if(kind==='servicos'){
  field('nome','Nome do serviço *','text',r.nome).required=true;field('categoria','Categoria','select',r.categoria||'Carro',['Carro','Moto','Outro']);field('preco','Preço base (R$) *','number',r.preco??0).required=true;const duration=field('duracao_minutos','Duração (minutos) *','number',r.duracao_minutos??60);duration.min='1';duration.required=true;field('ativo','Serviço ativo','checkbox',r.ativo??true);field('descricao','Descrição','textarea',r.descricao);
 }else{
  field('nome','Material *','text',r.nome).required=true;const qty=field('quantidade','Quantidade *','number',r.quantidade??1);qty.min='0.001';qty.required=true;field('unidade','Unidade *','text',r.unidade||'unidade').required=true;field('prioridade','Prioridade','select',r.prioridade||'Normal',['Baixa','Normal','Alta']);field('comprado','Já comprado','checkbox',r.comprado);field('observacoes','Observações','textarea',r.observacoes);
 }
 $('#editor').showModal();
}
let writing=false;
let saving=false;
async function mutate(kind,id,payload,remove=false){
 if(writing)throw new Error('Aguarde a operação atual.');if(!state.ready||!state.user)throw new Error('Atualize os dados antes de continuar.');if(!navigator.onLine)throw new Error('Sem internet. Reconecte e tente novamente.');writing=true;
 try{let q=db.from('pd_'+kind);q=remove?q.delete().eq('id',id):id?q.update(payload).eq('id',id):q.insert(payload);const {data,error}=await q.select('id');if(error)throw error;if(data?.length!==1)throw new Error('O registro mudou ou o acesso foi negado. Atualize e tente novamente.');}
 finally{writing=false;}
}
async function patch(kind,r,payload){try{await mutate(kind,r.id,payload);notify('Alteração salva.');await load();}catch(error){notify(errorText(error));}}
async function remove(kind,r){if(!confirm('Excluir este '+(kind==='agenda'?'atendimento':'material')+'? Esta ação não pode ser desfeita.'))return;try{await mutate(kind,r.id,null,true);notify('Registro excluído.');await load();}catch(error){notify(errorText(error));}}
$('#edit-form').onsubmit=async event=>{
 event.preventDefault();if(writing||saving)return;saving=true;const {kind,id}=state.editing;$('#save').disabled=true;$('#form-error').textContent='';
 try{const p=Object.fromEntries(new FormData(event.currentTarget));for(const k of Object.keys(p))if(typeof p[k]==='string')p[k]=p[k].trim();if(kind==='agenda'){p.inicio=toInstant(p.inicio);p.fim=toInstant(p.fim);p.valor=Number(p.valor);p.servico_id=p.servico_id||null;p.pago=event.currentTarget.elements.pago.checked;}else if(kind==='servicos'){p.preco=Number(p.preco);p.duracao_minutos=Number(p.duracao_minutos);p.ativo=event.currentTarget.elements.ativo.checked;}else{p.quantidade=Number(p.quantidade);p.comprado=event.currentTarget.elements.comprado.checked;}validate(kind,p);
 if(kind==='agenda'){const latest=await readAll('agenda');if(latest.some(a=>overlaps({...p,id},a))&&!confirm('Já existe um atendimento nesse intervalo. Deseja salvar mesmo assim?'))return;}
 await mutate(kind,id,p);$('#editor').close();notify('Salvo com sucesso.');await load();
 }catch(error){$('#form-error').textContent=errorText(error);}finally{saving=false;$('#save').disabled=false;}
};
$('#close').onclick=$('#cancel').onclick=()=>{if(!writing&&!saving)$('#editor').close();};$('#editor').addEventListener('cancel',e=>{if(writing||saving)e.preventDefault();});
async function signOut(){try{const {error}=await db.auth.signOut({scope:'local'});if(error)throw error;reset();notify('Você saiu da conta.');}catch(e){notify(errorText(e));}}
$('#logout').onclick=signOut;const mobileLogout=button('Sair',signOut,'mobile-logout');$('header > div').append(mobileLogout);
$('#add').onclick=()=>edit(state.tab);$('#search').oninput=render;$('#filter').onchange=render;$('#refresh').onclick=$('#retry').onclick=load;$('#prev-month').onclick=()=>shiftMonth(-1);$('#next-month').onclick=()=>shiftMonth(1);$('#today').onclick=()=>{state.day=localDateTime().slice(0,10);state.month=state.day.slice(0,7);render();};$('#clear-date').onclick=()=>{state.day='';render();};document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>changeTab(b.dataset.tab));
function network(){ $('#offline').hidden=navigator.onLine; }addEventListener('online',()=>{network();load();});addEventListener('offline',network);network();
async function enter(){const {data,error}=await db.auth.getUser();if(error)throw error;if(data.user?.id!==OWNER){await db.auth.signOut({scope:'local'});throw new Error('Esta conta não está autorizada a acessar o painel.');}state.epoch++;state.user=data.user;$('#login').hidden=true;$('#app').hidden=false;changeTab('agenda');await load();void setupPush(db);}
$('#login-form').onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;$('#login-error').textContent='';try{if(!db)throw new Error('Não foi possível iniciar o painel. Recarregue a página.');const f=new FormData(e.currentTarget);const {error}=await db.auth.signInWithPassword({email:f.get('email').trim(),password:f.get('password')});if(error)throw error;await enter();e.target.reset();}catch(error){$('#login-error').textContent=errorText(error);}finally{b.disabled=false;}};
try{if(!window.supabase)throw new Error('Não foi possível carregar o painel. Recarregue a página.');db=window.supabase.createClient('https://eorupwlmcitkiyczrcvk.supabase.co','sb_publishable_9qAD1tneoaEDakqS16nv0g_z-oPbnoo',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});db.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(state.user&&session?.user?.id!==OWNER))reset();});const {data,error}=await db.auth.getSession();if(error)throw error;if(data.session)await enter();}catch(error){reset();$('#login-error').textContent=errorText(error);}
