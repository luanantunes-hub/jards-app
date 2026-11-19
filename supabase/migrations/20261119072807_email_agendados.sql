-- E-mails agendados pelo Jards: a pessoa escreve agora e o e-mail sai da própria caixa dela (Gmail ou Outlook) na hora marcada.
-- Uma rotina do banco chama a rota de envio a cada minuto (como a leitura das agendas das reuniões). O endereço e o segredo
-- ficam no cofre (vault): email_agendados_url e email_agendados_segredo. Sem eles a rotina não faz nada, então aplicar esta
-- migration não liga nada sozinha.

create table if not exists public.email_agendados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  para text[] not null,
  cc text[] not null default '{}',
  assunto text not null,
  texto text not null,
  responder_a_email_id uuid references public.emails(id) on delete set null,
  enviar_em timestamptz not null,
  estado text not null default 'pendente' check (estado in ('pendente', 'enviando', 'enviado', 'falhou', 'cancelado')),
  erro text,
  tentativas integer not null default 0,
  enviado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_agendados_devidos_idx on public.email_agendados (enviar_em) where estado = 'pendente';
create index if not exists email_agendados_pessoa_idx on public.email_agendados (user_id, estado, enviar_em);

alter table public.email_agendados enable row level security;

-- Cada pessoa vê os próprios agendamentos; quem grava e envia é o servidor (permissão de serviço).
drop policy if exists "email_agendados: so a propria pessoa le" on public.email_agendados;
create policy "email_agendados: so a propria pessoa le" on public.email_agendados
  for select
  using (user_id = auth.uid());

create or replace function public.fn_email_agendados_disparar()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_segredo text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'email_agendados_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'email_agendados_segredo';
  if v_url is null or v_url = '' or v_segredo is null or v_segredo = '' then
    return null;
  end if;
  return net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-email-segredo', v_segredo),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.fn_email_agendados_disparar() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('jards-email-agendados', '* * * * *', 'select public.fn_email_agendados_disparar();');
  end if;
end;
$$;
