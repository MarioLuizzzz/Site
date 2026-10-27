# Aviso 30 minutos antes do atendimento

## O que está implementado

Netlify Scheduled Function `appointment-reminders` executa a cada minuto, mesmo com o site fechado. Ela consulta o Supabase e envia Web Push aos aparelhos autorizados. Só considera atendimentos `Agendado`, futuros, dentro da janela de 30 minutos. Ao reagendar, o novo horário tem um novo lembrete. Ao cancelar ou iniciar/concluir o atendimento, ele deixa de ser elegível.

Entrega depende de internet, permissões, configurações de Foco do iPhone e disponibilidade dos provedores. O minuto do cron e a rede podem causar atraso; não é despertador nem garantia de entrega pontual. Atendimentos criados/reativados com menos de 30 minutos de antecedência recebem o aviso na próxima execução, antes do início. O texto informa a antecedência restante.

## Ativação (obrigatória; código sozinho não ativa o envio)

1. Executar **uma vez** `supabase/notifications.sql` no SQL Editor do mesmo projeto Supabase, depois do esquema inicial. Não reaplicar `schema.sql`.
2. Gerar um par VAPID no seu computador, dentro do repositório: `npm ci` e `npm run push:keys`. Guarde o par; não gere outro a cada deploy. Não publicar nem enviar a chave privada pelo chat.
3. Na Netlify, configurar estas variáveis no ambiente de **produção**, com escopo que inclua **Functions**:

| Nome | Valor |
| --- | --- |
| `VAPID_PUBLIC_KEY` | `publicKey` gerada no passo 2 |
| `VAPID_PRIVATE_KEY` | `privateKey` gerada no passo 2; segredo |
| `VAPID_SUBJECT` | `mailto:SEU_EMAIL` com um e-mail de contato válido |
| `SUPABASE_SERVICE_ROLE_KEY` | chave legada `service_role` do projeto Supabase; segredo com acesso administrativo |

As duas chaves privadas devem ficar somente nas variáveis seguras da Netlify, nunca no repositório, HTML ou chat. Não usar a publishable key em `SUPABASE_SERVICE_ROLE_KEY`. Não colocar variáveis secretas em `netlify.toml`. Um novo deploy é necessário após configurar variáveis.

4. Mesclar a alteração. A Netlify deve executar `npm run build`, publicar `dist` e empacotar `netlify/functions`. `scripts/build.mjs` copia apenas arquivos públicos para `dist`; `.env`, fontes do servidor, SQL e dependências não vão para a CDN.
5. Conferir em Functions que `appointment-reminders` aparece como **Scheduled**, com próxima execução. Agendamentos só executam automaticamente no deploy publicado, não em previews.
6. No iPhone com iOS 16.4+, abrir `/admin/` no Safari, adicionar à Tela de Início, abrir pelo ícone, entrar e tocar **Ativar neste aparelho**. Aceitar a permissão. Cada aparelho precisa ser ativado separadamente.

## Testar no iPhone

- **Testar aviso** verifica apenas exibição/permissão local; não comprova o servidor.
- Para testar o envio real, crie um atendimento de teste para 31 minutos à frente, feche o painel e aguarde cerca de 1–2 minutos. Confira os logs agregados da função e a notificação. Depois remova o atendimento de teste.
- Para testar a antecedência normal, crie um atendimento para mais de 30 minutos à frente e confirme o envio ao entrar na janela de 30 minutos.
- Toque na notificação para abrir o painel. O conteúdo pode aparecer na tela bloqueada: cliente, serviço e horário, conforme ajustes de prévias do iPhone.
- **Desativar** cancela os avisos apenas no aparelho atual. Sair da conta não desativa a assinatura: em dispositivo compartilhado, desative antes de sair ou remova a permissão nos Ajustes.

## Confiabilidade e limites

- Reserva atômica por atendimento + horário + assinatura. Até cinco tentativas, com intervalo mínimo de dois minutos. Uma falha após o provedor aceitar, mas antes de registrar o envio, pode ocasionar reenvio; a mesma tag substitui a notificação anterior quando suportado.
- Assinaturas expiradas (404/410 do provedor) são removidas. Falhas temporárias não são marcadas como entregues.
- Reconsulta o atendimento imediatamente antes do envio. Alteração depois dessa consulta pode disputar com o envio; uma notificação já entregue não pode ser retirada remotamente por esta versão.
- Um lote considera até 100 atendimentos na janela e 100 aparelhos; aplicação pensada para uso individual. A função encerra o lote antes de seu limite de execução e continua nas próximas execuções.
- Não há cache offline de registros privados. A função pública `push-config` retorna somente prontidão e chave VAPID pública. As assinaturas têm RLS do proprietário; o histórico e a função de reserva são exclusivos do servidor.
- Restringe destinos de envio a provedores HTTPS conhecidos (Apple, Google, Mozilla e Microsoft). Logs não contêm nomes, contatos, endpoints nem chaves.
- Se a função falhar por muito tempo, avisos de atendimentos já iniciados não são enviados retroativamente.

## Testes de desenvolvimento

`npm test`: regras de datas/valores, janela de 30 minutos, bloqueio de destinos indevidos, deduplicação, cancelamento/reagendamento e expiração/retry com dependências simuladas. O esquema adicional também foi executado em PostgreSQL local via PGlite para validar RLS e reservas. Nenhum envio real nem escrita no Supabase de produção foi realizado durante a implementação.
