-- PD5.5 (primeiro corte): faturas ao contratante e as parcelas a receber.
--
-- producao_faturas: o que a companhia cobra de um contratante (a casa, o SESC, a prefeitura, o festival) numa temporada, ligado ou não a um acordo a receber: o valor,
-- as retenções (o que o contratante retém de imposto, e portanto não paga), o número da nota emitida, a emissão e o vencimento geral, e a situação: rascunho,
-- revisão, em aberto e quitada. producao_fatura_parcelas: como o valor líquido será recebido (um sinal e parcelas, cada uma com o vencimento e o dia do recebimento).
--
-- DINHEIRO: como o orçamento, só lê e escreve quem tem a permissão de dinheiro, sem histórico. A fatura não cobra ninguém: o app só registra e acompanha o que
-- se tem a receber, o que já foi recebido e o que está atrasado (conta da tela, pelo vencimento da parcela).
--
-- Regras no banco: nasce em rascunho; a situação anda um passo e volta enquanto não está em aberto (`fatura_situacao_invalida`); para ficar em aberto a fatura
-- precisa de parcelas que somem exatamente o valor líquido, que é o valor menos as retenções (`parcelas_nao_fecham`); em aberto, a fatura não volta, o valor, as retenções, o contratante e
-- o acordo não mudam, as parcelas não entram, não saem nem mudam de valor (`fatura_emitida`) e só o vencimento e o dia do recebimento seguem livres; só se
-- marca recebimento com a fatura em aberto (`fatura_nao_emitida`); quitada só com todas as parcelas recebidas (`fatura_nao_quitada`) e depois não muda
-- (`fatura_quitada`); as parcelas nunca passam do valor líquido (`parcelas_passam_do_valor`); o acordo é da mesma temporada e a receber (`acordo_invalido`).
--
-- Acesso: o da temporada mais o dinheiro. Expansão: duas tabelas novas e vazias e duas funções de gatilho. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_faturas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  temporada_id uuid not null references public.producao_temporadas (id) on delete cascade,
  acordo_id uuid references public.producao_acordos (id) on delete set null,
  contratante text not null,
  descricao text not null,
  situacao text not null default 'rascunho',
  valor numeric(14, 2) not null,
  retencoes numeric(14, 2) not null default 0,
  nota_numero text,
  emissao date,
  vencimento date,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_faturas_contratante_check check (char_length(btrim(contratante)) between 1 and 120),
  constraint producao_faturas_descricao_check check (char_length(btrim(descricao)) between 1 and 120),
  constraint producao_faturas_situacao_check check (situacao in ('rascunho', 'revisao', 'em_aberto', 'quitada')),
  constraint producao_faturas_valor_check check (valor > 0 and valor <= 999999999999.99 and retencoes >= 0 and retencoes <= valor),
  constraint producao_faturas_nota_check check (nota_numero is null or char_length(btrim(nota_numero)) between 1 and 60),
  constraint producao_faturas_observacao_check check (observacao is null or char_length(btrim(observacao)) between 1 and 300)
);

create index if not exists producao_faturas_org_idx on public.producao_faturas (organization_id);
create index if not exists producao_faturas_temporada_idx on public.producao_faturas (temporada_id);
create index if not exists producao_faturas_acordo_idx on public.producao_faturas (acordo_id) where acordo_id is not null;
create unique index if not exists producao_faturas_nota_idx on public.producao_faturas (temporada_id, lower(btrim(contratante)), lower(btrim(nota_numero))) where nota_numero is not null;

create table if not exists public.producao_fatura_parcelas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  fatura_id uuid not null references public.producao_faturas (id) on delete cascade,
  rotulo text,
  valor numeric(14, 2) not null,
  vencimento date not null,
  recebido_em date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_fatura_parcelas_rotulo_check check (rotulo is null or char_length(btrim(rotulo)) between 1 and 40),
  constraint producao_fatura_parcelas_valor_check check (valor > 0 and valor <= 999999999999.99)
);

create index if not exists producao_fatura_parcelas_org_idx on public.producao_fatura_parcelas (organization_id);
create index if not exists producao_fatura_parcelas_fatura_idx on public.producao_fatura_parcelas (fatura_id, vencimento);

