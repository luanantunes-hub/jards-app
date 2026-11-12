-- PD6.4 (primeiro corte): abastecimento e quilometragem do motorista.
--
-- producao_deslocamentos ganha o odômetro na saída e na chegada (em km), que dão a distância realmente rodada. producao_abastecimentos: cada
-- abastecimento de um deslocamento (litros, combustível, posto, quando e quem registrou). O motorista registra pelo celular, na
-- folha dele (/minha-folha), sem ser membro da organização: a função fn_equipe_registrar_viagem confere que quem chama é a pessoa
-- convidada, com convite não revogado, e que ela é o MOTORISTA daquele deslocamento, e só então grava (security definer). A produção
-- vê e corrige pelo painel, com as regras de acesso do deslocamento.
--
-- Sem dinheiro: o valor do abastecimento e o custo do combustível entram com o financeiro (nota fiscal do posto); aqui só o que
-- se mede (litros e km). Sem fila offline neste corte (sem internet, a folha avisa e a pessoa tenta de novo). fn_equipe_folha
-- (mesma assinatura e regras) devolve também, só ao motorista, os odômetros e os abastecimentos que ELE registrou.
--
-- Acesso da tabela: o do deslocamento (quem lê o deslocamento lê os abastecimentos; quem edita e vê o deslocamento escreve).
-- Sem histórico (litros e hora ficam na própria linha). Apagar: sai com o deslocamento; apagar a pessoa só solta quem registrou.
--
-- Expansão: duas colunas novas e anuláveis, uma tabela nova e vazia, uma função de gatilho, uma função da pessoa convidada e a
-- fn_equipe_folha trocada (create or replace, mesma assinatura e mesmas permissões). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.producao_deslocamentos add column if not exists odometro_saida_km integer;
alter table public.producao_deslocamentos add column if not exists odometro_chegada_km integer;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'producao_deslocamentos_odometro_saida_check') then
    alter table public.producao_deslocamentos add constraint producao_deslocamentos_odometro_saida_check check (odometro_saida_km is null or odometro_saida_km between 0 and 9999999);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'producao_deslocamentos_odometro_chegada_check') then
    alter table public.producao_deslocamentos add constraint producao_deslocamentos_odometro_chegada_check check (odometro_chegada_km is null or odometro_chegada_km between 0 and 9999999);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'producao_deslocamentos_odometro_periodo_check') then
    alter table public.producao_deslocamentos add constraint producao_deslocamentos_odometro_periodo_check check (odometro_saida_km is null or odometro_chegada_km is null or odometro_chegada_km >= odometro_saida_km);
  end if;
end
$$;

create table if not exists public.producao_abastecimentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  deslocamento_id uuid not null references public.producao_deslocamentos (id) on delete cascade,
  pessoa_id uuid references public.producao_pessoas (id) on delete set null,
  litros numeric(7, 2) not null,
  combustivel text not null default 'flex',
  posto text,
  quando timestamptz not null default now(),
  notas text,
  created_at timestamptz not null default now(),
  constraint producao_abastecimentos_litros_check check (litros between 0.1 and 9999),
  constraint producao_abastecimentos_combustivel_check check (combustivel in ('gasolina', 'etanol', 'flex', 'diesel_s10', 'diesel_s500')),
  constraint producao_abastecimentos_posto_check check (posto is null or char_length(btrim(posto)) between 1 and 200),
  constraint producao_abastecimentos_notas_check check (notas is null or char_length(btrim(notas)) between 1 and 500)
);

create index if not exists producao_abastecimentos_org_idx on public.producao_abastecimentos (organization_id);
create index if not exists producao_abastecimentos_deslocamento_idx on public.producao_abastecimentos (deslocamento_id, quando);
create index if not exists producao_abastecimentos_pessoa_idx on public.producao_abastecimentos (pessoa_id) where pessoa_id is not null;

