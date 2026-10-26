import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localDateTime,toInstant,overlaps,validate} from '../admin/core.mjs';
test('Brasília dates round-trip without depending on device time zone',()=>{
 assert.equal(toInstant('2026-10-31T23:30'),'2026-11-01T02:30:00.000Z');
 assert.equal(localDateTime('2026-11-01T02:30:00Z'),'2026-10-31T23:30');
 assert.throws(()=>toInstant('2026-02-30T10:00'));
});
test('overlaps detect crossing intervals, allow adjacent and cancelled slots',()=>{
 const a={id:'a',inicio:'2026-10-31T12:00Z',fim:'2026-10-31T14:00Z',status:'Agendado'};
 const b={id:'b',inicio:'2026-10-31T13:00Z',fim:'2026-10-31T15:00Z',status:'Agendado'};
 assert.equal(overlaps(a,b),true);assert.equal(overlaps(a,{...b,inicio:a.fim}),false);assert.equal(overlaps(a,{...b,status:'Cancelado'}),false);assert.equal(overlaps(a,a),false);
});
test('invalid appointment, quantity and service price are rejected',()=>{
 assert.throws(()=>validate('agenda',{cliente:'A',veiculo:'B',descricao_servico:'C',inicio:'2026-01-01T12:00Z',fim:'2026-01-01T11:00Z',valor:10}));
 assert.throws(()=>validate('materiais',{nome:'Cera',quantidade:0}));
 assert.throws(()=>validate('servicos',{nome:'Limpeza',preco:-1,duracao_minutos:60}));
 assert.throws(()=>validate('servicos',{nome:' ',preco:10,duracao_minutos:60}));
 assert.throws(()=>validate('servicos',{nome:'Limpeza',preco:NaN,duracao_minutos:60}));
 assert.equal(validate('materiais',{nome:'Cera',quantidade:0.5}).quantidade,0.5);
});
