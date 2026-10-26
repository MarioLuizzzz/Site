# Prime Detail — painel privado

Painel em `/admin/`, compatível com hospedagem estática da Netlify. Não altera o `index.html`, o catálogo público ou seus preços. O catálogo do painel é interno e começa vazio; alterações nele não são publicadas automaticamente na vitrine.

## Publicar e usar

1. Revisar e mesclar a branch deste painel na branch de produção da Netlify.
2. Aguardar o deploy e acessar `https://SEU-DOMINIO/admin/`.
3. Entrar com o e-mail e a senha da conta criada em Supabase Authentication.
4. Cadastrar serviços, depois atendimentos e materiais. Os preços e descrições dos atendimentos são cópias do combinado e não mudam quando o serviço é editado.
5. No Safari do iPhone, abrir `/admin/`, Compartilhar → Adicionar à Tela de Início. O painel requer internet; não há suporte offline ou notificações push nesta versão.

Não há link administrativo no menu público. A tela de login e o código são públicos; os registros são protegidos no Supabase por RLS. A chave `sb_publishable_...` pode estar no frontend. Nunca adicionar `service_role`, secret keys, senhas ou tokens de sessão ao repositório.

## Pré-requisitos já configurados pelo proprietário

Projeto: `https://eorupwlmcitkiyczrcvk.supabase.co`.
Conta autorizada: `63d8e063-4755-430c-a582-d25d24416dfa`.
Tabelas: `pd_servicos`, `pd_agenda`, `pd_materiais`, conforme `supabase/schema.sql`. O proprietário informou que executou esse esquema antes da implementação. Não executar novamente em um banco com essas tabelas.

As três tabelas devem negar privilégios a `anon` e permitir SELECT/INSERT/UPDATE/DELETE a `authenticated` somente quando `auth.uid()` for o UID acima. A verificação de UID no navegador é apenas UX; a proteção real depende dessas políticas. A chave administrativa do Supabase contorna RLS e nunca deve ser distribuída. Recomenda-se desabilitar cadastro público em Authentication para este projeto de uso individual.

## Comportamento

- Agenda: calendário mensal, pesquisa e filtros, criação/edição/exclusão, status e pagamento, aviso de sobreposição com opção de continuar.
- A verificação de conflito consulta a agenda antes de salvar, mas não é bloqueio transacional contra gravações simultâneas.
- Serviços: cadastro, edição e ativação/desativação. Desativar preserva histórico.
- Materiais: quantidades fracionadas, unidade, prioridade, edição, exclusão e comprado/pendente.
- A sessão é persistida pelo SDK. Sair remove a sessão local e limpa dados da tela. Não usar em dispositivo compartilhado sem sair.
- Horários exibidos em America/Sao_Paulo. Entrada de horários convertida com UTC−03:00; revisar se a legislação de horário de verão mudar.
- Dados só são confirmados após resposta do banco; erros são mostrados e formulários mantidos. Leitura paginada evita truncamento silencioso em 1.000 linhas.
- `_headers` aplica CSP, no-store e noindex somente ao painel; a página pública é preservada.

## Validação

`node --test tests/core.test.mjs` e `node --check admin/app.mjs`.

Consulta real sem sessão autenticada com a chave pública: as três tabelas retornaram HTTP 401/código PostgreSQL 42501 (acesso negado). Testes de integração DOM com Supabase simulado passaram para criação de serviço, criação/edição de atendimento, material comprado, escape de HTML e limpeza ao sair. A prévia visual no navegador remoto não pôde acessar o servidor local (conexão recusada). Não foram feitas escritas no banco real. É necessário validar login e CRUD com a conta do proprietário após deploy; não foi solicitada nem utilizada a senha.

Checklist após deploy: entrar, criar/editar um serviço, criar/reagendar/concluir um atendimento, criar/marcar comprado um material, sair e confirmar tela de login. Validar também em Safari/iPhone. Recuperação de acesso nesta primeira versão é gerenciada pelo proprietário no painel do Supabase.

## Dependência

`admin/vendor/supabase.js`: bundle UMD de @supabase/supabase-js 2.118.0 (MIT), hospedado localmente para evitar dependência de CDN em runtime. Licença em `admin/vendor/LICENSE-supabase.txt`.
