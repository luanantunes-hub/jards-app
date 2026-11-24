-- Ticketeria: os CONTATOS IMPORTADOS de planilha (quarta parte do "Público"). O produtor sobe uma planilha com nome, e-mail e (se quiser) WhatsApp; as pessoas entram no Público como
-- "importadas". Só recebem divulgação se o produtor DECLARAR, na hora de importar, que elas aceitaram receber: a declaração fica gravada (quem, quando e qual versão do texto).
--   - `ticketeria_contatos_importados`: uma linha por pessoa e loja (e-mail em minúsculas, único por loja); `novidades_declaradas_em` nulo = sem declaração (não recebe nada);
--     `declarado_por` e `declaracao_versao` dizem quem declarou e qual texto viu; `arquivo` é o nome da planilha; o WhatsApp só tem dígitos, com o 55.
-- Só quem edita a Ticketeria da organização lê (tem e-mail e telefone); quem grava é o servidor. Quem já saiu da lista (ticketeria_saidas) segue fora, declarado ou não. Expansão:
-- tabela nova e vazia. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_contatos_importados (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  email text not null,
  nome text not null,
  whatsapp text,
  arquivo text,
  novidades_declaradas_em timestamptz,
  declarado_por uuid references auth.users (id) on delete set null,
  declaracao_versao text,
  created_at timestamptz not null default now(),
  constraint ticketeria_contatos_importados_email_check check (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and email = lower(btrim(email))),
  constraint ticketeria_contatos_importados_nome_check check (char_length(btrim(nome)) between 1 and 120),
  constraint ticketeria_contatos_importados_whatsapp_check check (whatsapp is null or whatsapp ~ '^55[0-9]{10,11}$'),
  constraint ticketeria_contatos_importados_arquivo_check check (arquivo is null or char_length(arquivo) <= 120),
  constraint ticketeria_contatos_importados_declaracao_check check ((novidades_declaradas_em is null) = (declaracao_versao is null) and (declaracao_versao is null or declaracao_versao ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')),
  constraint ticketeria_contatos_importados_pessoa_key unique (loja_id, email)
);

create index if not exists ticketeria_contatos_importados_org_idx on public.ticketeria_contatos_importados (organization_id);

alter table public.ticketeria_contatos_importados enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_contatos_importados' and policyname = 'ticketeria_contatos_importados: le') then
    create policy "ticketeria_contatos_importados: le" on public.ticketeria_contatos_importados for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
end
$$;

revoke all on public.ticketeria_contatos_importados from public, anon;
revoke insert, update, delete on public.ticketeria_contatos_importados from authenticated;
grant select on public.ticketeria_contatos_importados to authenticated;
grant all on public.ticketeria_contatos_importados to service_role;
