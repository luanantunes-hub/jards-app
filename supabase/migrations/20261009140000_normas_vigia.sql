-- P1.10: vigia normativo mínimo.
--
-- Todo dia, depois da publicação do Diário Oficial, a edge function
-- agente-normativo baixa a seção 1 no INLABS, faz a triagem sem IA
-- (supabase/functions/_shared/vigia-dou.ts) e guarda aqui os atos que podem
-- mudar uma regra dos regimes. O super admin é avisado e confere cada ato em
-- /admin/normas. É a base do agente normativo da fase 6, que vai ler esses
-- atos e propor novas versões dos regimes.
--
-- Só o super admin lê. Quem grava é a função, com a chave de serviço; a
-- conferência passa por fn_normas_documento_conferir.

-- ─── Fontes ─────────────────────────────────────────────────────────────────

create table if not exists public.normas_fontes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  tipo text not null check (tipo in ('dou_inlabs')),
  url text,
  ativa boolean not null default true,
  configuracao jsonb not null default '{}'::jsonb,
  ultima_coleta_em timestamptz,
  created_at timestamptz not null default now()
);

insert into public.normas_fontes (codigo, nome, tipo, url, configuracao)
values ('dou_secao1', 'Diário Oficial da União, seção 1 (INLABS)', 'dou_inlabs', 'https://inlabs.in.gov.br',
        '{"edicoes": ["DO1", "DO1E"]}'::jsonb)
on conflict (codigo) do nothing;

-- ─── Atos guardados ─────────────────────────────────────────────────────────

