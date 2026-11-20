-- P8.7: grade horária dos recursos humanos (LIE).
--
-- A PCP da Lei de Incentivo ao Esporte leva a grade horária dos recursos
-- humanos num modelo próprio da DPPIE (Portaria MESP 10/2026, art. 65, VII):
-- por cargo, as atribuições, a quantidade de contratados, o horário de cada
-- dia da semana, a carga horária semanal, a forma de contratação (CLT, RPA ou
-- PJ) e a formação acadêmica. O cargo pode se ligar ao item do orçamento que o
-- paga, para conferir quem foi pago com o que a grade prevê; ativar outra
-- versão do orçamento leva o cargo para o item correspondente, como já faz com
-- despesas, metas e bens. O retrato do envio (P4.6) passa a levar os cargos.

create table if not exists public.prestacao_cargos (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  no_id uuid references public.prestacao_orcamento_nos(id) on delete set null,
  cargo text not null check (char_length(btrim(cargo)) between 1 and 200),
  atribuicoes text check (atribuicoes is null or char_length(atribuicoes) <= 1000),
  quantidade integer not null default 1 check (quantidade between 1 and 10000),
  -- Um texto por dia, de segunda (1) a domingo (7); vazio no dia sem trabalho.
  horarios text[] not null default '{}'
    check (cardinality(horarios) <= 7 and char_length(array_to_string(horarios, '')) <= 420),
  carga_semanal numeric(4, 1) check (carga_semanal is null or carga_semanal between 0 and 168),
  contratacao text check (contratacao in ('clt', 'rpa', 'pj')),
  formacao text check (formacao is null or char_length(formacao) <= 300),
  ordem integer not null default 0,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.prestacao_cargos is 'Grade horária dos recursos humanos (LIE, Portaria MESP 10/2026, art. 65, VII): um cargo por linha.';

create index if not exists prestacao_cargos_prestacao_idx on public.prestacao_cargos (prestacao_id, ordem, created_at);
create index if not exists prestacao_cargos_no_idx on public.prestacao_cargos (no_id) where no_id is not null;

-- O item do cargo é um item do orçamento da mesma prestação.
create or replace function public.fn_prestacao_cargo_item()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.no_id is not null and not exists (
    select 1 from public.prestacao_orcamento_nos n
    where n.id = new.no_id and n.prestacao_id = new.prestacao_id and n.tipo = 'item'
  ) then
    raise exception 'item_invalido' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_cargos_item'
                 and tgrelid = 'public.prestacao_cargos'::regclass) then
    create trigger prestacao_cargos_item
      before insert or update of no_id, prestacao_id on public.prestacao_cargos
      for each row execute function public.fn_prestacao_cargo_item();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_cargos_updated_at'
                 and tgrelid = 'public.prestacao_cargos'::regclass) then
    create trigger prestacao_cargos_updated_at
      before update on public.prestacao_cargos
      for each row execute function public.set_prestacao_updated_at();
  end if;
end
$$;

-- ─── Acesso: lê quem acessa a prestação e o convidado do financeiro; escreve quem edita ─

alter table public.prestacao_cargos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_cargos'
                 and policyname = 'prestacao_cargos: acesso pela prestacao') then
    create policy "prestacao_cargos: acesso pela prestacao" on public.prestacao_cargos
      for all to authenticated
      using (public.can_access_prestacao(prestacao_id))
      with check (public.can_access_prestacao(prestacao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_cargos'
                 and policyname = 'prestacao_cargos: papel insere') then
    create policy "prestacao_cargos: papel insere" on public.prestacao_cargos
      as restrictive for insert to authenticated
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_cargos: papel edita" on public.prestacao_cargos
      as restrictive for update to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'))
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_cargos: papel apaga" on public.prestacao_cargos
      as restrictive for delete to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_cargos'
                 and policyname = 'prestacao_cargos: convidado le') then
    create policy "prestacao_cargos: convidado le" on public.prestacao_cargos
      for select to authenticated using (public.auth_convidado_ve(prestacao_id, 'financeiro'));
  end if;
end
$$;

-- Sem assinatura, a equipe continua lendo (P5.6): a mesma regra de leitura,
-- gerada como na migration 20261009120000, só para esta tabela.
do $$
declare
  regra record;
  condicao text;
  nome text;
