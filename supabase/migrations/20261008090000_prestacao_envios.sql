-- P4.6: envio registrado com retrato travado.
--
-- fn_prestacao_registrar_envio grava o envio (etapa, data, protocolo, quem
-- registrou) e um retrato do que foi enviado, montado aqui no banco a partir
-- das tabelas: a prestação, o regime, o orçamento em uso, as alterações, as
-- despesas aceitas ou pendentes com os fornecedores, os pagamentos, as
-- contas, as importações e os lançamentos do extrato, o objeto (metas,
-- locais, atividades, evidências, distribuição, bens, peças e relatório),
-- as devoluções, o checklist da etapa e as verificações. O retrato leva o
-- SHA-256 do próprio texto e, quando vem do pacote (P4.5), o manifesto com o
-- SHA-256 de cada arquivo. Na prestação final, o status passa a "enviado"
-- pelas regras de sempre (verificação feita e nenhum bloqueio aberto) e a
-- data do envio vai para data_envio.
--
-- O que foi enviado fica listado em prestacao_envio_itens (tabela, registro e
-- arquivo). Enquanto o envio vale, essas linhas não mudam nem saem; dentro do
-- prazo de guarda do regime, não saem, e os arquivos não saem nem são
-- trocados no bucket; a prestação com envio em guarda não é apagada. A
-- guarda conta do marco do regime (na Rouanet, 5 anos do fim da vigência);
-- sem a data do marco (decisão final, nos demais), vale até ela ser
-- registrada. As funções do banco e o service role não passam pela trava.
--
-- fn_prestacao_reabrir_envio pede o motivo, marca o envio como reaberto e,
-- na final, devolve a prestação para "ajuste solicitado": as linhas voltam a
-- mudar, a guarda continua, e a correção é registrada como versão nova.
-- O envio é imutável: só a reabertura muda a linha. Idempotente.

create table if not exists public.prestacao_envios (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  etapa text not null check (etapa in ('final', 'parcial')),
  versao integer not null check (versao >= 1),
  enviado_em date not null,
  protocolo text check (protocolo is null or char_length(protocolo) <= 120),
  sistema text,
  comentario text check (comentario is null or char_length(comentario) <= 2000),
  regime_codigo text,
  regime_versao integer,
  retrato jsonb not null,
  retrato_sha256 text not null check (retrato_sha256 ~ '^[0-9a-f]{64}$'),
  manifesto jsonb,
  guarda_marco text,
  guarda_ate date,
  situacao text not null default 'vigente' check (situacao in ('vigente', 'reaberto')),
  registrado_por uuid references auth.users(id) on delete set null default auth.uid(),
  registrado_em timestamptz not null default now(),
  reaberto_em timestamptz,
  reaberto_por uuid references auth.users(id) on delete set null,
  motivo_reabertura text check (motivo_reabertura is null or char_length(motivo_reabertura) between 10 and 2000),
  unique (prestacao_id, etapa, versao),
  constraint prestacao_envios_reabertura check ((situacao = 'reaberto') = (reaberto_em is not null and motivo_reabertura is not null))
);

-- Um envio valendo por etapa.
create unique index if not exists prestacao_envios_vigente_idx on public.prestacao_envios (prestacao_id, etapa) where situacao = 'vigente';

create table if not exists public.prestacao_envio_itens (
  id bigint generated always as identity primary key,
  envio_id uuid not null references public.prestacao_envios(id) on delete cascade,
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  tabela text not null,
  registro_id uuid not null,
  storage_path text
);

create index if not exists prestacao_envio_itens_registro_idx on public.prestacao_envio_itens (tabela, registro_id);
create index if not exists prestacao_envio_itens_arquivo_idx on public.prestacao_envio_itens (storage_path) where storage_path is not null;
create index if not exists prestacao_envio_itens_envio_idx on public.prestacao_envio_itens (envio_id);

-- ─── Acesso: lê quem acessa a prestação; escreve só a função ────────────────