-- Coerência: a organização e o deslocamento não mudam; o deslocamento e a pessoa são da organização.
-- Erros (check_violation): organizacao_nao_muda, deslocamento_nao_muda, deslocamento_de_outra_organizacao, pessoa_de_outra_organizacao.
create or replace function public.fn_producao_abastecimento_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.deslocamento_id is distinct from old.deslocamento_id then
    raise exception 'deslocamento_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_deslocamentos d where d.id = new.deslocamento_id and d.organization_id = new.organization_id) then
    raise exception 'deslocamento_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.pessoa_id is not null and not exists (select 1 from public.producao_pessoas p where p.id = new.pessoa_id and p.organization_id = new.organization_id) then
    raise exception 'pessoa_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_abastecimentos_coerencia
  before insert or update of organization_id, deslocamento_id, pessoa_id on public.producao_abastecimentos
  for each row execute function public.fn_producao_abastecimento_coerencia();

alter table public.producao_abastecimentos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_abastecimentos' and policyname = 'producao_abastecimentos: le') then
    create policy "producao_abastecimentos: le" on public.producao_abastecimentos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_deslocamentos d where d.id = producao_abastecimentos.deslocamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_abastecimentos' and policyname = 'producao_abastecimentos: leitura sem assinatura') then
    create policy "producao_abastecimentos: leitura sem assinatura" on public.producao_abastecimentos for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_deslocamentos d where d.id = producao_abastecimentos.deslocamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_abastecimentos' and policyname = 'producao_abastecimentos: insere') then
    create policy "producao_abastecimentos: insere" on public.producao_abastecimentos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_deslocamentos d where d.id = producao_abastecimentos.deslocamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_abastecimentos' and policyname = 'producao_abastecimentos: edita') then
    create policy "producao_abastecimentos: edita" on public.producao_abastecimentos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_deslocamentos d where d.id = producao_abastecimentos.deslocamento_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_deslocamentos d where d.id = producao_abastecimentos.deslocamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_abastecimentos' and policyname = 'producao_abastecimentos: apaga') then
    create policy "producao_abastecimentos: apaga" on public.producao_abastecimentos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_deslocamentos d where d.id = producao_abastecimentos.deslocamento_id));
  end if;
end
$$;

