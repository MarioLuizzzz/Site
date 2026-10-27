-- Aplicar UMA VEZ, após schema.sql. Não altera dados de atendimentos.
BEGIN;
CREATE TABLE public.pd_push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 endpoint text NOT NULL UNIQUE CHECK(length(endpoint) BETWEEN 20 AND 4096),
 p256dh text NOT NULL CHECK(length(p256dh) BETWEEN 80 AND 100),
 auth text NOT NULL CHECK(length(auth) BETWEEN 20 AND 30),
 criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pd_push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pd_push_subscriptions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.pd_push_subscriptions TO authenticated;
GRANT ALL ON public.pd_push_subscriptions TO service_role;
CREATE POLICY "Somente administrador" ON public.pd_push_subscriptions FOR ALL TO authenticated
USING ((SELECT auth.uid())='63d8e063-4755-430c-a582-d25d24416dfa'::uuid AND user_id=(SELECT auth.uid()))
WITH CHECK ((SELECT auth.uid())='63d8e063-4755-430c-a582-d25d24416dfa'::uuid AND user_id=(SELECT auth.uid()));

CREATE TABLE public.pd_push_deliveries (
 appointment_id uuid NOT NULL REFERENCES public.pd_agenda(id) ON DELETE CASCADE,
 starts_at timestamptz NOT NULL,
 subscription_id uuid NOT NULL REFERENCES public.pd_push_subscriptions(id) ON DELETE CASCADE,
 sent_at timestamptz,
 retry_after timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0,
 lease uuid NOT NULL,
 PRIMARY KEY(appointment_id,starts_at,subscription_id)
);
ALTER TABLE public.pd_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pd_push_deliveries FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.pd_push_deliveries TO service_role;
-- Só o servidor pode reservar um envio. Repetições e execuções concorrentes
-- disputam a mesma linha; reagendamento cria uma nova chave por horário.
CREATE FUNCTION public.pd_claim_reminder(p_appointment uuid,p_start timestamptz,p_subscription uuid,p_lease uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE claimed integer;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.pd_agenda WHERE id=p_appointment AND inicio=p_start
   AND status='Agendado' AND inicio>now() AND inicio<=now()+interval '30 minutes') THEN RETURN false; END IF;
 INSERT INTO public.pd_push_deliveries(appointment_id,starts_at,subscription_id,lease,attempts,retry_after)
 VALUES(p_appointment,p_start,p_subscription,p_lease,1,now()+interval '2 minutes')
 ON CONFLICT(appointment_id,starts_at,subscription_id) DO UPDATE
 SET lease=EXCLUDED.lease, attempts=pd_push_deliveries.attempts+1,retry_after=EXCLUDED.retry_after
 WHERE pd_push_deliveries.sent_at IS NULL AND pd_push_deliveries.retry_after<=now()
   AND pd_push_deliveries.attempts<5;
 GET DIAGNOSTICS claimed=ROW_COUNT;
 RETURN claimed=1;
END;
$$;
REVOKE ALL ON FUNCTION public.pd_claim_reminder(uuid,timestamptz,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pd_claim_reminder(uuid,timestamptz,uuid,uuid) TO service_role;
COMMIT;
