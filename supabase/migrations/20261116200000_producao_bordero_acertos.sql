-- PD7.9 (primeiro corte): acerto de contas do borderô.
--
-- Decisão do dono (13/11/2026): o acerto sai do borderô; uma linha por parte (companhia, casa, patrocinador...), aprovada por quem tem a permissão de
-- dinheiro; o app NÃO paga nada: só registra e exporta. Depois de aprovado e de a pessoa anotar que foi pago (`pago_em`, à mão), a linha fica como registro.
--
-- producao_bordero_acertos: uma linha por parte num borderô. A parte tem nome e papel (companhia, casa, patrocinador ou outra) e a FORMA do que recebe,
-- calculada sobre o líquido do borderô pela tela: percentual (0 a 100), valor fixo, ou o resto (o que sobra depois das outras partes; no máximo uma por
-- borderô). Os valores em reais não ficam gravados: o líquido muda se a receita mudar, e o acerto acompanha enquanto o borderô está aberto.
--
-- DINHEIRO: só lê e escreve quem tem a permissão de dinheiro (a regra das tabelas de valores), e fica SEM histórico (o valor iria para uma linha que
-- quem não vê o dinheiro também lê); quem aprovou e quando ficam na própria linha.
--
-- Regras no banco: a soma das porcentagens do borderô não passa de 100 (`percentuais_passam_de_100`); só se aprova com o borderô FECHADO
-- (`bordero_nao_fechado`) e o gatilho carimba quem aprovou e quando; a linha aprovada não muda parte, papel, forma nem valor e não se apaga
-- (`acerto_aprovado`), mas se pode desaprovar enquanto não tiver `pago_em` (`acerto_pago`); `pago_em` só existe em linha aprovada; e o borderô não reabre
-- enquanto houver acerto aprovado (`acerto_aprovado`): para reabrir, desaprova-se antes.
--
-- Acesso: o do borderô mais o dinheiro. Expansão: uma tabela nova e vazia, duas funções de gatilho e um gatilho novo no borderô (função nova, nada
-- reescrito). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_bordero_acertos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  bordero_id uuid not null references public.producao_borderos (id) on delete cascade,
  parte text not null,
  papel text not null default 'outra',
  forma text not null default 'percentual',
  valor numeric(14, 2) not null default 0,
  situacao text not null default 'proposto',
  aprovado_por uuid references auth.users (id) on delete set null,
  aprovado_em timestamptz,
  pago_em date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_bordero_acertos_parte_check check (char_length(btrim(parte)) between 1 and 80),
  constraint producao_bordero_acertos_papel_check check (papel in ('companhia', 'casa', 'patrocinador', 'outra')),
  constraint producao_bordero_acertos_forma_check check (forma in ('percentual', 'fixo', 'resto')),
  constraint producao_bordero_acertos_valor_check check (
    valor between 0 and 999999999999.99
    and (forma <> 'percentual' or valor <= 100)
    and (forma <> 'resto' or valor = 0)
  ),
  constraint producao_bordero_acertos_situacao_check check (situacao in ('proposto', 'aprovado')),
  constraint producao_bordero_acertos_pago_check check (pago_em is null or situacao = 'aprovado')
);

create index if not exists producao_bordero_acertos_org_idx on public.producao_bordero_acertos (organization_id);
create index if not exists producao_bordero_acertos_bordero_idx on public.producao_bordero_acertos (bordero_id);
create unique index if not exists producao_bordero_acertos_parte_idx on public.producao_bordero_acertos (bordero_id, lower(btrim(parte)));
create unique index if not exists producao_bordero_acertos_resto_idx on public.producao_bordero_acertos (bordero_id) where forma = 'resto';

-- Coerência da linha de acerto. Erros (check_violation): organizacao_nao_muda, bordero_nao_muda, bordero_de_outra_organizacao, percentuais_passam_de_100,
-- bordero_nao_fechado, acerto_aprovado, acerto_pago.
create or replace function public.fn_producao_bordero_acerto_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_situacao_do_bordero text;
  v_percentuais numeric;