alter table public.prestacao_envios enable row level security;
alter table public.prestacao_envio_itens enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_envios'
                 and policyname = 'prestacao_envios: leitura pela prestacao') then
    create policy "prestacao_envios: leitura pela prestacao" on public.prestacao_envios
      for select to authenticated using (public.can_access_prestacao(prestacao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_envio_itens'
                 and policyname = 'prestacao_envio_itens: leitura pela prestacao') then
    create policy "prestacao_envio_itens: leitura pela prestacao" on public.prestacao_envio_itens
      for select to authenticated using (public.can_access_prestacao(prestacao_id));
  end if;
end
$$;

revoke all on public.prestacao_envios from anon, authenticated;
revoke all on public.prestacao_envio_itens from anon, authenticated;
grant select on public.prestacao_envios to authenticated;
grant select on public.prestacao_envio_itens to authenticated;
grant all on public.prestacao_envios to service_role;
grant all on public.prestacao_envio_itens to service_role;

-- ─── O envio não muda: só a reabertura, uma vez ─────────────────────────────

create or replace function public.fn_prestacao_envio_imutavel()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  livres text[] := array['situacao', 'reaberto_em', 'reaberto_por', 'motivo_reabertura', 'guarda_ate'];
begin
  if tg_op = 'DELETE' then
    if current_user in ('authenticated', 'anon') then
      raise exception 'envio_imutavel' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if (to_jsonb(new) - livres) is distinct from (to_jsonb(old) - livres)
     or (old.situacao = 'reaberto' and (new.situacao, new.reaberto_em, new.reaberto_por, new.motivo_reabertura)
                                   is distinct from (old.situacao, old.reaberto_em, old.reaberto_por, old.motivo_reabertura))
     or (old.guarda_ate is not null and new.guarda_ate is distinct from old.guarda_ate) then
    raise exception 'envio_imutavel' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_envios_imutavel'
                 and tgrelid = 'public.prestacao_envios'::regclass) then
    create trigger prestacao_envios_imutavel
      before update or delete on public.prestacao_envios
      for each row execute function public.fn_prestacao_envio_imutavel();
  end if;
end
$$;

-- ─── Trava das linhas enviadas ──────────────────────────────────────────────

-- 'vigente': está num envio que vale (não muda nem sai); 'guarda': num envio
-- dentro do prazo de guarda (não sai); null: livre.
create or replace function public.fn_prestacao_trava_do_registro(p_tabela text, p_registro uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when bool_or(e.situacao = 'vigente') then 'vigente'
    when bool_or(e.guarda_ate is null or e.guarda_ate >= current_date) then 'guarda'
  end
  from public.prestacao_envio_itens i
  join public.prestacao_envios e on e.id = i.envio_id
  where i.tabela = p_tabela and i.registro_id = p_registro;
$$;

create or replace function public.fn_prestacao_trava_enviado()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  trava text;
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  trava := public.fn_prestacao_trava_do_registro(tg_table_name, old.id);
  if tg_op = 'DELETE' and trava is not null then
    raise exception 'enviado_guardado' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and trava = 'vigente' then
    raise exception 'enviado_travado' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['prestacao_comprovantes', 'prestacao_pagamentos', 'prestacao_envio_arquivos', 'prestacao_devolucoes',
                           'prestacao_extrato_importacoes', 'prestacao_evidencias', 'prestacao_pecas', 'prestacao_bens'] loop
    if not exists (select 1 from pg_trigger where tgname = t || '_trava_enviado' and tgrelid = ('public.' || t)::regclass) then
      execute format('create trigger %I before update or delete on public.%I for each row execute function public.fn_prestacao_trava_enviado()',
                     t || '_trava_enviado', t);
    end if;
  end loop;
end
$$;

-- A prestação com envio em guarda não é apagada.
create or replace function public.fn_prestacao_guarda_da_prestacao()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon') and public.fn_prestacao_em_guarda(old.id) then
    raise exception 'enviado_guardado' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create or replace function public.fn_prestacao_em_guarda(p_prestacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.prestacao_envios e
                  where e.prestacao_id = p_prestacao_id
                    and (e.situacao = 'vigente' or e.guarda_ate is null or e.guarda_ate >= current_date));
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacoes_contas_guarda'
                 and tgrelid = 'public.prestacoes_contas'::regclass) then
    create trigger prestacoes_contas_guarda
      before delete on public.prestacoes_contas
      for each row execute function public.fn_prestacao_guarda_da_prestacao();
  end if;
