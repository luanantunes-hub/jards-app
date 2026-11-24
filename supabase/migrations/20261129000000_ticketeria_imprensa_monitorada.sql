-- Ticketeria: o MONITORAMENTO DA IMPRENSA feito pelo próprio Jards (decisão do dono, 23/11/2026: esquema misto, sem serviço pago e sem buscador).
--   - `ticketeria_veiculos_acompanhados`: os veículos que cada casa acompanha (o site e o RSS achado nele). A grande imprensa entra como padrão ("padrao"); os locais, o produtor acrescenta
--     ("produtor"). `situacao`: lendo, sem_rss (o site não publica RSS), bloqueado (o site recusa a leitura automática), erro ou aguardando (ainda não lido). "Parar de acompanhar" marca
--     `parado` (a linha fica, para o padrão não voltar);
--   - `ticketeria_imprensa_achados`: o que a leitura achou de cada evento: o título, o link e a data da notícia (nada da matéria é copiado), o motivo (o que bateu) e a situação: registrado
--     (caso claro, entrou sozinho como marcação de imprensa, com `acao_id`), a_confirmar (caso dúbio), descartado ("não é sobre o evento") ou desfeito ("desfazer" de um registrado).
-- Só o servidor lê e grava (como `ticketeria_campanhas`): a tela fala com rotas que conferem quem edita a Ticketeria. Expansão: duas tabelas novas e vazias. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_veiculos_acompanhados (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  nome text not null,
  site text not null,
  feed text,
  origem text not null default 'produtor',
  situacao text not null default 'aguardando',
  parado boolean not null default false,
  noticias_lidas integer not null default 0,
  ultima_leitura timestamptz,
  created_at timestamptz not null default now(),
  constraint ticketeria_veiculos_acompanhados_nome_check check (char_length(btrim(nome)) between 1 and 80),
  constraint ticketeria_veiculos_acompanhados_site_check check (char_length(site) between 8 and 300 and site ~ '^https?://'),
  constraint ticketeria_veiculos_acompanhados_feed_check check (feed is null or (char_length(feed) between 8 and 500 and feed ~ '^https?://')),
  constraint ticketeria_veiculos_acompanhados_origem_check check (origem in ('padrao', 'produtor')),
  constraint ticketeria_veiculos_acompanhados_situacao_check check (situacao in ('aguardando', 'lendo', 'sem_rss', 'bloqueado', 'erro')),
  constraint ticketeria_veiculos_acompanhados_lidas_check check (noticias_lidas >= 0)
);

create unique index if not exists ticketeria_veiculos_acompanhados_loja_site_key on public.ticketeria_veiculos_acompanhados (loja_id, site);

create table if not exists public.ticketeria_imprensa_achados (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  veiculo_id uuid references public.ticketeria_veiculos_acompanhados (id) on delete set null,
  evento_id uuid not null references public.ticketeria_eventos (id) on delete cascade,
  acao_id uuid references public.ticketeria_acoes_divulgacao (id) on delete set null,
  titulo text not null,
  link text not null,
  publicado_em date not null,
  motivo text not null,
  situacao text not null,
  created_at timestamptz not null default now(),
  constraint ticketeria_imprensa_achados_loja_evento_link_key unique (loja_id, evento_id, link),
  constraint ticketeria_imprensa_achados_titulo_check check (char_length(titulo) between 1 and 300),
  constraint ticketeria_imprensa_achados_link_check check (char_length(link) between 8 and 1000 and link ~ '^https?://'),
  constraint ticketeria_imprensa_achados_motivo_check check (motivo in ('evento_e_espaco', 'evento_e_artista', 'so_evento', 'evento_no_texto')),
  constraint ticketeria_imprensa_achados_situacao_check check (situacao in ('registrado', 'a_confirmar', 'descartado', 'desfeito'))
);

create index if not exists ticketeria_imprensa_achados_loja_idx on public.ticketeria_imprensa_achados (loja_id, situacao);

alter table public.ticketeria_veiculos_acompanhados enable row level security;
alter table public.ticketeria_imprensa_achados enable row level security;
revoke all on public.ticketeria_veiculos_acompanhados from public, anon, authenticated;
revoke all on public.ticketeria_imprensa_achados from public, anon, authenticated;
grant all on public.ticketeria_veiculos_acompanhados to service_role;
grant all on public.ticketeria_imprensa_achados to service_role;