create table if not exists public.normas_documentos (
  id uuid primary key default gen_random_uuid(),
  fonte_id uuid not null references public.normas_fontes(id) on delete cascade,
  -- dou:<idMateria>; a mesma matéria não entra duas vezes.
  chave text not null unique,
  publicado_em date not null,
  edicao text,
  orgao text not null,
  tipo_ato text,
  titulo text,
  ementa text,
  texto text not null check (char_length(texto) <= 200000),
  url text,
  motivos text[] not null default '{}',
  -- sha256 do XML do ato, para conferir depois que é o mesmo documento.
  hash text not null,
  situacao text not null default 'novo' check (situacao in ('novo', 'conferido', 'descartado')),
  nota text check (char_length(nota) <= 1000),
  conferido_por uuid references auth.users(id) on delete set null,
  conferido_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists normas_documentos_situacao_idx on public.normas_documentos (situacao, publicado_em desc);

-- ─── Execuções do agente ────────────────────────────────────────────────────
-- Uma linha por coleta: quantos atos leu, quantos eram rotina, quantos
-- passaram na triagem e quantos eram novos. O custo fica para a fase 6 (IA).

create table if not exists public.agente_execucoes (
  id uuid primary key default gen_random_uuid(),
  agente text not null check (agente in ('vigia_dou')),
  fonte_id uuid references public.normas_fontes(id) on delete set null,
  referencia date not null,
  situacao text not null default 'rodando' check (situacao in ('rodando', 'ok', 'sem_edicao', 'falhou')),
  lidos integer not null default 0 check (lidos >= 0),
  rotina integer not null default 0 check (rotina >= 0),
  relevantes integer not null default 0 check (relevantes >= 0),
  novos integer not null default 0 check (novos >= 0),
  detalhe text check (char_length(detalhe) <= 2000),
  custo numeric(12, 6) not null default 0,
  iniciada_em timestamptz not null default now(),
  terminada_em timestamptz
);

create index if not exists agente_execucoes_recentes_idx on public.agente_execucoes (agente, iniciada_em desc);

-- ─── Acesso ─────────────────────────────────────────────────────────────────

alter table public.normas_fontes enable row level security;
alter table public.normas_documentos enable row level security;
alter table public.agente_execucoes enable row level security;

revoke all on public.normas_fontes, public.normas_documentos, public.agente_execucoes from anon, authenticated;
grant select on public.normas_fontes, public.normas_documentos, public.agente_execucoes to authenticated;

do $$
declare
  tabela text;
begin
  foreach tabela in array array['normas_fontes', 'normas_documentos', 'agente_execucoes'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tabela
                   and policyname = tabela || ': super admin le') then
      execute format('create policy %I on public.%I for select to authenticated using (public.is_jards_super_admin())',
                     tabela || ': super admin le', tabela);
    end if;
  end loop;
end
$$;

-- O super admin marca o ato como conferido (pode mudar regra) ou descartado.
create or replace function public.fn_normas_documento_conferir(p_documento_id uuid, p_situacao text, p_nota text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_jards_super_admin() then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if p_situacao not in ('novo', 'conferido', 'descartado') then
    raise exception 'situacao_invalida' using errcode = '22023';
  end if;
  update public.normas_documentos
  set situacao = p_situacao,
      nota = nullif(left(btrim(coalesce(p_nota, '')), 1000), ''),
      conferido_por = case when p_situacao = 'novo' then null else auth.uid() end,
      conferido_em = case when p_situacao = 'novo' then null else now() end
  where id = p_documento_id;
  if not found then
    raise exception 'documento_inexistente' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.fn_normas_documento_conferir(uuid, text, text) from public, anon;
grant execute on function public.fn_normas_documento_conferir(uuid, text, text) to authenticated;

-- ─── Aviso ao super admin ───────────────────────────────────────────────────
-- Chamado pela função ao fim da coleta: atos novos para conferir, ou a falha
-- da coleta. Um aviso por execução e pessoa.

create or replace function public.fn_normas_avisar(p_execucao_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_execucao public.agente_execucoes%rowtype;
  v_titulo text;
  v_mensagem text;
  v_prioridade text := 'normal';
  v_avisos integer := 0;
  v_pessoa record;
begin
  select * into v_execucao from public.agente_execucoes where id = p_execucao_id;
  if not found then return 0; end if;

  if v_execucao.situacao = 'falhou' then
    v_titulo := 'Vigia do Diário Oficial falhou';
    v_mensagem := 'A coleta de ' || to_char(v_execucao.referencia, 'DD/MM/YYYY') || ' não terminou: '
      || coalesce(v_execucao.detalhe, 'sem detalhe') || '.';
    v_prioridade := 'alta';
  elsif v_execucao.novos > 0 then
    v_titulo := 'Diário Oficial de ' || to_char(v_execucao.referencia, 'DD/MM') || ': '
      || v_execucao.novos || case when v_execucao.novos = 1 then ' ato para conferir' else ' atos para conferir' end;
    select string_agg(coalesce(nullif(d.titulo, ''), d.tipo_ato || ' de ' || split_part(d.orgao, '/', 1)), '; ' order by d.created_at)
      into v_mensagem
    from (select * from public.normas_documentos
          where publicado_em = v_execucao.referencia and situacao = 'novo'
          order by created_at limit 3) d;
    v_mensagem := coalesce(v_mensagem, 'Atos que podem mudar uma regra dos regimes.');
  else
    return 0;
  end if;

  for v_pessoa in
    select p.id,
           (select m.organization_id from public.organization_members m
            where m.user_id = p.id order by m.created_at limit 1) as organizacao
    from public.profiles p
    where p.jards_super_admin
  loop
    perform public.fn_emit_notification(
      'normas_vigia', v_pessoa.organizacao, v_pessoa.id,
      v_titulo, left(v_mensagem, 240), '/admin/normas', 'sistema', v_prioridade,
      'agente_execucao', v_execucao.id, null,
      'normas_vigia:' || v_execucao.id || ':' || v_pessoa.id,
      jsonb_build_object('novos', v_execucao.novos, 'situacao', v_execucao.situacao), null);
    v_avisos := v_avisos + 1;
  end loop;
  return v_avisos;
end;
$$;
revoke all on function public.fn_normas_avisar(uuid) from public, anon, authenticated;
grant execute on function public.fn_normas_avisar(uuid) to service_role;

-- ─── Rotina diária ──────────────────────────────────────────────────────────
-- Chama a função pelo pg_net. O endereço e o segredo ficam no cofre do banco
-- (vault: agente_normativo_url e agente_normativo_segredo), fora do
-- repositório; sem eles, a rotina não faz nada.

create or replace function public.fn_agente_normativo_disparar()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url text;
  v_segredo text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'agente_normativo_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'agente_normativo_segredo';
  if coalesce(v_url, '') = '' or coalesce(v_segredo, '') = '' then
    raise notice 'agente normativo sem endereço ou segredo no cofre';
    return null;
  end if;
  return net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-agente-segredo', v_segredo),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000);
end;
$$;
revoke all on function public.fn_agente_normativo_disparar() from public, anon, authenticated;

-- 8h07 em Brasília, depois da publicação do Diário.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'jards-agente-normativo') then
      perform cron.unschedule('jards-agente-normativo');
    end if;
    perform cron.schedule('jards-agente-normativo', '7 11 * * *', 'select public.fn_agente_normativo_disparar();');
  end if;
end
$$;
