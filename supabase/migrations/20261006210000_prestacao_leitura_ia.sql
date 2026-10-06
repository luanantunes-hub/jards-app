-- P2.10b: leitura de documento v2 pela IA.
--
-- prestacao_comprovantes.motivos_ia guarda o que a leitura por IA apontou no
-- documento, cada motivo com um código do catálogo de checagens
-- ([{ "codigo", "texto", "vedada"? }]). O motor de checagens transforma cada
-- um num achado a revisar; quem edita a prestação descarta o motivo na
-- despesa, e o achado se resolve na verificação seguinte.
--
-- prestacao_ia_chamadas registra cada chamada às funções de IA (leitura de
-- comprovante e de extrato em PDF): modelo, tokens, custo estimado e
-- duração, para medir o custo por leitura no piloto. Só o service role grava
-- e lê; quem usa o app não vê a tabela.
-- Idempotente; sem DROP.

alter table public.prestacao_comprovantes add column if not exists motivos_ia jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prestacao_comprovantes_motivos_ia_check'
                 and conrelid = 'public.prestacao_comprovantes'::regclass) then
    alter table public.prestacao_comprovantes add constraint prestacao_comprovantes_motivos_ia_check check (
      jsonb_typeof(motivos_ia) = 'array' and jsonb_array_length(motivos_ia) <= 20
    );
  end if;
end
$$;

create table if not exists public.prestacao_ia_chamadas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  prestacao_id uuid references public.prestacoes_contas(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  funcao text not null check (funcao in ('extrair-comprovante', 'ler-extrato-pdf')),
  modelo text not null,
  arquivo text,
  tamanho_bytes bigint check (tamanho_bytes is null or tamanho_bytes >= 0),
  tokens_entrada integer check (tokens_entrada is null or tokens_entrada >= 0),
  tokens_saida integer check (tokens_saida is null or tokens_saida >= 0),
  tokens_total integer check (tokens_total is null or tokens_total >= 0),
  custo_usd numeric(12, 6) check (custo_usd is null or custo_usd >= 0),
  duracao_ms integer check (duracao_ms is null or duracao_ms >= 0),
  sucesso boolean not null,
  erro text,
  created_at timestamptz not null default now()
);

create index if not exists prestacao_ia_chamadas_organizacao_idx on public.prestacao_ia_chamadas (organization_id, created_at);
create index if not exists prestacao_ia_chamadas_prestacao_idx on public.prestacao_ia_chamadas (prestacao_id) where prestacao_id is not null;

alter table public.prestacao_ia_chamadas enable row level security;
revoke all on public.prestacao_ia_chamadas from anon, authenticated;
grant all on public.prestacao_ia_chamadas to service_role;