-- Coerência da fatura. Erros (check_violation): organizacao_nao_muda, temporada_nao_muda, temporada_de_outra_organizacao, acordo_invalido, fatura_nasce_rascunho,
-- fatura_situacao_invalida, fatura_quitada, fatura_emitida, parcelas_nao_fecham, fatura_nao_quitada, parcelas_passam_do_valor.
create or replace function public.fn_producao_fatura_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ordem text[] := array['rascunho', 'revisao', 'em_aberto', 'quitada'];
  v_de int;
  v_para int;
  v_liquido numeric;
  v_soma numeric;
  v_qtd int;
  v_sem_receber int;
begin
  if tg_op = 'DELETE' then
    if old.situacao in ('em_aberto', 'quitada') and exists (select 1 from public.producao_temporadas t where t.id = old.temporada_id) then
      raise exception 'fatura_emitida' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
    end if;
    if new.temporada_id is distinct from old.temporada_id then
      raise exception 'temporada_nao_muda' using errcode = 'check_violation';
    end if;
  else
    if new.organization_id is null then
      return new; -- a coluna é not null: quem recusa é a tabela
    end if;
    if not exists (select 1 from public.producao_temporadas t where t.id = new.temporada_id and t.organization_id = new.organization_id) then
      raise exception 'temporada_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if new.situacao <> 'rascunho' then
      raise exception 'fatura_nasce_rascunho' using errcode = 'check_violation';
    end if;
  end if;
  if new.acordo_id is not null and (tg_op = 'INSERT' or new.acordo_id is distinct from old.acordo_id) then
    if not exists (select 1 from public.producao_acordos a where a.id = new.acordo_id and a.organization_id = new.organization_id and a.temporada_id = new.temporada_id and a.sentido = 'a_receber') then
      raise exception 'acordo_invalido' using errcode = 'check_violation';
    end if;
  end if;
  if tg_op = 'INSERT' then
    return new;
  end if;
  if old.situacao = 'quitada' then
    raise exception 'fatura_quitada' using errcode = 'check_violation';
  end if;
  v_de := array_position(v_ordem, old.situacao);
  v_para := array_position(v_ordem, new.situacao);
  if v_para > v_de + 1 then
    raise exception 'fatura_situacao_invalida' using errcode = 'check_violation';
  end if;
  if old.situacao = 'em_aberto' and (new.valor is distinct from old.valor or new.retencoes is distinct from old.retencoes
                                      or new.contratante is distinct from old.contratante or new.acordo_id is distinct from old.acordo_id) then
    raise exception 'fatura_emitida' using errcode = 'check_violation';
  end if;
  if old.situacao = 'em_aberto' and new.situacao not in ('em_aberto', 'quitada') then
    raise exception 'fatura_emitida' using errcode = 'check_violation';
  end if;
  v_liquido := new.valor - new.retencoes;
  select coalesce(sum(p.valor), 0), count(*), count(*) filter (where p.recebido_em is null) into v_soma, v_qtd, v_sem_receber from public.producao_fatura_parcelas p where p.fatura_id = new.id;
  if v_soma > v_liquido then
    raise exception 'parcelas_passam_do_valor' using errcode = 'check_violation';
  end if;
  if new.situacao = 'em_aberto' and old.situacao <> 'em_aberto' and (v_qtd = 0 or v_soma <> v_liquido) then
    raise exception 'parcelas_nao_fecham' using errcode = 'check_violation';
  end if;
  if new.situacao = 'quitada' and (v_qtd = 0 or v_soma <> v_liquido or v_sem_receber > 0) then
    raise exception 'fatura_nao_quitada' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência da parcela. Erros (check_violation): organizacao_nao_muda, fatura_nao_muda, fatura_de_outra_organizacao, fatura_quitada, fatura_emitida, fatura_nao_emitida, parcelas_passam_do_valor.
create or replace function public.fn_producao_fatura_parcela_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_situacao text;
  v_liquido numeric;
  v_outras numeric;
begin
  if tg_op = 'DELETE' then
    select f.situacao into v_situacao from public.producao_faturas f where f.id = old.fatura_id;
    if not found then
      return old; -- a fatura está sendo apagada: a cascata segue
    end if;
    if v_situacao = 'quitada' then
      raise exception 'fatura_quitada' using errcode = 'check_violation';
    end if;
    if v_situacao = 'em_aberto' then
      raise exception 'fatura_emitida' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.fatura_id is distinct from old.fatura_id then
    raise exception 'fatura_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  select f.situacao, f.valor - f.retencoes into v_situacao, v_liquido from public.producao_faturas f where f.id = new.fatura_id and f.organization_id = new.organization_id for share;
  if not found then
    raise exception 'fatura_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if v_situacao = 'quitada' then
    raise exception 'fatura_quitada' using errcode = 'check_violation';
  end if;
  if v_situacao = 'em_aberto' then
    if tg_op = 'INSERT' or new.valor is distinct from old.valor then
      raise exception 'fatura_emitida' using errcode = 'check_violation';
    end if;
  elsif new.recebido_em is not null then
    raise exception 'fatura_nao_emitida' using errcode = 'check_violation';
  end if;
  select coalesce(sum(p.valor), 0) into v_outras from public.producao_fatura_parcelas p where p.fatura_id = new.fatura_id and (tg_op = 'INSERT' or p.id <> new.id);
  if v_outras + new.valor > v_liquido then
    raise exception 'parcelas_passam_do_valor' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_faturas_coerencia
  before insert or update or delete on public.producao_faturas
  for each row execute function public.fn_producao_fatura_coerencia();