-- A viagem pelo motorista: grava os odômetros e, se vier, um abastecimento. Só o MOTORISTA do deslocamento, pessoa convidada com
-- convite não revogado e a produção em vigor (como fn_equipe_responder). Quem não informa um valor (nulo) não o apaga.
-- Devolve 'ok' ou o motivo: sem_acesso, nao_e_motorista, data_cancelada, odometro_invalido, litros_invalidos, combustivel_invalido, nada_a_registrar.
create or replace function public.fn_equipe_registrar_viagem(
  p_deslocamento uuid, p_odometro_saida integer, p_odometro_chegada integer, p_litros numeric, p_combustivel text, p_posto text
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_desl public.producao_deslocamentos%rowtype;
  v_pessoa uuid;
  v_saida integer;
  v_chegada integer;
begin
  if auth.uid() is null then
    return 'sem_acesso';
  end if;
  select d.* into v_desl from public.producao_deslocamentos d where d.id = p_deslocamento;
  if not found then
    return 'sem_acesso';
  end if;
  select p.id into v_pessoa
  from public.producao_acessos_equipe a
  join public.producao_pessoas p on p.id = a.pessoa_id and not p.arquivada and p.organization_id = v_desl.organization_id
  join public.organizations o on o.id = a.organization_id
  where a.user_id = auth.uid() and a.revogado_em is null and a.organization_id = v_desl.organization_id
    and 'producao' = any (o.modulos_ativos)
  limit 1;
  if v_pessoa is null then
    return 'sem_acesso';
  end if;
  if v_desl.motorista_id is distinct from v_pessoa then
    return 'nao_e_motorista';
  end if;
  if exists (select 1 from public.producao_datas d where d.id = v_desl.data_id and d.situacao = 'cancelada') then
    return 'data_cancelada';
  end if;
  if (p_odometro_saida is not null and (p_odometro_saida < 0 or p_odometro_saida > 9999999))
     or (p_odometro_chegada is not null and (p_odometro_chegada < 0 or p_odometro_chegada > 9999999)) then
    return 'odometro_invalido';
  end if;
  v_saida := coalesce(p_odometro_saida, v_desl.odometro_saida_km);
  v_chegada := coalesce(p_odometro_chegada, v_desl.odometro_chegada_km);
  if v_saida is not null and v_chegada is not null and v_chegada < v_saida then
    return 'odometro_invalido';
  end if;
  if p_litros is not null then
    if p_litros < 0.1 or p_litros > 9999 then
      return 'litros_invalidos';
    end if;
    if p_combustivel is null or p_combustivel not in ('gasolina', 'etanol', 'flex', 'diesel_s10', 'diesel_s500') then
      return 'combustivel_invalido';
    end if;
  end if;
  if p_odometro_saida is null and p_odometro_chegada is null and p_litros is null then
    return 'nada_a_registrar';
  end if;
  if p_odometro_saida is not null or p_odometro_chegada is not null then
    update public.producao_deslocamentos set odometro_saida_km = v_saida, odometro_chegada_km = v_chegada where id = p_deslocamento;
  end if;
  if p_litros is not null then
    insert into public.producao_abastecimentos (organization_id, deslocamento_id, pessoa_id, litros, combustivel, posto)
    values (v_desl.organization_id, p_deslocamento, v_pessoa, p_litros, p_combustivel, nullif(btrim(coalesce(p_posto, '')), ''));
  end if;
  return 'ok';
end;
$$;

-- A folha de uma data: só para quem está escalado nela (o texto de 20261114500000 com os odômetros e os abastecimentos do motorista).
create or replace function public.fn_equipe_folha(p_data_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_escala public.producao_escalas%rowtype;
  v_org uuid;
  v_data record;
  v_grupos text[];
begin
  select e.* into v_escala
  from public.producao_acessos_equipe a
  join public.producao_pessoas p on p.id = a.pessoa_id and not p.arquivada
  join public.producao_escalas e on e.pessoa_id = p.id and e.data_id = p_data_id
  join public.organizations o on o.id = a.organization_id
  where a.user_id = auth.uid() and a.revogado_em is null
    and ('producao' = any (o.modulos_ativos) or 'producao' = any (o.modulos_leitura))
  limit 1;
  if not found then
    return null;
  end if;
  v_org := v_escala.organization_id;
  select d.id, d.temporada_id, d.data, d.data_fim, d.tipo, d.situacao, d.uf, d.fuso, t.titulo as temporada_titulo, o.nome as organizacao_nome
    into v_data
  from public.producao_datas d
  join public.producao_temporadas t on t.id = d.temporada_id
  join public.organizations o on o.id = d.organization_id
  where d.id = p_data_id and d.organization_id = v_org;
  -- Os grupos da pessoa na temporada (um bloco pode ser só de um grupo).
  select coalesce(array_agg(lower(btrim(v.grupo))) filter (where v.grupo is not null), '{}') into v_grupos
  from public.producao_vinculos v
  where v.pessoa_id = v_escala.pessoa_id and v.temporada_id = v_data.temporada_id and v.situacao <> 'cancelada';
  return jsonb_build_object(
    'data', jsonb_build_object('id', v_data.id, 'data', v_data.data, 'data_fim', v_data.data_fim, 'tipo', v_data.tipo, 'situacao', v_data.situacao,
      'uf', v_data.uf, 'fuso', v_data.fuso, 'temporada_titulo', v_data.temporada_titulo, 'organizacao_nome', v_data.organizacao_nome),
    'escala', jsonb_build_object('id', v_escala.id, 'funcao', v_escala.funcao, 'chamada', v_escala.chamada, 'saida', v_escala.saida, 'confirmacao', v_escala.confirmacao),
    'blocos', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'inicio', b.inicio, 'fim', b.fim, 'exibicao', b.exibicao, 'tipo', b.tipo, 'titulo', b.titulo, 'confirmado', b.confirmado)
                       order by b.inicio nulls last, b.ordem)
      from public.producao_blocos b
      where b.data_id = p_data_id and b.organization_id = v_org
        and (b.visivel_para is null or cardinality(b.visivel_para) = 0
             or exists (select 1 from unnest(b.visivel_para) as g where lower(btrim(g)) = any (v_grupos)))
    ), '[]'::jsonb),
    'cartoes', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', c.tipo, 'titulo', c.titulo, 'inicio', c.inicio, 'fim', c.fim, 'endereco', c.endereco, 'localizador', c.localizador, 'notas', c.notas)
                       order by c.tipo)
      from public.producao_cartoes_dia c
      where c.data_id = p_data_id and c.organization_id = v_org
    ), '[]'::jsonb),
    'deslocamentos', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'tipo', x.tipo, 'origem', x.origem, 'destino', x.destino, 'saida', x.saida, 'chegada', x.chegada,
                                          'veiculo', v.nome, 'placa', v.placa, 'companhia', x.companhia, 'localizador', x.localizador, 'notas', x.notas,
                                          'motorista', coalesce(x.motorista_id = v_escala.pessoa_id, false),
                                          'odometro_saida_km', x.odometro_saida_km, 'odometro_chegada_km', x.odometro_chegada_km,
                                          'abastecimentos', coalesce((
                                            select jsonb_agg(jsonb_build_object('id', ab.id, 'litros', ab.litros, 'combustivel', ab.combustivel, 'posto', ab.posto, 'quando', ab.quando) order by ab.quando)
                                            from public.producao_abastecimentos ab
                                            where ab.deslocamento_id = x.id and ab.pessoa_id = v_escala.pessoa_id
                                          ), '[]'::jsonb))
                       order by x.saida nulls last, x.created_at)
      from public.producao_deslocamentos x
      left join public.producao_veiculos v on v.id = x.veiculo_id and v.organization_id = v_org
      where x.data_id = p_data_id and x.organization_id = v_org
        and (x.motorista_id = v_escala.pessoa_id
             or exists (select 1 from public.producao_deslocamento_pessoas dp where dp.deslocamento_id = x.id and dp.pessoa_id = v_escala.pessoa_id))
    ), '[]'::jsonb),
    'hospedagens', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'hotel', h.hotel, 'endereco', h.endereco, 'entrada', h.entrada, 'saida', h.saida,
                                          'localizador', h.localizador, 'quarto', q.nome)
                       order by h.entrada nulls last, h.hotel)
      from public.producao_ocupantes o
      join public.producao_quartos q on q.id = o.quarto_id
      join public.producao_hospedagens h on h.id = o.hospedagem_id
      where o.pessoa_id = v_escala.pessoa_id and o.organization_id = v_org and h.organization_id = v_org and h.temporada_id = v_data.temporada_id
        and (h.entrada is null or (h.entrada <= coalesce(v_data.data_fim, v_data.data) and coalesce(h.saida, h.entrada) >= v_data.data))
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.fn_producao_abastecimento_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_equipe_registrar_viagem(uuid, integer, integer, numeric, text, text) from public, anon;
grant execute on function public.fn_equipe_registrar_viagem(uuid, integer, integer, numeric, text, text) to authenticated;
revoke execute on function public.fn_equipe_folha(uuid) from public, anon;
grant execute on function public.fn_equipe_folha(uuid) to authenticated;
revoke all on public.producao_abastecimentos from anon, authenticated;
grant select, insert, update, delete on public.producao_abastecimentos to authenticated;

comment on table public.producao_abastecimentos is
  'Abastecimento de um deslocamento: litros, combustível, posto e quando, registrado pelo motorista (pela folha) ou pela produção.';