begin
  if tg_op = 'DELETE' then
    if old.situacao = 'aprovado' then
      -- A cascata de apagar o borderô (ou a sessão) segue; só apagar a linha direto é recusado.
      if exists (select 1 from public.producao_borderos b where b.id = old.bordero_id) then
        raise exception 'acerto_aprovado' using errcode = 'check_violation';
      end if;
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.bordero_id is distinct from old.bordero_id then
    raise exception 'bordero_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  select b.situacao into v_situacao_do_bordero from public.producao_borderos b where b.id = new.bordero_id and b.organization_id = new.organization_id for share;
  if not found then
    raise exception 'bordero_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and old.situacao = 'aprovado' then
    if new.situacao = 'aprovado' and (new.parte is distinct from old.parte or new.papel is distinct from old.papel or new.forma is distinct from old.forma or new.valor is distinct from old.valor) then
      raise exception 'acerto_aprovado' using errcode = 'check_violation';
    end if;
    if new.situacao = 'proposto' and old.pago_em is not null then
      raise exception 'acerto_pago' using errcode = 'check_violation';
    end if;
  end if;
  if new.situacao = 'aprovado' and (tg_op = 'INSERT' or old.situacao <> 'aprovado') then
    if v_situacao_do_bordero <> 'fechado' then
      raise exception 'bordero_nao_fechado' using errcode = 'check_violation';
    end if;
    new.aprovado_por := auth.uid();
    new.aprovado_em := now();
  elsif new.situacao <> 'aprovado' then
    new.aprovado_por := null;
    new.aprovado_em := null;
  end if;
  if new.forma = 'percentual' then
    select coalesce(sum(a.valor), 0) into v_percentuais from public.producao_bordero_acertos a
    where a.bordero_id = new.bordero_id and a.forma = 'percentual' and (tg_op = 'INSERT' or a.id <> new.id);
    if v_percentuais + new.valor > 100 then
      raise exception 'percentuais_passam_de_100' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- O borderô não reabre enquanto houver acerto aprovado. Erro (check_violation): acerto_aprovado.
create or replace function public.fn_producao_bordero_reabrir_guarda()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.situacao = 'fechado' and new.situacao <> 'fechado'
     and exists (select 1 from public.producao_bordero_acertos a where a.bordero_id = new.id and a.situacao = 'aprovado') then
    raise exception 'acerto_aprovado' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_bordero_acertos_coerencia
  before insert or update or delete on public.producao_bordero_acertos
  for each row execute function public.fn_producao_bordero_acerto_coerencia();
create or replace trigger producao_bordero_acertos_updated_at
  before update on public.producao_bordero_acertos
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_borderos_reabrir_guarda
  before update of situacao on public.producao_borderos
  for each row execute function public.fn_producao_bordero_reabrir_guarda();

alter table public.producao_bordero_acertos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_bordero_acertos' and policyname = 'producao_bordero_acertos: le') then
    create policy "producao_bordero_acertos: le" on public.producao_bordero_acertos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_acertos.bordero_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_bordero_acertos' and policyname = 'producao_bordero_acertos: leitura sem assinatura') then
    create policy "producao_bordero_acertos: leitura sem assinatura" on public.producao_bordero_acertos for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_acertos.bordero_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_bordero_acertos' and policyname = 'producao_bordero_acertos: insere') then
    create policy "producao_bordero_acertos: insere" on public.producao_bordero_acertos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_acertos.bordero_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_bordero_acertos' and policyname = 'producao_bordero_acertos: edita') then
    create policy "producao_bordero_acertos: edita" on public.producao_bordero_acertos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_acertos.bordero_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_acertos.bordero_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_bordero_acertos' and policyname = 'producao_bordero_acertos: apaga') then
    create policy "producao_bordero_acertos: apaga" on public.producao_bordero_acertos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_borderos b where b.id = producao_bordero_acertos.bordero_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_bordero_acerto_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_bordero_reabrir_guarda() from public, anon, authenticated;
revoke all on public.producao_bordero_acertos from anon, authenticated;
-- Quem aprovou e quando só o gatilho escreve: o navegador não grava essas duas colunas.
grant select, delete on public.producao_bordero_acertos to authenticated;
grant insert (organization_id, bordero_id, parte, papel, forma, valor, situacao, pago_em) on public.producao_bordero_acertos to authenticated;
grant update (parte, papel, forma, valor, situacao, pago_em) on public.producao_bordero_acertos to authenticated;

comment on table public.producao_bordero_acertos is 'Acerto de contas do borderô: uma linha por parte (companhia, casa, patrocinador...) com a forma do que recebe (percentual do líquido, fixo ou o resto). Dinheiro: só com a permissão. O app não paga: registra e exporta. Sem histórico.';
