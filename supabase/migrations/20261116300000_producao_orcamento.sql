-- PD5.1 (primeiro corte): orçamento vivo da temporada, com as linhas por categoria e as três versões do que se espera gastar.
--
-- producao_orcamentos: um orçamento de uma temporada (pode haver mais de um: o cenário da PD5.2 usa isso). Tem nome, situação (rascunho, aprovado ou
-- encerrado) e, quando aprova, quem e quando. producao_orcamento_linhas: uma linha por categoria e descrição (cachê, hospedagem, transporte, som e luz...),
-- com o valor em três versões como colunas (estimativa, aprovado, revisado) e o que já está comprometido e pago.
--
-- DINHEIRO: as duas tabelas só leem e só escrevem com a permissão de dinheiro (a regra das tabelas de valores) e ficam SEM histórico (o valor
-- iria para uma linha que quem não vê o dinheiro também lê). Quem aprovou e quando ficam no próprio orçamento.
--
-- Primeiro corte: o comprometido e o pago são DIGITADOS na linha. Quando vierem os acordos (PD4.5) e os lançamentos (PD5.3), eles passam a ser somados de lá,
-- e cada número abre a origem. O custo final previsto (revisado, senão aprovado, senão estimativa), a variação e o que falta pagar são contas da tela
-- (lib/producao/orcamento.ts), não ficam gravados. Não nasce do orçamento do projeto ainda (`projeto_orcamento_itens`): fica para depois.
--
-- Regras no banco: o orçamento só anda para a frente (rascunho, aprovado, encerrado; erro `orcamento_nao_volta`) e nasce em rascunho
-- (`orcamento_nasce_rascunho`). Aprovar copia a estimativa para o "aprovado" das linhas que ainda não o têm e carimba quem e quando. Aprovado, as colunas
-- estimativa e aprovado das linhas existentes não mudam, linha com valor aprovado não se apaga e linha nova entra sem valor aprovado (`orcamento_aprovado`);
-- o revisado, o comprometido e o pago seguem editáveis. Encerrado, nada muda (`orcamento_encerrado`). Nome único na temporada e linha única por
-- categoria e descrição no orçamento.
--
-- Acesso: o da temporada mais o dinheiro. Expansão: duas tabelas novas e vazias e duas funções de gatilho. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_orcamentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  temporada_id uuid not null references public.producao_temporadas (id) on delete cascade,
  nome text not null default 'Orçamento',
  situacao text not null default 'rascunho',
  aprovado_por uuid references auth.users (id) on delete set null,
  aprovado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_orcamentos_nome_check check (char_length(btrim(nome)) between 1 and 80),
  constraint producao_orcamentos_situacao_check check (situacao in ('rascunho', 'aprovado', 'encerrado'))
);

create index if not exists producao_orcamentos_org_idx on public.producao_orcamentos (organization_id);
create index if not exists producao_orcamentos_temporada_idx on public.producao_orcamentos (temporada_id);
create unique index if not exists producao_orcamentos_nome_idx on public.producao_orcamentos (temporada_id, lower(btrim(nome)));

create table if not exists public.producao_orcamento_linhas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  orcamento_id uuid not null references public.producao_orcamentos (id) on delete cascade,
  categoria text not null default 'outros',
  descricao text not null,
  estimativa numeric(14, 2),
  aprovado numeric(14, 2),
  revisado numeric(14, 2),
  comprometido numeric(14, 2) not null default 0,
  pago numeric(14, 2) not null default 0,
  ordem smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_orcamento_linhas_categoria_check check (categoria in ('cache', 'comissao', 'hospedagem', 'alimentacao', 'passagem', 'transporte', 'combustivel', 'frete', 'som_e_luz', 'cenografia', 'figurino', 'direitos', 'imposto', 'seguro', 'divulgacao', 'taxa_da_casa', 'acessibilidade', 'outros')),
  constraint producao_orcamento_linhas_descricao_check check (char_length(btrim(descricao)) between 1 and 120),
  constraint producao_orcamento_linhas_valores_check check (
    (estimativa is null or estimativa between 0 and 999999999999.99)
    and (aprovado is null or aprovado between 0 and 999999999999.99)
    and (revisado is null or revisado between 0 and 999999999999.99)
    and comprometido between 0 and 999999999999.99
    and pago between 0 and 999999999999.99
  ),
  constraint producao_orcamento_linhas_ordem_check check (ordem between 0 and 999)
);