create or replace trigger producao_faturas_updated_at
  before update on public.producao_faturas
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_fatura_parcelas_coerencia
  before insert or update or delete on public.producao_fatura_parcelas
  for each row execute function public.fn_producao_fatura_parcela_coerencia();
create or replace trigger producao_fatura_parcelas_updated_at
  before update on public.producao_fatura_parcelas
  for each row execute function public.fn_producao_updated_at();

alter table public.producao_faturas enable row level security;
alter table public.producao_fatura_parcelas enable row level security;

do $$
begin
  -- ─── Faturas ───
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_faturas' and policyname = 'producao_faturas: le') then
    create policy "producao_faturas: le" on public.producao_faturas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_temporadas t where t.id = producao_faturas.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_faturas' and policyname = 'producao_faturas: leitura sem assinatura') then
    create policy "producao_faturas: leitura sem assinatura" on public.producao_faturas for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_temporadas t where t.id = producao_faturas.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_faturas' and policyname = 'producao_faturas: insere') then
    create policy "producao_faturas: insere" on public.producao_faturas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_temporadas t where t.id = producao_faturas.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_faturas' and policyname = 'producao_faturas: edita') then
    create policy "producao_faturas: edita" on public.producao_faturas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_temporadas t where t.id = producao_faturas.temporada_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_temporadas t where t.id = producao_faturas.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_faturas' and policyname = 'producao_faturas: apaga') then
    create policy "producao_faturas: apaga" on public.producao_faturas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_temporadas t where t.id = producao_faturas.temporada_id));
  end if;
  -- ─── Parcelas ───
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_fatura_parcelas' and policyname = 'producao_fatura_parcelas: le') then
    create policy "producao_fatura_parcelas: le" on public.producao_fatura_parcelas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_faturas f where f.id = producao_fatura_parcelas.fatura_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_fatura_parcelas' and policyname = 'producao_fatura_parcelas: leitura sem assinatura') then
    create policy "producao_fatura_parcelas: leitura sem assinatura" on public.producao_fatura_parcelas for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_faturas f where f.id = producao_fatura_parcelas.fatura_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_fatura_parcelas' and policyname = 'producao_fatura_parcelas: insere') then
    create policy "producao_fatura_parcelas: insere" on public.producao_fatura_parcelas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_faturas f where f.id = producao_fatura_parcelas.fatura_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_fatura_parcelas' and policyname = 'producao_fatura_parcelas: edita') then
    create policy "producao_fatura_parcelas: edita" on public.producao_fatura_parcelas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_faturas f where f.id = producao_fatura_parcelas.fatura_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_faturas f where f.id = producao_fatura_parcelas.fatura_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_fatura_parcelas' and policyname = 'producao_fatura_parcelas: apaga') then
    create policy "producao_fatura_parcelas: apaga" on public.producao_fatura_parcelas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_faturas f where f.id = producao_fatura_parcelas.fatura_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_fatura_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_fatura_parcela_coerencia() from public, anon, authenticated;
revoke all on public.producao_faturas from anon, authenticated;
revoke all on public.producao_fatura_parcelas from anon, authenticated;
grant select, insert, update, delete on public.producao_faturas to authenticated;
grant select, insert, update, delete on public.producao_fatura_parcelas to authenticated;

comment on table public.producao_faturas is 'Fatura ao contratante: valor, retenções, nota, vencimento e situação (rascunho, revisão, em aberto, quitada). Em aberto, o valor não muda. Dinheiro: só com a permissão. Sem histórico.';
comment on table public.producao_fatura_parcelas is 'Como o valor líquido da fatura será recebido: parcelas com vencimento e o dia do recebimento. A soma fecha o líquido ao abrir a fatura.';
