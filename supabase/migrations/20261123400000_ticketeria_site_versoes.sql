-- Ticketeria: o histórico de versões das páginas do site (construtor de sites, passo 4; plano em docs/acoes-futuras/estudos/plano-ticketeria-cms-e-integracoes.md).
--
-- Cada vez que uma página é PUBLICADA, o banco guarda os blocos publicados (origem 'publicada'). Ficam as 20 versões mais recentes de cada página. O produtor volta a uma versão
-- restaurando-a no RASCUNHO: o que está no ar não muda até ele publicar, e o rascunho de antes fica guardado na mesma lista (origem 'rascunho_guardado'), para restaurar nunca perder trabalho.
-- Só os blocos são versionados (não o título, o endereço nem a descrição da página).
--
-- ticketeria_site_versoes: quem edita a Ticketeria lê; só o banco grava (o gatilho de publicar e a função de restaurar).
-- Funções:
--   fn_ticketeria_site_versao_guardar(página, origem, blocos, usuário): interna (ninguém a chama de fora); guarda e apara para as 20 mais novas;
--   fn_ticketeria_site_versao_publicada(): o gatilho; ao mudar os blocos publicados, guarda a versão (não repete a mesma da última publicada);
--   fn_ticketeria_site_restaurar_versao(versão) → { pagina_id, guardado }: quem edita o site troca o rascunho pelos blocos da versão, guardando antes o rascunho de agora (se for diferente e
--     não vazio). Erros: versao_inexistente (P0002) e sem_permissao (42501).
-- Começa pelo que já está no ar: cada página publicada hoje ganha a sua primeira versão.
--
-- Expansão: tabela nova, funções e gatilho novos, e a cópia inicial. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_site_versoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pagina_id uuid not null references public.ticketeria_site_paginas (id) on delete cascade,
  origem text not null,
  blocos jsonb not null,
  criado_por uuid,
  created_at timestamptz not null default clock_timestamp(),
  constraint ticketeria_site_versoes_origem_check check (origem in ('publicada', 'rascunho_guardado')),
  constraint ticketeria_site_versoes_blocos_check check (jsonb_typeof(blocos) = 'array' and jsonb_array_length(blocos) <= 60)
);

create index if not exists ticketeria_site_versoes_pagina_idx on public.ticketeria_site_versoes (pagina_id, created_at desc);
create index if not exists ticketeria_site_versoes_org_idx on public.ticketeria_site_versoes (organization_id);

alter table public.ticketeria_site_versoes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_site_versoes' and policyname = 'ticketeria_site_versoes: le') then
    create policy "ticketeria_site_versoes: le" on public.ticketeria_site_versoes for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
end
$$;

revoke all on public.ticketeria_site_versoes from anon, authenticated;
grant select on public.ticketeria_site_versoes to authenticated;

-- Guarda uma versão e deixa só as 20 mais novas da página.
create or replace function public.fn_ticketeria_site_versao_guardar(p_pagina uuid, p_origem text, p_blocos jsonb, p_usuario uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_id uuid;
begin
  select organization_id into v_org from public.ticketeria_site_paginas where id = p_pagina;
  if v_org is null then
    return null;
  end if;
  insert into public.ticketeria_site_versoes (organization_id, pagina_id, origem, blocos, criado_por) values (v_org, p_pagina, p_origem, p_blocos, p_usuario) returning id into v_id;
  delete from public.ticketeria_site_versoes
  where pagina_id = p_pagina and id not in (select id from public.ticketeria_site_versoes where pagina_id = p_pagina order by created_at desc, id desc limit 20);
  return v_id;
end;
$$;

-- O gatilho: publicou, guardou (sem repetir a mesma versão da última publicada).
create or replace function public.fn_ticketeria_site_versao_publicada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ultima jsonb;
begin
  if new.blocos_publicados is null or new.blocos_publicados is not distinct from old.blocos_publicados then
    return null;
  end if;
  select v.blocos into v_ultima from public.ticketeria_site_versoes v where v.pagina_id = new.id and v.origem = 'publicada' order by v.created_at desc, v.id desc limit 1;
  if v_ultima is distinct from new.blocos_publicados then
    perform public.fn_ticketeria_site_versao_guardar(new.id, 'publicada', new.blocos_publicados, auth.uid());
  end if;
  return null;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'ticketeria_site_versao_publicada' and tgrelid = 'public.ticketeria_site_paginas'::regclass) then
    create trigger ticketeria_site_versao_publicada
      after update of blocos_publicados on public.ticketeria_site_paginas
      for each row execute function public.fn_ticketeria_site_versao_publicada();
  end if;
end
$$;

-- Restaurar: o rascunho passa a ser a versão; o rascunho de antes (se diferente e não vazio) fica guardado.
create or replace function public.fn_ticketeria_site_restaurar_versao(p_versao uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_versao public.ticketeria_site_versoes%rowtype;
  v_rascunho jsonb;
  v_guardado boolean := false;
begin
  select * into v_versao from public.ticketeria_site_versoes where id = p_versao;
  if v_versao.id is null then
    raise exception 'versao_inexistente' using errcode = 'P0002';
  end if;
  if not public.auth_ticketeria_pode(v_versao.organization_id, 'editar') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  select blocos into v_rascunho from public.ticketeria_site_paginas where id = v_versao.pagina_id for update;
  if v_rascunho is distinct from v_versao.blocos and jsonb_array_length(coalesce(v_rascunho, '[]'::jsonb)) > 0 then
    perform public.fn_ticketeria_site_versao_guardar(v_versao.pagina_id, 'rascunho_guardado', v_rascunho, auth.uid());
    v_guardado := true;
  end if;
  update public.ticketeria_site_paginas set blocos = v_versao.blocos where id = v_versao.pagina_id;
  return jsonb_build_object('pagina_id', v_versao.pagina_id, 'guardado', v_guardado);
end;
$$;

-- O que está no ar hoje vira a primeira versão de cada página publicada.
insert into public.ticketeria_site_versoes (organization_id, pagina_id, origem, blocos, created_at)
select p.organization_id, p.id, 'publicada', p.blocos_publicados, coalesce(p.publicada_em, now())
from public.ticketeria_site_paginas p
where p.blocos_publicados is not null and not exists (select 1 from public.ticketeria_site_versoes v where v.pagina_id = p.id);

revoke execute on function public.fn_ticketeria_site_versao_guardar(uuid, text, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_site_versao_publicada() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_site_restaurar_versao(uuid) from public, anon;
grant execute on function public.fn_ticketeria_site_restaurar_versao(uuid) to authenticated;