end
$$;

-- O arquivo enviado não sai nem é trocado no bucket enquanto a guarda vale.
create or replace function public.fn_prestacao_arquivo_guardado(p_nome text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.prestacao_envio_itens i
                   join public.prestacao_envios e on e.id = i.envio_id
                  where i.storage_path = p_nome
                    and (e.situacao = 'vigente' or e.guarda_ate is null or e.guarda_ate >= current_date));
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'documentos: enviado nao sai') then
    create policy "documentos: enviado nao sai" on storage.objects
      as restrictive for delete to authenticated
      using (bucket_id <> 'documentos' or not public.fn_prestacao_arquivo_guardado(name));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'documentos: enviado nao muda') then
    create policy "documentos: enviado nao muda" on storage.objects
      as restrictive for update to authenticated
      using (bucket_id <> 'documentos' or not public.fn_prestacao_arquivo_guardado(name))
      with check (bucket_id <> 'documentos' or not public.fn_prestacao_arquivo_guardado(name));
  end if;
end
$$;

revoke all on function public.fn_prestacao_trava_do_registro(text, uuid) from public, anon;
revoke all on function public.fn_prestacao_em_guarda(uuid) from public, anon;
revoke all on function public.fn_prestacao_arquivo_guardado(text) from public, anon;
grant execute on function public.fn_prestacao_trava_do_registro(text, uuid) to authenticated, service_role;
grant execute on function public.fn_prestacao_em_guarda(uuid) to authenticated, service_role;
grant execute on function public.fn_prestacao_arquivo_guardado(text) to authenticated, service_role;

-- ─── Registrar o envio ──────────────────────────────────────────────────────

