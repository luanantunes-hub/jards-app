-- Ticketeria: a conta da bilheteria (B1 da Bilheteria, a venda de ingressos na porta do evento).
--
-- Quem vende na porta entra com uma conta ligada só à LOJA, fora dos papéis da organização (admin, colaborador, captador...): não ocupa vaga paga, não é membro, não lê nada do
-- painel e não passa pelas regras de captação, prestação ou produção. Todo o acesso dela é por rotas do servidor, que conferem esta tabela e usam a chave de serviço.
--
-- ticketeria_bilheteiros: um por pessoa e loja (loja, usuário, nome, ligada ou desligada). Quem edita a Ticketeria da organização lê a lista; a própria pessoa lê só a linha dela.
-- Ninguém grava pelo navegador (sem regra nem privilégio de insert, update ou delete): quem cadastra, desliga ou troca o nome é o servidor.
--
-- Função (a própria pessoa chama, logada):
--   fn_ticketeria_bilheteiro_atual() → as lojas em que a pessoa logada é bilheteira ligada e cuja organização tem a Ticketeria ativa:
--     [{ id, loja_id, loja, nome }], da mais antiga à mais nova; lista vazia para quem não é bilheteira.
--
-- Expansão: tabela nova e vazia, função nova. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_bilheteiros (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_bilheteiros_loja_usuario_key unique (loja_id, user_id),
  constraint ticketeria_bilheteiros_nome_check check (char_length(btrim(nome)) between 1 and 120)
);

create index if not exists ticketeria_bilheteiros_org_idx on public.ticketeria_bilheteiros (organization_id);
create index if not exists ticketeria_bilheteiros_usuario_idx on public.ticketeria_bilheteiros (user_id) where ativo;
create index if not exists ticketeria_bilheteiros_criado_por_idx on public.ticketeria_bilheteiros (criado_por) where criado_por is not null;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'ticketeria_bilheteiros_updated_at') then
    create trigger ticketeria_bilheteiros_updated_at before update on public.ticketeria_bilheteiros
      for each row execute function public.fn_ticketeria_updated_at();
  end if;
end
$$;

-- ─── Regras de acesso ───────────────────────────────────────────────────────

alter table public.ticketeria_bilheteiros enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_bilheteiros' and policyname = 'ticketeria_bilheteiros: le') then
    create policy "ticketeria_bilheteiros: le" on public.ticketeria_bilheteiros for select to authenticated
      using (user_id = (select auth.uid()) or public.auth_ticketeria_pode(organization_id, 'ler'));
  end if;
end
$$;

revoke all on public.ticketeria_bilheteiros from public, anon, authenticated;
grant select on public.ticketeria_bilheteiros to authenticated;
grant all on public.ticketeria_bilheteiros to service_role;

-- ─── A pessoa logada: de que lojas ela é bilheteira ─────────────────────────

create or replace function public.fn_ticketeria_bilheteiro_atual()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'loja_id', b.loja_id, 'loja', l.nome, 'nome', b.nome) order by b.created_at, b.id), '[]'::jsonb)
  from public.ticketeria_bilheteiros b
  join public.ticketeria_lojas l on l.id = b.loja_id
  join public.organizations o on o.id = b.organization_id
  where b.user_id = auth.uid()
    and b.ativo
    and 'ticketeria' = any (o.modulos_ativos);
$$;

revoke execute on function public.fn_ticketeria_bilheteiro_atual() from public, anon;
grant execute on function public.fn_ticketeria_bilheteiro_atual() to authenticated, service_role;
