-- P6.2: leitura dos atos pela IA e propostas de nova versão do regime.
--
-- Ao marcar um ato do Diário ou uma mudança de página como "afeta um regime",
-- o super admin diz quais regimes (a página vigiada já traz os da fonte). A
-- função agente-normativo, no modo "ler", manda à IA o documento e cada
-- regime; a resposta é conferida (supabase/functions/_shared/proposta-regime.ts):
-- mudança sem trecho literal no texto guardado, em caminho que não existe ou
-- com valor de outro tipo cai, com o motivo. O que sobra vira uma proposta em
-- prestacao_regime_propostas, com o regime já com as mudanças, a vigência, a
-- transição e quantas prestações usam o regime. A proposta nunca publica: a
-- revisão e a publicação são da P6.3, com o schema Zod conferindo o regime.

-- ─── Regimes do documento ───────────────────────────────────────────────────

alter table public.normas_documentos
  add column if not exists regimes text[] not null default '{}';

-- A conferência passa a dizer quais regimes o documento afeta.
drop function if exists public.fn_normas_documento_conferir(uuid, text, text);

create function public.fn_normas_documento_conferir(
  p_documento_id uuid, p_situacao text, p_nota text default null, p_regimes text[] default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_documento public.normas_documentos%rowtype;
  v_regimes text[];
begin
  if not public.is_jards_super_admin() then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if p_situacao not in ('novo', 'conferido', 'descartado') then
    raise exception 'situacao_invalida' using errcode = '22023';
  end if;
  if p_regimes is not null and exists (
       select 1 from unnest(p_regimes) r(codigo)
       where not exists (select 1 from public.prestacao_regimes pr where pr.codigo = r.codigo)) then
    raise exception 'regime_inexistente' using errcode = '22023';
  end if;

  select * into v_documento from public.normas_documentos where id = p_documento_id for update;
  if not found then
    raise exception 'documento_inexistente' using errcode = 'P0002';
  end if;

  v_regimes := coalesce(p_regimes, v_documento.regimes);
  -- Página vigiada sem escolha: os regimes da fonte.
  if cardinality(v_regimes) = 0 then
    select coalesce(f.regimes, '{}') into v_regimes
    from public.normas_fontes f where f.id = v_documento.fonte_id and f.tipo <> 'dou_inlabs';
    v_regimes := coalesce(v_regimes, '{}');
  end if;
  if p_situacao = 'conferido' and cardinality(v_regimes) = 0 then
    raise exception 'regimes_obrigatorios' using errcode = '22023';
  end if;

  update public.normas_documentos
  set situacao = p_situacao,
      nota = nullif(left(btrim(coalesce(p_nota, '')), 1000), ''),
      regimes = (select coalesce(array_agg(distinct r order by r), '{}') from unnest(v_regimes) r),
      conferido_por = case when p_situacao = 'novo' then null else auth.uid() end,
      conferido_em = case when p_situacao = 'novo' then null else now() end
  where id = p_documento_id;
end;
$$;
revoke all on function public.fn_normas_documento_conferir(uuid, text, text, text[]) from public, anon;
grant execute on function public.fn_normas_documento_conferir(uuid, text, text, text[]) to authenticated;

-- ─── Propostas ──────────────────────────────────────────────────────────────

create table if not exists public.prestacao_regime_propostas (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.normas_documentos(id) on delete cascade,
  -- A versão do regime que a IA leu.
  regime_id uuid not null references public.prestacao_regimes(id) on delete cascade,
  regime_codigo text not null,
  classificacao text not null check (classificacao in ('irrelevante', 'informativo', 'altera_regra')),
  resumo text check (char_length(resumo) <= 2000),
  -- Mudanças conferidas: [{ operacao, caminho, valorAtual, valorProposto, dispositivo, citacao, explicacao, aConfirmar }].
  mudancas jsonb not null default '[]'::jsonb check (jsonb_typeof(mudancas) = 'array'),
  -- As que caíram na conferência: [{ caminho, operacao, citacao, motivo }].
  descartadas jsonb not null default '[]'::jsonb check (jsonb_typeof(descartadas) = 'array'),
  -- Regras que não cabem no regime e pedem checagem nova em código.
  checagens_novas jsonb not null default '[]'::jsonb check (jsonb_typeof(checagens_novas) = 'array'),
  -- O regime inteiro com as mudanças aplicadas e a versão seguinte; null quando nada muda.
  regime_proposto jsonb,
  vigencia_proposta date,
  transicao jsonb not null default '{}'::jsonb check (jsonb_typeof(transicao) = 'object'),
  prestacoes_afetadas integer not null default 0 check (prestacoes_afetadas >= 0),
  organizacoes_afetadas integer not null default 0 check (organizacoes_afetadas >= 0),
  -- nova → (P6.3) em_revisao → aceita → publicada, ou rejeitada; ler de novo substitui a nova.
  status text not null default 'nova'
    check (status in ('nova', 'em_revisao', 'aceita', 'rejeitada', 'publicada', 'substituida')),
  revisado_por uuid references auth.users(id) on delete set null,
  revisado_em timestamptz,
  motivo text check (char_length(motivo) <= 2000),
  modelo text,
  custo_usd numeric(12, 6) check (custo_usd is null or custo_usd >= 0),
  execucao_id uuid references public.agente_execucoes(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists prestacao_regime_propostas_documento_idx
  on public.prestacao_regime_propostas (documento_id, created_at desc);
create index if not exists prestacao_regime_propostas_status_idx
  on public.prestacao_regime_propostas (status, created_at desc);

alter table public.prestacao_regime_propostas enable row level security;
revoke all on public.prestacao_regime_propostas from anon, authenticated;
grant select on public.prestacao_regime_propostas to authenticated;
grant all on public.prestacao_regime_propostas to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_regime_propostas'
                 and policyname = 'prestacao_regime_propostas: super admin le') then
    create policy "prestacao_regime_propostas: super admin le" on public.prestacao_regime_propostas
      for select to authenticated using (public.is_jards_super_admin());
  end if;
end
$$;

-- ─── Leitura registrada ─────────────────────────────────────────────────────

alter table public.agente_execucoes drop constraint if exists agente_execucoes_agente_check;
alter table public.agente_execucoes
  add constraint agente_execucoes_agente_check check (agente in ('vigia_dou', 'vigia_paginas', 'leitor_normas'));

-- O custo de cada chamada à IA fica no mesmo lugar das outras funções (P2.10b).
alter table public.prestacao_ia_chamadas drop constraint if exists prestacao_ia_chamadas_funcao_check;
alter table public.prestacao_ia_chamadas
  add constraint prestacao_ia_chamadas_funcao_check check (funcao in ('extrair-comprovante', 'ler-extrato-pdf', 'agente-normativo'));

-- ─── Prestações afetadas ────────────────────────────────────────────────────
-- Quantas prestações em andamento (antes de aprovada ou arquivada) usam
-- alguma versão do regime, e de quantas organizações. A P6.4 avisa essas.

create or replace function public.fn_regime_prestacoes_afetadas(p_codigo text)
returns table (prestacoes integer, organizacoes integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer, count(distinct p.organization_id)::integer
  from public.prestacoes_contas p
  join public.prestacao_regimes r on r.id = p.regime_id
  where r.codigo = p_codigo and p.status not in ('aprovado', 'arquivado');
$$;
revoke all on function public.fn_regime_prestacoes_afetadas(text) from public, anon, authenticated;
grant execute on function public.fn_regime_prestacoes_afetadas(text) to service_role;