begin
  for regra in
    select tablename, policyname, qual
    from pg_policies
    where schemaname = 'public'
      and tablename = 'prestacao_cargos'
      and permissive = 'PERMISSIVE'
      and cmd in ('ALL', 'SELECT')
      and qual like '%can_access_prestacao(%'
    order by tablename, cmd desc, policyname
  loop
    nome := regra.tablename || ': leitura sem assinatura';
    continue when exists (select 1 from pg_policies
                          where schemaname = 'public' and tablename = regra.tablename and policyname = nome);
    condicao := replace(regra.qual, 'can_access_prestacao(', 'auth_prestacao_le_sem_assinatura(');
    execute format('create policy %I on public.%I for select to authenticated using (%s)',
                   nome, regra.tablename, condicao);
  end loop;
end
$$;

revoke all on public.prestacao_cargos from anon;
grant select, insert, update, delete on public.prestacao_cargos to authenticated;
grant all on public.prestacao_cargos to service_role;

-- ─── Ativar outra versão do orçamento leva o cargo para o item correspondente ─
-- Mesma função da P3.5 (20261007180000), com o bloco dos cargos.

create or replace function public.fn_prestacao_orcamento_ativar_versao(p_versao_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  alvo public.prestacao_orcamento_versoes%rowtype;
  anterior uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = 'insufficient_privilege';
  end if;
  select * into alvo from public.prestacao_orcamento_versoes where id = p_versao_id;
  if alvo.id is null or not public.can_access_prestacao(alvo.prestacao_id) then
    raise exception 'prestacao_inexistente' using errcode = 'no_data_found';
  end if;
  if not public.auth_prestacao_pode(alvo.prestacao_id, 'decidir') then
    raise exception 'sem_permissao' using errcode = 'insufficient_privilege';
  end if;

  perform 1 from public.prestacoes_contas where id = alvo.prestacao_id for update;
  anterior := (select v.id from public.prestacao_orcamento_versoes v
               where v.prestacao_id = alvo.prestacao_id and v.ativa);
  if anterior = alvo.id then
    return;
  end if;

  update public.prestacao_orcamento_versoes set ativa = false where id = anterior;
  update public.prestacao_orcamento_versoes set ativa = true where id = alvo.id;

  update public.prestacao_comprovantes c
  set no_id = correspondente.id
  from public.prestacao_orcamento_nos atual, public.prestacao_orcamento_nos correspondente
  where c.prestacao_id = alvo.prestacao_id
    and atual.id = c.no_id
    and atual.versao_id = anterior
    and correspondente.versao_id = alvo.id
    and correspondente.tipo = 'item'
    and (correspondente.origem_no_id = atual.id or atual.origem_no_id = correspondente.id);

  update public.prestacao_metas m
  set no_id = correspondente.id
  from public.prestacao_orcamento_nos atual, public.prestacao_orcamento_nos correspondente
  where m.prestacao_id = alvo.prestacao_id
    and atual.id = m.no_id
    and atual.versao_id = anterior
    and correspondente.versao_id = alvo.id
    and correspondente.tipo <> 'item'
    and (correspondente.origem_no_id = atual.id or atual.origem_no_id = correspondente.id);

  update public.prestacao_bens b
  set no_id = correspondente.id
  from public.prestacao_orcamento_nos atual, public.prestacao_orcamento_nos correspondente
  where b.prestacao_id = alvo.prestacao_id
    and atual.id = b.no_id
    and atual.versao_id = anterior
    and correspondente.versao_id = alvo.id
    and correspondente.tipo = 'item'
    and (correspondente.origem_no_id = atual.id or atual.origem_no_id = correspondente.id);

  update public.prestacao_cargos rh
  set no_id = correspondente.id
  from public.prestacao_orcamento_nos atual, public.prestacao_orcamento_nos correspondente
  where rh.prestacao_id = alvo.prestacao_id
    and atual.id = rh.no_id
    and atual.versao_id = anterior
    and correspondente.versao_id = alvo.id
    and correspondente.tipo = 'item'
    and (correspondente.origem_no_id = atual.id or atual.origem_no_id = correspondente.id);
end;
$$;

-- ─── Retrato do envio: os cargos vão junto ─────────────────────────────────
-- Mesma função da P8.6 (20261010180000), com a linha dos cargos.

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
    'beneficiarios', coalesce((select jsonb_agg(to_jsonb(bf) order by bf.nome, bf.id) from public.prestacao_beneficiarios bf where bf.prestacao_id = p_prestacao_id), '[]'),
    'turmas', coalesce((select jsonb_agg(to_jsonb(tu) order by tu.ordem, tu.created_at, tu.id) from public.prestacao_turmas tu where tu.prestacao_id = p_prestacao_id), '[]'),
    'cargos', coalesce((select jsonb_agg(to_jsonb(rh) order by rh.ordem, rh.created_at, rh.id) from public.prestacao_cargos rh where rh.prestacao_id = p_prestacao_id), '[]'),
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
