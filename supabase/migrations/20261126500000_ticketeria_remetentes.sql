-- Ticketeria: o REMETENTE DE E-MAIL DE CADA LOJA e a assinatura do e-mail (R$ 32,90 por mês no cartão, pelo Stripe). O CRM é do cliente: o e-mail de divulgação sai do DOMÍNIO DO PRODUTOR
-- (um domínio, um endereço), nunca de um domínio do Jards. O Jards cria e verifica o domínio no Resend por trás; o produtor só adiciona os registros de DNS no provedor dele.
--   - `ticketeria_remetentes`: uma linha por loja. Domínio, endereço (parte antes do @), nome que aparece para quem recebe, e-mail das respostas, o id do domínio no Resend, a situação
--     ("sem_dominio", "aguardando_dns", "verificado", "falhou") e os registros de DNS que o produtor precisa adicionar; a assinatura ("nenhuma", "pendente", "ativa", "inadimplente",
--     "cancelada"), os ids do Stripe, o período vigente e a cota de e-mails por mês (5.000 de início);
--   - `fn_ticketeria_emails_do_periodo(loja, desde)`: quantos e-mails de divulgação a loja já mandou desde `desde` (não conta quem falhou), para a cota.
-- Só quem edita a Ticketeria da organização lê (a linha tem os ids do Stripe e do Resend, que a tela não mostra: a rota os tira); quem grava é o servidor. Expansão: tabela nova e vazia,
-- função nova. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_remetentes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  dominio text,
  endereco_local text not null default 'ingressos',
  nome_exibicao text,
  responder_para text,
  resend_domain_id text,
  situacao text not null default 'sem_dominio',
  registros jsonb,
  verificado_em timestamptz,
  assinatura text not null default 'nenhuma',
  stripe_customer_id text,
  stripe_subscription_id text,
  periodo_inicio timestamptz,
  periodo_fim timestamptz,
  cancela_no_fim boolean not null default false,
  cota_mensal integer not null default 5000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_remetentes_loja_key unique (loja_id),
  constraint ticketeria_remetentes_situacao_check check (situacao in ('sem_dominio', 'aguardando_dns', 'verificado', 'falhou')),
  constraint ticketeria_remetentes_assinatura_check check (assinatura in ('nenhuma', 'pendente', 'ativa', 'inadimplente', 'cancelada')),
  constraint ticketeria_remetentes_dominio_check check (dominio is null or (char_length(dominio) <= 253 and dominio ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$')),
  constraint ticketeria_remetentes_local_check check (endereco_local ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  constraint ticketeria_remetentes_nome_check check (nome_exibicao is null or char_length(btrim(nome_exibicao)) between 1 and 120),
  constraint ticketeria_remetentes_responder_check check (responder_para is null or (char_length(responder_para) <= 254 and responder_para ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  constraint ticketeria_remetentes_cota_check check (cota_mensal between 0 and 1000000),
  constraint ticketeria_remetentes_dominio_ativo_check check (situacao = 'sem_dominio' or (dominio is not null and resend_domain_id is not null))
);

create index if not exists ticketeria_remetentes_org_idx on public.ticketeria_remetentes (organization_id);
create index if not exists ticketeria_remetentes_stripe_idx on public.ticketeria_remetentes (stripe_subscription_id) where stripe_subscription_id is not null;
create unique index if not exists ticketeria_remetentes_dominio_key on public.ticketeria_remetentes (dominio) where dominio is not null;

alter table public.ticketeria_remetentes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_remetentes' and policyname = 'ticketeria_remetentes: le') then
    create policy "ticketeria_remetentes: le" on public.ticketeria_remetentes for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
end
$$;

revoke all on public.ticketeria_remetentes from public, anon;
revoke insert, update, delete on public.ticketeria_remetentes from authenticated;
grant select on public.ticketeria_remetentes to authenticated;
grant all on public.ticketeria_remetentes to service_role;

create or replace function public.fn_ticketeria_emails_do_periodo(p_loja uuid, p_desde timestamptz)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
    from public.ticketeria_envio_destinatarios d
    join public.ticketeria_envios e on e.id = d.envio_id
   where e.loja_id = p_loja and e.canal = 'email' and e.created_at >= p_desde and d.situacao <> 'falhou';
$$;

revoke execute on function public.fn_ticketeria_emails_do_periodo(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_emails_do_periodo(uuid, timestamptz) to service_role;