create index if not exists producao_orcamento_linhas_org_idx on public.producao_orcamento_linhas (organization_id);
create index if not exists producao_orcamento_linhas_orcamento_idx on public.producao_orcamento_linhas (orcamento_id);
create unique index if not exists producao_orcamento_linhas_descricao_idx on public.producao_orcamento_linhas (orcamento_id, categoria, lower(btrim(descricao)));

-- Coerência do orçamento. Erros (check_violation): organizacao_nao_muda, temporada_nao_muda, temporada_de_outra_organizacao, orcamento_nasce_rascunho,
-- orcamento_nao_volta, orcamento_encerrado.
create or replace function public.fn_producao_orcamento_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
    end if;
    if new.temporada_id is distinct from old.temporada_id then
      raise exception 'temporada_nao_muda' using errcode = 'check_violation';
    end if;
    if old.situacao = 'encerrado' then
      raise exception 'orcamento_encerrado' using errcode = 'check_violation';
    end if;
    if old.situacao = 'aprovado' and new.situacao = 'rascunho' then
      raise exception 'orcamento_nao_volta' using errcode = 'check_violation';
    end if;
  else
    if new.organization_id is null then
      return new; -- a coluna é not null: quem recusa é a tabela
    end if;
    if not exists (select 1 from public.producao_temporadas t where t.id = new.temporada_id and t.organization_id = new.organization_id) then
      raise exception 'temporada_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if new.situacao <> 'rascunho' then
      raise exception 'orcamento_nasce_rascunho' using errcode = 'check_violation';
    end if;
  end if;
  if new.situacao = 'aprovado' and (tg_op = 'INSERT' or old.situacao <> 'aprovado') then
    new.aprovado_por := auth.uid();
    new.aprovado_em := now();
    -- O aprovado das linhas que ainda não o têm passa a ser a estimativa (as linhas ainda enxergam o orçamento em rascunho).
    update public.producao_orcamento_linhas set aprovado = estimativa where orcamento_id = new.id and aprovado is null and estimativa is not null;
  elsif new.situacao = 'rascunho' then
    new.aprovado_por := null;
    new.aprovado_em := null;
  end if;
  return new;
end;
$$;

-- Coerência da linha. Erros (check_violation): organizacao_nao_muda, orcamento_nao_muda, orcamento_de_outra_organizacao, orcamento_encerrado, orcamento_aprovado.
create or replace function public.fn_producao_orcamento_linha_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_situacao text;
begin
  if tg_op = 'DELETE' then
    select o.situacao into v_situacao from public.producao_orcamentos o where o.id = old.orcamento_id;
    if not found then
      return old; -- o orçamento está sendo apagado: a cascata segue
    end if;
    if v_situacao = 'encerrado' then
      raise exception 'orcamento_encerrado' using errcode = 'check_violation';
    end if;
    if v_situacao = 'aprovado' and old.aprovado is not null then
      raise exception 'orcamento_aprovado' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.orcamento_id is distinct from old.orcamento_id then
    raise exception 'orcamento_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  select o.situacao into v_situacao from public.producao_orcamentos o where o.id = new.orcamento_id and o.organization_id = new.organization_id for share;
  if not found then
    raise exception 'orcamento_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if v_situacao = 'encerrado' then
    raise exception 'orcamento_encerrado' using errcode = 'check_violation';
  end if;
  if v_situacao = 'aprovado' then
    if tg_op = 'INSERT' and new.aprovado is not null then
      raise exception 'orcamento_aprovado' using errcode = 'check_violation';
    end if;
    if tg_op = 'UPDATE' and (new.categoria is distinct from old.categoria or new.estimativa is distinct from old.estimativa or new.aprovado is distinct from old.aprovado) then
      raise exception 'orcamento_aprovado' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger producao_orcamentos_coerencia
  before insert or update on public.producao_orcamentos
  for each row execute function public.fn_producao_orcamento_coerencia();
