-- Ticketeria: as CAMPANHAS dos anúncios (Meta e Google), para o modelo de marketing separar o gasto da MARCA (a instituição: o teatro, o zoológico, a banda) do gasto de cada EVENTO.
--   - `ticketeria_campanhas`: uma linha por campanha de uma conexão (o id e o nome na plataforma), com a marcação do produtor: "marca", "evento" (e qual) ou ainda sem marcação (nulo).
--     `sugerida`: a marcação veio do nome da campanha (tem o nome de um evento) e o produtor ainda não confirmou;
--   - `ticketeria_campanhas_diaria`: o gasto de cada campanha por dia, em centavos (a soma das campanhas de um dia é o gasto da conta em `ticketeria_midia_diaria`).
-- Só o servidor lê e grava (como `ticketeria_midia_diaria`): a tela fala com rotas que conferem quem edita a Ticketeria. Expansão: duas tabelas novas e vazias. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_campanhas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  conexao_id uuid not null references public.ticketeria_conexoes_midia (id) on delete cascade,
  canal text not null,
  campanha_externa_id text not null,
  nome text not null,
  marcacao text,
  evento_id uuid references public.ticketeria_eventos (id) on delete set null,
  sugerida boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_campanhas_conexao_campanha_key unique (conexao_id, campanha_externa_id),
  constraint ticketeria_campanhas_canal_check check (canal ~ '^[a-z0-9_-]{1,30}$'),
  constraint ticketeria_campanhas_externa_check check (char_length(campanha_externa_id) between 1 and 64),
  constraint ticketeria_campanhas_nome_check check (char_length(nome) between 1 and 300),
  constraint ticketeria_campanhas_marcacao_check check (marcacao is null or marcacao in ('marca', 'evento')),
  constraint ticketeria_campanhas_evento_check check (marcacao = 'evento' or evento_id is null)
);

create index if not exists ticketeria_campanhas_loja_idx on public.ticketeria_campanhas (loja_id);

create table if not exists public.ticketeria_campanhas_diaria (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  campanha_id uuid not null references public.ticketeria_campanhas (id) on delete cascade,
  dia date not null,
  gasto_centavos bigint not null default 0,
  constraint ticketeria_campanhas_diaria_campanha_dia_key unique (campanha_id, dia),
  constraint ticketeria_campanhas_diaria_gasto_check check (gasto_centavos >= 0)
);

create index if not exists ticketeria_campanhas_diaria_loja_dia_idx on public.ticketeria_campanhas_diaria (loja_id, dia);

alter table public.ticketeria_campanhas enable row level security;
alter table public.ticketeria_campanhas_diaria enable row level security;
revoke all on public.ticketeria_campanhas from public, anon, authenticated;
revoke all on public.ticketeria_campanhas_diaria from public, anon, authenticated;
grant all on public.ticketeria_campanhas to service_role;
grant all on public.ticketeria_campanhas_diaria to service_role;
