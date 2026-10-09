-- P8.5: relação de beneficiados da prestação (LIE, aba BENEFICIADOS).
--
-- O formulário PCP/PCF da Lei de Incentivo ao Esporte pede a relação dos
-- diretamente beneficiados: evento ou modalidade, nome, endereço, telefone,
-- idade e os benefícios recebidos (lanche, transporte, uniforme...), com o
-- total feminino e masculino (Portaria MESP 10/2026, art. 65, III, e art. 68,
-- III). Na formação esportiva regular, ao menos 50% dos alunos precisam ser
-- da rede pública (Decreto 12.861/2026, art. 18): o formulário não tem esse
-- campo, a prestação guarda.
--
-- São dados pessoais, muitas vezes de crianças e adolescentes: a tabela guarda
-- só o que o formulário e a regra da rede pública pedem (idade, e não a data
-- de nascimento; sem documento). Lê quem acessa a prestação e o convidado do
-- objeto; escreve quem edita. A página pública do patrocinador não a lê.
-- O retrato do envio (P4.6) passa a levar a relação.

create table if not exists public.prestacao_beneficiarios (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 200),
  modalidade text check (modalidade is null or char_length(modalidade) <= 200),
  sexo text check (sexo is null or sexo in ('feminino', 'masculino')),
  idade smallint check (idade is null or idade between 0 and 120),
  rede_publica boolean,
  telefone text check (telefone is null or char_length(telefone) <= 40),
  endereco text check (endereco is null or char_length(endereco) <= 300),
  beneficios text[] not null default '{}'
    check (cardinality(beneficios) <= 12 and char_length(array_to_string(beneficios, '|')) <= 600),
  observacoes text check (observacoes is null or char_length(observacoes) <= 1000),
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.prestacao_beneficiarios is
  'Relação de diretamente beneficiados (LIE, aba BENEFICIADOS): dados pessoais, só o que o formulário e a regra da rede pública pedem.';
comment on column public.prestacao_beneficiarios.rede_publica is
  'Aluno da rede pública (true), da rede privada (false) ou não informado (null): na formação esportiva regular, ao menos 50% da rede pública.';
comment on column public.prestacao_beneficiarios.beneficios is
  'Tipos de benefício recebidos (lanche, transporte, uniforme...): viram as colunas BENEFÍCIOS do formulário.';

create index if not exists prestacao_beneficiarios_prestacao_idx on public.prestacao_beneficiarios (prestacao_id, nome);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_beneficiarios_updated_at'
                 and tgrelid = 'public.prestacao_beneficiarios'::regclass) then
    create trigger prestacao_beneficiarios_updated_at
      before update on public.prestacao_beneficiarios
      for each row execute function public.set_prestacao_updated_at();
  end if;
end
$$;

-- ─── Acesso: lê quem acessa a prestação e o convidado do objeto; escreve quem edita ─

alter table public.prestacao_beneficiarios enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_beneficiarios'
                 and policyname = 'prestacao_beneficiarios: acesso pela prestacao') then
    create policy "prestacao_beneficiarios: acesso pela prestacao" on public.prestacao_beneficiarios
      for all to authenticated
      using (public.can_access_prestacao(prestacao_id))
      with check (public.can_access_prestacao(prestacao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_beneficiarios'
                 and policyname = 'prestacao_beneficiarios: papel insere') then
    create policy "prestacao_beneficiarios: papel insere" on public.prestacao_beneficiarios
      as restrictive for insert to authenticated
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_beneficiarios: papel edita" on public.prestacao_beneficiarios
      as restrictive for update to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'))
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_beneficiarios: papel apaga" on public.prestacao_beneficiarios
      as restrictive for delete to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_beneficiarios'
                 and policyname = 'prestacao_beneficiarios: convidado le') then
    create policy "prestacao_beneficiarios: convidado le" on public.prestacao_beneficiarios
      for select to authenticated using (public.auth_convidado_ve(prestacao_id, 'objeto'));
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
      and tablename = 'prestacao_beneficiarios'
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

revoke all on public.prestacao_beneficiarios from anon;
grant select, insert, update, delete on public.prestacao_beneficiarios to authenticated;
grant all on public.prestacao_beneficiarios to service_role;

-- ─── Retrato do envio: a relação de beneficiados vai junto ──────────────────
-- Mesma função da P4.6 (20261008090000), com a linha dos beneficiados.

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
