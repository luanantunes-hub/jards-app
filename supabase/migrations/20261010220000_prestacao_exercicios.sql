-- P9.2: o exercício da prestação anual.
--
-- Na saúde (Anexo LXXXVI-A da PRC GM/MS 5/2017, art. 81), cada exercício com
-- execução tem a sua prestação anual, até 30/04 do ano seguinte, e a final
-- vem depois do último. Até aqui havia uma só prestação parcial valendo por
-- vez: o envio, as marcações e os arquivos do checklist ganham o exercício
-- (0 quando não há, como em todos os regimes até a saúde). Na parcial de um
-- regime de prestação periódica, o exercício é obrigatório; um envio vale por
-- etapa e exercício, e a versão conta dentro deles. Os envios, marcações e
-- arquivos que já existem ficam com 0 e continuam iguais.

alter table public.prestacao_envios
  add column if not exists exercicio smallint not null default 0;
alter table public.prestacao_envio_checklist
  add column if not exists exercicio smallint not null default 0;
alter table public.prestacao_envio_arquivos
  add column if not exists exercicio smallint not null default 0;

do $$
declare
  t text;
begin
  foreach t in array array['prestacao_envios', 'prestacao_envio_checklist', 'prestacao_envio_arquivos'] loop
    if not exists (select 1 from pg_constraint where conname = t || '_exercicio_check' and conrelid = ('public.' || t)::regclass) then
      execute format($f$alter table public.%I add constraint %I check (exercicio = 0 or (etapa = 'parcial' and exercicio between 2000 and 2100))$f$,
                     t, t || '_exercicio_check');
    end if;
  end loop;
end
$$;

comment on column public.prestacao_envios.exercicio is
  'Ano da prestação anual (P9.2), na parcial dos regimes de prestação periódica; 0 quando não há.';
comment on column public.prestacao_envio_checklist.exercicio is
  'Ano da prestação anual a que a marcação se refere (P9.2); 0 quando não há.';
comment on column public.prestacao_envio_arquivos.exercicio is
  'Ano da prestação anual a que o arquivo se refere (P9.2); 0 quando não há.';

-- A versão conta por etapa e exercício; a marcação é uma por item, etapa e exercício.
alter table public.prestacao_envios drop constraint if exists prestacao_envios_prestacao_id_etapa_versao_key;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prestacao_envios_versao_do_exercicio') then
    alter table public.prestacao_envios add constraint prestacao_envios_versao_do_exercicio unique (prestacao_id, etapa, exercicio, versao);
  end if;
end
$$;
-- Um envio valendo por etapa e exercício.
drop index if exists public.prestacao_envios_vigente_idx;
create unique index if not exists prestacao_envios_vigente_idx on public.prestacao_envios (prestacao_id, etapa, exercicio) where situacao = 'vigente';
alter table public.prestacao_envio_checklist drop constraint if exists prestacao_envio_checklist_item;
alter table public.prestacao_envio_checklist add constraint prestacao_envio_checklist_item unique (prestacao_id, etapa, exercicio, tipo, codigo);
drop index if exists public.prestacao_envio_arquivos_item_idx;
create index if not exists prestacao_envio_arquivos_item_idx on public.prestacao_envio_arquivos (prestacao_id, etapa, exercicio, codigo, created_at);

-- ─── Registrar o envio, com o exercício ─────────────────────────────────────
-- Mesma função da P8.7 (20261010190000), com o exercício: a validação, o envio
-- valendo e a versão por etapa e exercício, e o checklist do retrato só com as
-- marcações e os arquivos do exercício.

drop function if exists public.fn_prestacao_registrar_envio(uuid, text, date, text, jsonb, text);

create or replace function public.fn_prestacao_registrar_envio(
  p_prestacao_id uuid,
  p_etapa text,
  p_enviado_em date,
  p_protocolo text default null,
  p_manifesto jsonb default null,
  p_comentario text default null,
  p_exercicio smallint default 0)
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
  ano smallint := coalesce(p_exercicio, 0);
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
  -- O exercício só existe na parcial e é um ano; nos regimes de prestação anual (a saúde), ele é obrigatório.
  if ano <> 0 and (p_etapa <> 'parcial' or ano not between 2000 and 2100) then
    raise exception 'exercicio_invalido' using errcode = 'P0001';
  end if;
  if p_etapa = 'parcial' and ano = 0 and exists (
       select 1 from public.prestacao_regimes rg
        where rg.id = p.regime_id and coalesce(rg.parametros -> 'prestacaoParcial' -> 'modalidades', '[]'::jsonb) ? 'periodica') then
    raise exception 'exercicio_obrigatorio' using errcode = 'P0001';
  end if;
  if p_enviado_em is null or p_enviado_em > current_date then
    raise exception 'envio_data_invalida' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.prestacao_envios where prestacao_id = p_prestacao_id and etapa = p_etapa
                and exercicio = ano and situacao = 'vigente') then
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
    'exercicio', nullif(ano, 0),
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
                              where ck.prestacao_id = p_prestacao_id and ck.etapa = p_etapa and ck.exercicio = ano), '[]'),
      'arquivos', coalesce((select jsonb_agg(to_jsonb(ea) order by ea.codigo, ea.created_at) from public.prestacao_envio_arquivos ea
                             where ea.prestacao_id = p_prestacao_id and ea.etapa = p_etapa and ea.exercicio = ano), '[]')),
    'verificacoes', coalesce((select jsonb_agg(to_jsonb(vf) order by vf.check_codigo, vf.chave) from public.prestacao_verificacoes vf where vf.prestacao_id = p_prestacao_id), '[]')
  );

  select coalesce(max(versao), 0) + 1 into numero from public.prestacao_envios
   where prestacao_id = p_prestacao_id and etapa = p_etapa and exercicio = ano;

  insert into public.prestacao_envios (prestacao_id, etapa, exercicio, versao, enviado_em, protocolo, sistema, comentario,
                                       regime_codigo, regime_versao, retrato, retrato_sha256, manifesto, guarda_marco, guarda_ate)
  values (p_prestacao_id, p_etapa, ano, numero, p_enviado_em, left(nullif(trim(coalesce(p_protocolo, '')), ''), 120), r.sistema_oficial, comentario,
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

revoke all on function public.fn_prestacao_registrar_envio(uuid, text, date, text, jsonb, text, smallint) from public, anon;
grant execute on function public.fn_prestacao_registrar_envio(uuid, text, date, text, jsonb, text, smallint) to authenticated, service_role;
