-- Esquema inicial já executado pelo proprietário. Não reaplicar em tabelas existentes.
BEGIN;
CREATE TABLE public.pd_servicos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 nome text NOT NULL CHECK (length(trim(nome)) > 0),
 categoria text NOT NULL DEFAULT 'Carro' CHECK (categoria IN ('Carro','Moto','Outro')),
 descricao text NOT NULL DEFAULT '',
 preco numeric(12,2) NOT NULL DEFAULT 0 CHECK (preco >= 0),
 duracao_minutos integer NOT NULL DEFAULT 60 CHECK (duracao_minutos > 0),
 ativo boolean NOT NULL DEFAULT true,
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pd_agenda (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 cliente text NOT NULL CHECK (length(trim(cliente)) > 0),
 telefone text NOT NULL DEFAULT '',
 veiculo text NOT NULL CHECK (length(trim(veiculo)) > 0),
 placa text NOT NULL DEFAULT '',
 servico_id uuid REFERENCES public.pd_servicos(id) ON DELETE SET NULL,
 descricao_servico text NOT NULL CHECK (length(trim(descricao_servico)) > 0),
 inicio timestamptz NOT NULL, fim timestamptz NOT NULL,
 valor numeric(12,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
 status text NOT NULL DEFAULT 'Agendado' CHECK (status IN ('Agendado','Em andamento','Concluído','Cancelado')),
 pago boolean NOT NULL DEFAULT false, observacoes text NOT NULL DEFAULT '',
 criado_em timestamptz NOT NULL DEFAULT now(), CHECK (fim > inicio)
);
CREATE INDEX pd_agenda_inicio_idx ON public.pd_agenda(inicio);
CREATE TABLE public.pd_materiais (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 nome text NOT NULL CHECK (length(trim(nome)) > 0),
 quantidade numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantidade > 0),
 unidade text NOT NULL DEFAULT 'unidade' CHECK (length(trim(unidade)) > 0),
 prioridade text NOT NULL DEFAULT 'Normal' CHECK (prioridade IN ('Baixa','Normal','Alta')),
 comprado boolean NOT NULL DEFAULT false, observacoes text NOT NULL DEFAULT '',
 criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pd_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pd_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pd_materiais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pd_servicos, public.pd_agenda, public.pd_materiais FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pd_servicos, public.pd_agenda, public.pd_materiais TO authenticated;
CREATE POLICY "Somente administrador" ON public.pd_servicos FOR ALL TO authenticated
USING ((SELECT auth.uid()) = '63d8e063-4755-430c-a582-d25d24416dfa'::uuid)
WITH CHECK ((SELECT auth.uid()) = '63d8e063-4755-430c-a582-d25d24416dfa'::uuid);
CREATE POLICY "Somente administrador" ON public.pd_agenda FOR ALL TO authenticated
USING ((SELECT auth.uid()) = '63d8e063-4755-430c-a582-d25d24416dfa'::uuid)
WITH CHECK ((SELECT auth.uid()) = '63d8e063-4755-430c-a582-d25d24416dfa'::uuid);
CREATE POLICY "Somente administrador" ON public.pd_materiais FOR ALL TO authenticated
USING ((SELECT auth.uid()) = '63d8e063-4755-430c-a582-d25d24416dfa'::uuid)
WITH CHECK ((SELECT auth.uid()) = '63d8e063-4755-430c-a582-d25d24416dfa'::uuid);
COMMIT;