create or replace function public.fn_prestacao_registrar_envio(
  p_prestacao_id uuid,
  p_etapa text,
  p_enviado_em date,
  p_protocolo text default null,
  p_manifesto jsonb default null,
  p_comentario text default null)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  p public.prestacoes_contas%rowtype;
  r record;
  g jsonb;
  base date;
  qtd integer;
  guarda date;
  retrato jsonb;
  envio uuid;
  numero integer;
  comentario text := left(nullif(trim(coalesce(p_comentario, '')), ''), 2000);
  bloqueios integer;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  select * into p from public.prestacoes_contas where id = p_prestacao_id for update;
  if not found or not (public.is_jards_super_admin() or public.can_access_prestacao(p_prestacao_id)) then
    raise exception 'prestacao_inexistente' using errcode = 'P0002';
  end if;
  if not public.auth_prestacao_pode(p_prestacao_id, 'decidir') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if p_etapa is null or p_etapa not in ('final', 'parcial') then
    raise exception 'etapa_invalida' using errcode = 'P0001';
  end if;
  if p_enviado_em is null or p_enviado_em > current_date then
    raise exception 'envio_data_invalida' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.prestacao_envios where prestacao_id = p_prestacao_id and etapa = p_etapa and situacao = 'vigente') then
    raise exception 'envio_vigente' using errcode = 'P0001';
  end if;
  if p_manifesto is not null and (jsonb_typeof(p_manifesto) <> 'object'
       or jsonb_typeof(p_manifesto -> 'arquivos') is distinct from 'array'
       or jsonb_array_length(p_manifesto -> 'arquivos') > 5000
       or octet_length(p_manifesto::text) > 5000000) then
    raise exception 'manifesto_invalido' using errcode = 'P0001';
  end if;

  if p_etapa = 'final' then
    -- O status anda pelas regras de sempre (verificação e bloqueios em fn_prestacao_mudar_status).
    if p.status in ('rascunho', 'ajuste_solicitado') then
      perform public.fn_prestacao_mudar_status(p_prestacao_id, 'revisao_interna', comentario);
      p.status := 'revisao_interna';
    end if;
    if p.status = 'revisao_interna' then
      perform public.fn_prestacao_mudar_status(p_prestacao_id, 'enviado', coalesce(comentario, 'Envio registrado'));
    elsif p.status <> 'enviado' then
      raise exception 'transicao_invalida' using errcode = 'P0001';
    end if;
    update public.prestacoes_contas set data_envio = p_enviado_em where id = p_prestacao_id;
    select * into p from public.prestacoes_contas where id = p_prestacao_id;
  else
    if p.verificada_em is null then
      raise exception 'verificacao_pendente' using errcode = 'P0001';
    end if;
    select count(*) into bloqueios from public.prestacao_verificacoes
     where prestacao_id = p_prestacao_id and status = 'aberta' and severidade = 'bloqueio';
    if bloqueios > 0 then
      raise exception 'bloqueios_abertos' using errcode = 'P0001', detail = bloqueios::text;
    end if;
  end if;

  select id, codigo, versao, nome, sistema_oficial, parametros into r
    from public.prestacao_regimes where id = p.regime_id;

  -- Guarda pelo marco do regime; sem a data do marco, vale até ela existir.
  g := case when r.parametros is not null then r.parametros -> 'guarda' end;
  qtd := case when g ->> 'quantidade' ~ '^[0-9]+$' then (g ->> 'quantidade')::integer end;
  base := case g ->> 'marco'
            when 'fim_vigencia' then p.data_fim_execucao
            when 'fim_exercicio' then make_date(extract(year from p.data_fim_execucao)::integer, 12, 31)
            when 'envio_prestacao' then p_enviado_em
          end;
  guarda := case
              when base is null or qtd is null then null
              when coalesce(g ->> 'unidade', 'anos') = 'anos' then (base + make_interval(years => qtd))::date
              when g ->> 'unidade' = 'meses' then (base + make_interval(months => qtd))::date
              else base + qtd
            end;

  retrato := jsonb_build_object(
    'retrato', 1,
    'etapa', p_etapa,
    'prestacao', to_jsonb(p),
    'regime', case when r.id is null then null else jsonb_build_object('id', r.id, 'codigo', r.codigo, 'versao', r.versao, 'nome', r.nome) end,
    'orcamento', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at, n.id)
                             from public.prestacao_orcamento_nos n
                             join public.prestacao_orcamento_versoes v on v.id = n.versao_id
                            where v.prestacao_id = p_prestacao_id and v.ativa), '[]'),
    'alteracoes', coalesce((select jsonb_agg(to_jsonb(a) order by a.numero) from public.prestacao_alteracoes a where a.prestacao_id = p_prestacao_id), '[]'),
    'despesas', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at, c.id) from public.prestacao_comprovantes c
                           where c.prestacao_id = p_prestacao_id and c.status <> 'rejeitado'), '[]'),
    'fornecedores', coalesce((select jsonb_agg(to_jsonb(f) order by f.id) from public.prestacao_fornecedores f
                               where f.id in (select fornecedor_id from public.prestacao_comprovantes
                                               where prestacao_id = p_prestacao_id and status <> 'rejeitado')), '[]'),
    'pagamentos', coalesce((select jsonb_agg(to_jsonb(g2) order by g2.data, g2.id) from public.prestacao_pagamentos g2
                             join public.prestacao_comprovantes c on c.id = g2.despesa_id
                            where g2.prestacao_id = p_prestacao_id and c.status <> 'rejeitado'), '[]'),
    'contas', coalesce((select jsonb_agg(to_jsonb(cb) order by cb.created_at) from public.prestacao_contas_bancarias cb where cb.prestacao_id = p_prestacao_id), '[]'),
    'extratos', coalesce((select jsonb_agg(to_jsonb(ei) order by ei.periodo_inicio nulls last, ei.created_at) from public.prestacao_extrato_importacoes ei where ei.prestacao_id = p_prestacao_id), '[]'),
    'lancamentos', coalesce((select jsonb_agg(to_jsonb(l) order by l.data, l.id) from public.prestacao_lancamentos l where l.prestacao_id = p_prestacao_id), '[]'),
    'metas', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at, m.id) from public.prestacao_metas m where m.prestacao_id = p_prestacao_id), '[]'),
    'locais', coalesce((select jsonb_agg(to_jsonb(lc) order by lc.created_at, lc.id) from public.prestacao_locais lc where lc.prestacao_id = p_prestacao_id), '[]'),
    'atividades', coalesce((select jsonb_agg(to_jsonb(at) order by at.data_realizacao nulls last, at.id) from public.prestacao_atividades at where at.prestacao_id = p_prestacao_id), '[]'),
    'evidencias', coalesce((select jsonb_agg(to_jsonb(ev) order by ev.created_at, ev.id) from public.prestacao_evidencias ev where ev.prestacao_id = p_prestacao_id), '[]'),
    'distribuicao', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at, d.id) from public.prestacao_distribuicao d where d.prestacao_id = p_prestacao_id), '[]'),
    'bens', coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at, b.id) from public.prestacao_bens b where b.prestacao_id = p_prestacao_id), '[]'),
    'pecas', coalesce((select jsonb_agg(to_jsonb(pc) order by pc.created_at, pc.id) from public.prestacao_pecas pc where pc.prestacao_id = p_prestacao_id), '[]'),
    'relatorio', coalesce((select jsonb_agg(to_jsonb(rl) order by rl.secao) from public.prestacao_relatorio rl where rl.prestacao_id = p_prestacao_id), '[]'),
    'devolucoes', coalesce((select jsonb_agg(to_jsonb(dv) order by dv.ordem, dv.created_at) from public.prestacao_devolucoes dv where dv.prestacao_id = p_prestacao_id), '[]'),
    'checklist', jsonb_build_object(
      'marcacoes', coalesce((select jsonb_agg(to_jsonb(ck) order by ck.tipo, ck.codigo) from public.prestacao_envio_checklist ck
                              where ck.prestacao_id = p_prestacao_id and ck.etapa = p_etapa), '[]'),
      'arquivos', coalesce((select jsonb_agg(to_jsonb(ea) order by ea.codigo, ea.created_at) from public.prestacao_envio_arquivos ea
                             where ea.prestacao_id = p_prestacao_id and ea.etapa = p_etapa), '[]')),
    'verificacoes', coalesce((select jsonb_agg(to_jsonb(vf) order by vf.check_codigo, vf.chave) from public.prestacao_verificacoes vf where vf.prestacao_id = p_prestacao_id), '[]')
  );

  select coalesce(max(versao), 0) + 1 into numero from public.prestacao_envios where prestacao_id = p_prestacao_id and etapa = p_etapa;

  insert into public.prestacao_envios (prestacao_id, etapa, versao, enviado_em, protocolo, sistema, comentario,
                                       regime_codigo, regime_versao, retrato, retrato_sha256, manifesto, guarda_marco, guarda_ate)
  values (p_prestacao_id, p_etapa, numero, p_enviado_em, left(nullif(trim(coalesce(p_protocolo, '')), ''), 120), r.sistema_oficial, comentario,
          r.codigo, r.versao, retrato, encode(digest(convert_to(retrato::text, 'UTF8'), 'sha256'), 'hex'), p_manifesto,
          g ->> 'marco', guarda)
  returning id into envio;

  -- O que foi enviado, para as travas.
  insert into public.prestacao_envio_itens (envio_id, prestacao_id, tabela, registro_id, storage_path)
  select envio, p_prestacao_id, x.tabela, x.id, x.caminho from (
    select 'prestacao_comprovantes' as tabela, (e ->> 'id')::uuid as id, e ->> 'storage_path' as caminho from jsonb_array_elements(retrato -> 'despesas') e
    union all select 'prestacao_pagamentos', (e ->> 'id')::uuid, null from jsonb_array_elements(retrato -> 'pagamentos') e
    union all select 'prestacao_envio_arquivos', (e ->> 'id')::uuid, e ->> 'storage_path' from jsonb_array_elements(retrato -> 'checklist' -> 'arquivos') e
    union all select 'prestacao_devolucoes', (e ->> 'id')::uuid, e ->> 'storage_path' from jsonb_array_elements(retrato -> 'devolucoes') e
    union all select 'prestacao_extrato_importacoes', (e ->> 'id')::uuid, e ->> 'storage_path' from jsonb_array_elements(retrato -> 'extratos') e
    union all select 'prestacao_evidencias', (e ->> 'id')::uuid, e ->> 'storage_path' from jsonb_array_elements(retrato -> 'evidencias') e
    union all select 'prestacao_pecas', (e ->> 'id')::uuid, e ->> 'storage_path' from jsonb_array_elements(retrato -> 'pecas') e
    union all select 'prestacao_bens', (e ->> 'id')::uuid, e ->> 'doacao_storage_path' from jsonb_array_elements(retrato -> 'bens') e
    union all select 'prestacao_bens', (e ->> 'id')::uuid, e ->> 'aceite_storage_path' from jsonb_array_elements(retrato -> 'bens') e
             where e ->> 'aceite_storage_path' is not null
    union all select 'prestacao_bens', (b ->> 'id')::uuid, c ->> 'storage_path'
                from jsonb_array_elements(retrato -> 'bens') b,
                     jsonb_array_elements(case when jsonb_typeof(b -> 'cotacoes') = 'array' then b -> 'cotacoes' else '[]'::jsonb end) c
               where c ->> 'storage_path' is not null
  ) x;

  return envio;
