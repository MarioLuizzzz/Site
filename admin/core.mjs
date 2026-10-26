export const OWNER = '63d8e063-4755-430c-a582-d25d24416dfa';
export const money = value => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(Number(value));
export function localDateTime(value = new Date()) {
 const parts = new Intl.DateTimeFormat('sv-SE', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
 const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function toInstant(value) {
 if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Informe uma data e um horário válidos.');
 const date = new Date(value + ':00-03:00');
 if (!Number.isFinite(date.getTime()) || localDateTime(date) !== value) throw new Error('Data ou horário inválido.');
 return date.toISOString();
}
export function overlaps(a,b) {
 return a.id !== b.id && a.status !== 'Cancelado' && b.status !== 'Cancelado' && new Date(a.inicio)<new Date(b.fim) && new Date(a.fim)>new Date(b.inicio);
}
export function validate(kind,p) {
 const required = kind==='agenda'?['cliente','veiculo','descricao_servico']:['nome'];
 if(required.some(k=>typeof p[k]!=='string'||!p[k].trim()))throw new Error('Preencha os campos obrigatórios.');
 for(const k of ['preco','valor','quantidade','duracao_minutos'])if(k in p&&(!Number.isFinite(p[k])||p[k]<0))throw new Error('Confira os valores numéricos.');
 if(kind==='servicos'&&(!Number.isInteger(p.duracao_minutos)||p.duracao_minutos<=0))throw new Error('A duração deve ser maior que zero.');
 if(kind==='materiais'&&p.quantidade<=0)throw new Error('A quantidade deve ser maior que zero.');
 if(kind==='agenda'&&!(new Date(p.fim)>new Date(p.inicio)))throw new Error('O término precisa ser depois do início.');
 return p;
}
