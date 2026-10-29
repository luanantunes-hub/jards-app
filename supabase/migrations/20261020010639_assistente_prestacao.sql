-- Assistente de IA (Claude e ChatGPT) na prestação de contas: o que o conector precisa para gravar sem sair das regras do app.
--
-- O conector grava com a chave de serviço, que ignora o RLS e as travas que só valem para quem está logado
-- (current_user in ('authenticated', 'anon'), como fn_comprovante_avaliacao_protegida e fn_prestacao_trava_enviado).
-- Então as regras que importam passam a ser conferidas por ele, e o que ele faz fica registrado e desfazível:
--
--  1. canal 'assistente' nos comprovantes (despesas) e nas evidências: a equipe vê de onde veio cada registro;
--  2. fn_mcp_prestacao_pode: "quem edita esta prestação", por pessoa, com a mesma regra de auth_prestacao_pode
--     (o teste assistente_prestacao.test.sql compara as duas);
--  3. assistente_acoes: o que o assistente fez, com o que havia antes, para a equipe ver e desfazer;
--  4. assistente_arquivos: a caixa de entrada dos arquivos que chegam pelo chat, antes de virarem despesa ou evidência;
--  5. assistente_sessoes_envio: o link curto de envio de arquivos pelo navegador (sem login, uso limitado);
--  6. fn_prestacao_avisar_assistente: o aviso à equipe.
--
-- Aditiva e reaplicável. A única coisa trocada é a conferência do canal, por outra que aceita mais um valor.
-- As tabelas novas só têm leitura para a equipe da prestação; quem escreve é o servidor do conector (service role).
-- Aplique esta migration antes de publicar o código que a usa.

-- ─── 1. Canal "assistente" ──────────────────────────────────────────────────

alter table public.prestacao_comprovantes drop constraint if exists prestacao_comprovantes_canal_check;
alter table public.prestacao_comprovantes
  add constraint prestacao_comprovantes_canal_check check (canal = any (array['equipe', 'proponente', 'email', 'assistente']));

alter table public.prestacao_evidencias drop constraint if exists prestacao_evidencias_canal_check;
alter table public.prestacao_evidencias
  add constraint prestacao_evidencias_canal_check check (canal = any (array['equipe', 'proponente', 'assistente']));

-- ─── 2. Quem edita a prestação, por pessoa ──────────────────────────────────

-- A regra de auth_prestacao_pode (can_access_prestacao + auth_prestacao_papel_permite) sem depender de auth.uid(), para o
-- servidor do conector perguntar em nome da pessoa que autorizou o assistente. Não inclui o super admin: o conector nunca
-- age como administrador da plataforma. O módulo precisa estar em vigor (modulos_ativos), como nas políticas de escrita.
create or replace function public.fn_mcp_prestacao_pode(p_usuario uuid, p_prestacao uuid, p_acao text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.prestacoes_contas p
      join public.organization_members membro on membro.organization_id = p.organization_id and membro.user_id = p_usuario
      join public.organizations organizacao on organizacao.id = p.organization_id
     where p.id = p_prestacao
       and 'prestacao' = any (organizacao.modulos_ativos)
       and 'prestacao' = any (membro.modulos_acesso)
       and public.auth_prestacao_papel_permite(membro.papel, membro.prestacao_funcao, p_acao)
  );
$$;