end;
$$;

-- ─── Reabrir o envio ────────────────────────────────────────────────────────

create or replace function public.fn_prestacao_reabrir_envio(p_envio_id uuid, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e public.prestacao_envios%rowtype;
  motivo text := trim(coalesce(p_motivo, ''));
  status_atual public.status_prestacao;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  select * into e from public.prestacao_envios where id = p_envio_id for update;
  if not found or not (public.is_jards_super_admin() or public.can_access_prestacao(e.prestacao_id)) then
    raise exception 'envio_inexistente' using errcode = 'P0002';
  end if;
  if not public.auth_prestacao_pode(e.prestacao_id, 'decidir') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if e.situacao <> 'vigente' then
    raise exception 'envio_ja_reaberto' using errcode = 'P0001';
  end if;
  if char_length(motivo) < 10 then
    raise exception 'reabertura_sem_motivo' using errcode = 'P0001';
  end if;

  update public.prestacao_envios
     set situacao = 'reaberto', reaberto_em = now(), reaberto_por = auth.uid(), motivo_reabertura = left(motivo, 2000)
   where id = p_envio_id;

  select status into status_atual from public.prestacoes_contas where id = e.prestacao_id;
  if e.etapa = 'final' and status_atual = 'enviado' then
    perform public.fn_prestacao_mudar_status(e.prestacao_id, 'ajuste_solicitado', 'Envio reaberto: ' || left(motivo, 1900));
  end if;
  return p_envio_id;
end;
$$;

revoke all on function public.fn_prestacao_registrar_envio(uuid, text, date, text, jsonb, text) from public, anon;
revoke all on function public.fn_prestacao_reabrir_envio(uuid, text) from public, anon;
grant execute on function public.fn_prestacao_registrar_envio(uuid, text, date, text, jsonb, text) to authenticated, service_role;
grant execute on function public.fn_prestacao_reabrir_envio(uuid, text) to authenticated, service_role;
