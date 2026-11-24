-- Ticketeria: o GRUPO DE COMPARAÇÃO dos envios, o LIMITE de e-mails por semana e a CENTRAL DE PREFERÊNCIAS do Público (decisão do dono, 23/11/2026; Valenti et al., JAMS 2024;
-- Ascarza, JMR 2018; Zhang, Kumar e Cosguner, JMR 2017; De Pessemier et al., 2012).
--   - `ticketeria_envio_comparacao`: em cada envio, as pessoas sorteadas (10%) que NÃO recebem o e-mail; nos 90 dias seguintes o Jards compara o que elas compraram com o que
--     quem recebeu comprou ("trouxe a mais"). Fica fora da fila do envio (`ticketeria_envio_destinatarios`), que segue igual;
--   - `ticketeria_lojas.limite_emails_semana`: quantos e-mails de divulgação a loja manda, no máximo, a uma mesma pessoa em 7 dias (de 1 a 14; começa em 3, como no estudo);
--   - `ticketeria_preferencias`: o que cada pessoa escolheu na central de preferências (o link do e-mail): tudo (até o limite da loja), menos (no máximo 1 por mês) ou só
--     parecidos (eventos com público em comum com o que ela já comprou), e os dias (qualquer, fim de semana ou dias de semana). "Não quero receber mais nada" segue em `ticketeria_saidas`.
-- Só o servidor lê e grava as duas tabelas novas (como `ticketeria_campanhas`). Expansão: duas tabelas novas e vazias e uma coluna com padrão. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.ticketeria_lojas add column if not exists limite_emails_semana integer not null default 3;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_lojas_limite_emails_semana_check') then
    alter table public.ticketeria_lojas add constraint ticketeria_lojas_limite_emails_semana_check check (limite_emails_semana between 1 and 14);
  end if;
end
$$;

create table if not exists public.ticketeria_envio_comparacao (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  envio_id uuid not null references public.ticketeria_envios (id) on delete cascade,
  email text not null,
  nome text not null,
  created_at timestamptz not null default now(),
  constraint ticketeria_envio_comparacao_envio_email_key unique (envio_id, email),
  constraint ticketeria_envio_comparacao_email_check check (char_length(email) between 3 and 254 and email = lower(btrim(email))),
  constraint ticketeria_envio_comparacao_nome_check check (char_length(nome) <= 120)
);

create table if not exists public.ticketeria_preferencias (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  email text not null,
  frequencia text not null default 'tudo',
  dias text not null default 'qualquer',
  updated_at timestamptz not null default now(),
  constraint ticketeria_preferencias_loja_email_key unique (loja_id, email),
  constraint ticketeria_preferencias_email_check check (char_length(email) between 3 and 254 and email = lower(btrim(email))),
  constraint ticketeria_preferencias_frequencia_check check (frequencia in ('tudo', 'menos', 'parecidos')),
  constraint ticketeria_preferencias_dias_check check (dias in ('qualquer', 'fim_de_semana', 'semana'))
);

alter table public.ticketeria_envio_comparacao enable row level security;
alter table public.ticketeria_preferencias enable row level security;
revoke all on public.ticketeria_envio_comparacao from public, anon, authenticated;
revoke all on public.ticketeria_preferencias from public, anon, authenticated;
grant all on public.ticketeria_envio_comparacao to service_role;
grant all on public.ticketeria_preferencias to service_role;