create or replace trigger producao_orcamentos_updated_at
  before update on public.producao_orcamentos
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_orcamento_linhas_coerencia
  before insert or update or delete on public.producao_orcamento_linhas
  for each row execute function public.fn_producao_orcamento_linha_coerencia();
create or replace trigger producao_orcamento_linhas_updated_at
  before update on public.producao_orcamento_linhas
  for each row execute function public.fn_producao_updated_at();

alter table public.producao_orcamentos enable row level security;
alter table public.producao_orcamento_linhas enable row level security;

do $$
begin
  -- ─── Orçamentos ───
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_orcamentos' and policyname = 'producao_orcamentos: le') then
    create policy "producao_orcamentos: le" on public.producao_orcamentos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_temporadas t where t.id = producao_orcamentos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_orcamentos' and policyname = 'producao_orcamentos: leitura sem assinatura') then
    create policy "producao_orcamentos: leitura sem assinatura" on public.producao_orcamentos for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_temporadas t where t.id = producao_orcamentos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_orcamentos' and policyname = 'producao_orcamentos: insere') then
    create policy "producao_orcamentos: insere" on public.producao_orcamentos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_temporadas t where t.id = producao_orcamentos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_orcamentos' and policyname = 'producao_orcamentos: edita') then
    create policy "producao_orcamentos: edita" on public.producao_orcamentos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_temporadas t where t.id = producao_orcamentos.temporada_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_temporadas t where t.id = producao_orcamentos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_orcamentos' and policyname = 'producao_orcamentos: apaga') then
    create policy "producao_orcamentos: apaga" on public.producao_orcamentos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_temporadas t where t.id = producao_orcamentos.temporada_id));
  end if;
  -- ─── Linhas ───
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_orcamento_linhas' and policyname = 'producao_orcamento_linhas: le') then
    create policy "producao_orcamento_linhas: le" on public.producao_orcamento_linhas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_orcamentos o where o.id = producao_orcamento_linhas.orcamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_orcamento_linhas' and policyname = 'producao_orcamento_linhas: leitura sem assinatura') then
    create policy "producao_orcamento_linhas: leitura sem assinatura" on public.producao_orcamento_linhas for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_orcamentos o where o.id = producao_orcamento_linhas.orcamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_orcamento_linhas' and policyname = 'producao_orcamento_linhas: insere') then
    create policy "producao_orcamento_linhas: insere" on public.producao_orcamento_linhas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_orcamentos o where o.id = producao_orcamento_linhas.orcamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_orcamento_linhas' and policyname = 'producao_orcamento_linhas: edita') then
    create policy "producao_orcamento_linhas: edita" on public.producao_orcamento_linhas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_orcamentos o where o.id = producao_orcamento_linhas.orcamento_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_orcamentos o where o.id = producao_orcamento_linhas.orcamento_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_orcamento_linhas' and policyname = 'producao_orcamento_linhas: apaga') then
    create policy "producao_orcamento_linhas: apaga" on public.producao_orcamento_linhas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_orcamentos o where o.id = producao_orcamento_linhas.orcamento_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_orcamento_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_orcamento_linha_coerencia() from public, anon, authenticated;
revoke all on public.producao_orcamentos from anon, authenticated;
revoke all on public.producao_orcamento_linhas from anon, authenticated;
-- Quem aprovou e quando só o gatilho escreve: o navegador não grava essas duas colunas.
grant select, delete on public.producao_orcamentos to authenticated;
grant insert (organization_id, temporada_id, nome, situacao) on public.producao_orcamentos to authenticated;
grant update (nome, situacao) on public.producao_orcamentos to authenticated;
grant select, insert, update, delete on public.producao_orcamento_linhas to authenticated;

comment on table public.producao_orcamentos is 'Orçamento vivo de uma temporada: nome, situação (rascunho, aprovado, encerrado) e quem aprovou. Dinheiro: só com a permissão. Sem histórico.';
comment on table public.producao_orcamento_linhas is 'Linha do orçamento: categoria e descrição, valor em três versões (estimativa, aprovado, revisado), comprometido e pago. Dinheiro: só com a permissão. Sem histórico.';