revoke all on function public.fn_mcp_prestacao_pode(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fn_mcp_prestacao_pode(uuid, uuid, text) to service_role;

-- ─── 3. O que o assistente fez ──────────────────────────────────────────────

create table if not exists public.assistente_acoes (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  usuario_id uuid references auth.users(id) on delete set null,
  chave_id uuid references public.mcp_api_keys(id) on delete set null,
  plataforma text not null default 'outro' check (plataforma in ('claude', 'chatgpt', 'outro')),
  ferramenta text not null check (length(ferramenta) between 1 and 80),
  acao text not null check (acao in ('criar', 'atualizar', 'retirar', 'verificar')),
  tabela text check (tabela is null or length(tabela) <= 80),
  registro_id uuid,
  resumo text not null check (length(resumo) between 1 and 500),
  antes jsonb,
  depois jsonb,
  desfeita_em timestamptz,
  desfeita_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists assistente_acoes_prestacao_idx on public.assistente_acoes (prestacao_id, created_at desc);
create index if not exists assistente_acoes_registro_idx on public.assistente_acoes (registro_id) where registro_id is not null;

-- ─── 4. Caixa de entrada dos arquivos ───────────────────────────────────────

create table if not exists public.assistente_arquivos (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  usuario_id uuid references auth.users(id) on delete set null,
  chave_id uuid references public.mcp_api_keys(id) on delete set null,
  plataforma text not null default 'outro' check (plataforma in ('claude', 'chatgpt', 'outro')),
  -- Por onde o arquivo chegou: anexo do ChatGPT, endereço de envio do Claude, página de envio ou texto colado no chat.
  origem text not null check (origem in ('chatgpt', 'url_assinada', 'pagina', 'texto')),
  -- Para que o arquivo vem: vira despesa ou evidência (o caminho no Storage já é o da pasta certa).
  destino text not null check (destino in ('despesa', 'evidencia')),
  -- aguardando: o endereço foi dado e o arquivo ainda não chegou; recebido: chegou e foi conferido;
  -- registrado: virou despesa ou evidência; descartado: expirou ou foi retirado.
  situacao text not null default 'aguardando' check (situacao in ('aguardando', 'recebido', 'registrado', 'descartado')),
  nome_arquivo text not null check (length(nome_arquivo) between 1 and 300),
  tipo_real text check (tipo_real is null or length(tipo_real) <= 40),
  tamanho_bytes bigint check (tamanho_bytes is null or (tamanho_bytes >= 0 and tamanho_bytes <= 15728640)),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  storage_path text not null,
  registro_tabela text check (registro_tabela is null or registro_tabela in ('prestacao_comprovantes', 'prestacao_evidencias')),
  registro_id uuid,
  detalhe text check (detalhe is null or length(detalhe) <= 500),
  expira_em timestamptz not null,
  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists assistente_arquivos_prestacao_idx on public.assistente_arquivos (prestacao_id, situacao);
create index if not exists assistente_arquivos_expira_idx on public.assistente_arquivos (expira_em) where situacao in ('aguardando', 'recebido');
-- O mesmo conteúdo não entra duas vezes na mesma prestação (enquanto vale).
create unique index if not exists assistente_arquivos_conteudo_key
  on public.assistente_arquivos (prestacao_id, destino, sha256)
  where sha256 is not null and situacao in ('recebido', 'registrado');

-- ─── 5. Link de envio de arquivos pelo navegador ────────────────────────────

create table if not exists public.assistente_sessoes_envio (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  usuario_id uuid references auth.users(id) on delete set null,
  chave_id uuid references public.mcp_api_keys(id) on delete set null,
  plataforma text not null default 'outro' check (plataforma in ('claude', 'chatgpt', 'outro')),
  -- Só o hash do código fica guardado: quem lê o banco não consegue abrir o link.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  destino text not null check (destino in ('despesa', 'evidencia')),
  max_arquivos integer not null default 10 check (max_arquivos between 1 and 10),
  enviados integer not null default 0 check (enviados >= 0),
  expira_em timestamptz not null,
  revogada_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists assistente_sessoes_envio_prestacao_idx on public.assistente_sessoes_envio (prestacao_id, created_at desc);

-- ─── Acesso: a equipe lê, só o servidor escreve ─────────────────────────────

alter table public.assistente_acoes enable row level security;
alter table public.assistente_arquivos enable row level security;
alter table public.assistente_sessoes_envio enable row level security;

revoke all on table public.assistente_acoes from anon, authenticated;
revoke all on table public.assistente_arquivos from anon, authenticated;
revoke all on table public.assistente_sessoes_envio from anon, authenticated;
grant select on table public.assistente_acoes to authenticated;
grant select on table public.assistente_arquivos to authenticated;

do $politicas$
declare
  tabela text;
begin
  foreach tabela in array array['assistente_acoes', 'assistente_arquivos'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tabela and policyname = tabela || ': quem ve a prestacao le') then
      execute format('create policy %I on public.%I for select to authenticated using (public.can_access_prestacao(prestacao_id))', tabela || ': quem ve a prestacao le', tabela);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tabela and policyname = tabela || ': leitura sem assinatura') then
      execute format('create policy %I on public.%I for select to authenticated using (public.auth_prestacao_le_sem_assinatura(prestacao_id))', tabela || ': leitura sem assinatura', tabela);
    end if;
  end loop;
end
$politicas$;
-- assistente_sessoes_envio: sem política nenhuma. O código do link só o servidor confere.

-- ─── 6. Aviso à equipe ──────────────────────────────────────────────────────

-- Como fn_prestacao_avisar_captura, para o que o assistente fez. p_chave junta os avisos repetidos de uma mesma ação.
create or replace function public.fn_prestacao_avisar_assistente(p_prestacao_id uuid, p_titulo text, p_mensagem text, p_chave text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.prestacoes_contas%rowtype;
begin
  select * into p from public.prestacoes_contas where id = p_prestacao_id;
  if not found then return; end if;
  perform public.fn_emit_notification(
    'prestacao_assistente', p.organization_id, public.prestacao_responsavel(p.id),
    p_titulo, left(p_mensagem, 240),
    '/prestacoes/' || p.id || '/comprovantes',
    'prestacao', 'normal', 'prestacao', p.id, null,
    'prestacao_assistente:' || p_chave, '{}'::jsonb, null);
end;
$$;

revoke all on function public.fn_prestacao_avisar_assistente(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.fn_prestacao_avisar_assistente(uuid, text, text, text) to service_role;

comment on table public.assistente_acoes is
  'O que o assistente de IA (Claude, ChatGPT) fez na prestação, com o que havia antes. A equipe lê e desfaz pelo app; só o servidor do conector escreve.';
comment on table public.assistente_arquivos is
  'Caixa de entrada dos arquivos que chegam pelo chat, antes de virarem despesa ou evidência. Expiram se ninguém os registrar.';
comment on table public.assistente_sessoes_envio is
  'Links curtos de envio de arquivos pelo navegador, sem login. Só o hash do código fica guardado; só o servidor lê.';
