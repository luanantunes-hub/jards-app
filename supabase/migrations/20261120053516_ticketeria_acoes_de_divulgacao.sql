-- Ticketeria: as AÇÕES DE DIVULGAÇÃO (passo B do painel "Divulgação"). O produtor registra o que fez para vender (stories do lote 2, anúncio no Meta, e-mail de lançamento): o canal,
-- o período e quanto gastou. A tela cruza isso com as vendas por dia e mostra o custo por ingresso.
--   - `ticketeria_acoes_divulgacao`: nome (2 a 80 letras), canal (o mesmo rótulo do link de divulgação: minúsculas, números, "-" e "_", até 30), início e fim (datas; o fim não vem
--     antes do início), gasto em centavos (zero vale: ação sem custo, como um e-mail) e, se for o caso, o evento. Sem evento, a ação vale para a loja toda.
--   - Coerência: a loja é da organização da ação e o evento (se houver) é da mesma loja.
--   - Regras de acesso: só quem edita a Ticketeria da organização lê, cria, muda e apaga (a ação tem dinheiro; é o mesmo critério dos cupons).
-- Os ingressos de cada ação vêm dos pedidos pagos cujo link de divulgação tinha o mesmo nome de ação (ticketeria_pedidos.origem_acao); a conta é feita na leitura, nada é copiado.
-- Expansão: tabela nova e vazia. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_acoes_divulgacao (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  evento_id uuid references public.ticketeria_eventos (id) on delete set null,
  nome text not null,
  canal text not null,
  inicio date not null,
  fim date not null,
  gasto_centavos integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_acoes_divulgacao_nome_check check (char_length(nome) between 2 and 80),
  constraint ticketeria_acoes_divulgacao_canal_check check (canal ~ '^[a-z0-9_-]{1,30}$'),
  constraint ticketeria_acoes_divulgacao_periodo_check check (fim >= inicio),
  constraint ticketeria_acoes_divulgacao_gasto_check check (gasto_centavos between 0 and 1000000000)
);

create index if not exists ticketeria_acoes_divulgacao_loja_idx on public.ticketeria_acoes_divulgacao (loja_id, inicio desc);
create index if not exists ticketeria_acoes_divulgacao_org_idx on public.ticketeria_acoes_divulgacao (organization_id);

-- ─── Coerência ──────────────────────────────────────────────────────────────

create or replace function public.fn_ticketeria_acao_divulgacao_coerencia()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_loja_do_evento uuid;
begin
  new.nome := btrim(regexp_replace(new.nome, '\s+', ' ', 'g'));
  select l.organization_id into v_org from public.ticketeria_lojas l where l.id = new.loja_id;
  if v_org is distinct from new.organization_id then
    raise exception 'acao_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.evento_id is not null then
    select e.loja_id into v_loja_do_evento from public.ticketeria_eventos e where e.id = new.evento_id;
    if v_loja_do_evento is distinct from new.loja_id then
      raise exception 'acao_com_evento_de_outra_loja' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger ticketeria_acoes_divulgacao_coerencia
  before insert or update on public.ticketeria_acoes_divulgacao
  for each row execute function public.fn_ticketeria_acao_divulgacao_coerencia();

create or replace trigger ticketeria_acoes_divulgacao_updated_at
  before update on public.ticketeria_acoes_divulgacao
  for each row execute function public.fn_ticketeria_updated_at();

-- ─── Acesso ─────────────────────────────────────────────────────────────────

alter table public.ticketeria_acoes_divulgacao enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_acoes_divulgacao' and policyname = 'ticketeria_acoes_divulgacao: le') then
    create policy "ticketeria_acoes_divulgacao: le" on public.ticketeria_acoes_divulgacao for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_acoes_divulgacao' and policyname = 'ticketeria_acoes_divulgacao: insere') then
    create policy "ticketeria_acoes_divulgacao: insere" on public.ticketeria_acoes_divulgacao for insert to authenticated with check (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_acoes_divulgacao' and policyname = 'ticketeria_acoes_divulgacao: edita') then
    create policy "ticketeria_acoes_divulgacao: edita" on public.ticketeria_acoes_divulgacao for update to authenticated
      using (public.auth_ticketeria_pode(organization_id, 'editar')) with check (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_acoes_divulgacao' and policyname = 'ticketeria_acoes_divulgacao: apaga') then
    create policy "ticketeria_acoes_divulgacao: apaga" on public.ticketeria_acoes_divulgacao for delete to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
end
$$;

revoke execute on function public.fn_ticketeria_acao_divulgacao_coerencia() from public, anon, authenticated;

revoke all on public.ticketeria_acoes_divulgacao from public, anon;
grant select, insert, update, delete on public.ticketeria_acoes_divulgacao to authenticated;
grant all on public.ticketeria_acoes_divulgacao to service_role;
