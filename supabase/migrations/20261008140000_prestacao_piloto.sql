-- P4.8: o que o piloto mede.
--
-- prestacao_diligencias ganha preditiva (a diligência veio da análise
-- preditiva, que na Rouanet chega no dia seguinte ao envio) e apontamentos
-- (os códigos das checagens do sistema que correspondem ao que o órgão
-- apontou, como PAGAMENTO_SEM_NUMERO ou DOC_FORA_VIGENCIA). O critério do
-- piloto é não ter diligência preditiva por erro formal que o sistema
-- detecta: com os apontamentos, o painel do admin conta essas diligências.
--
-- piloto_organizacoes: as organizações do piloto e quantos dias a equipe
-- levava para montar a prestação final antes do sistema, para comparar com o
-- tempo medido. Só o admin lê e escreve, pela chave de serviço: sem política
-- para quem está logado.
-- Idempotente.

alter table public.prestacao_diligencias add column if not exists preditiva boolean not null default false;
alter table public.prestacao_diligencias add column if not exists apontamentos text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prestacao_diligencias_apontamentos_check'
                 and conrelid = 'public.prestacao_diligencias'::regclass) then
    alter table public.prestacao_diligencias add constraint prestacao_diligencias_apontamentos_check check (
      cardinality(apontamentos) <= 30
      and array_to_string(apontamentos, ',') ~ '^([A-Z][A-Z_]{1,59}(,[A-Z][A-Z_]{1,59})*)?$'
    );
  end if;
end $$;

create table if not exists public.piloto_organizacoes (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  entrou_em date not null default current_date,
  dias_antes integer check (dias_antes is null or dias_antes between 1 and 3650),
  observacoes text check (observacoes is null or char_length(observacoes) <= 2000),
  incluido_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.piloto_organizacoes enable row level security;
revoke all on public.piloto_organizacoes from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'piloto_organizacoes_updated_at'
                 and tgrelid = 'public.piloto_organizacoes'::regclass) then
    create trigger piloto_organizacoes_updated_at
      before update on public.piloto_organizacoes
      for each row execute function public.update_updated_at();
  end if;
end $$;
