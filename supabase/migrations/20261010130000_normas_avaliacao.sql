-- P6.5: conjunto de teste do agente normativo.
--
-- A função agente-normativo ganha o modo "avaliar": lê os casos de
-- supabase/functions/_shared/conjunto-normativo.ts como na leitura de verdade
-- e compara a proposta com o gabarito (as mudanças de 2026 já conferidas à
-- mão e documentos que não mudam nada), sem gerar proposta. A rodada fica em
-- agente_execucoes (agente "avaliador_normas") e a nota de cada caso, em
-- normas_avaliacoes, que só o super admin lê.
--
-- A Portaria MESP 10/2026, que o caso da LIE lê, passa a ser vigiada: é a
-- norma do regime lie_p10_2026 e não estava entre as fontes da P6.1.
-- Idempotente.

insert into public.normas_fontes (codigo, nome, tipo, url, orgao, area, regimes, frequencia_dias, configuracao)
values ('mesp_portaria_10_2026', 'Portaria MESP 10/2026 (LIE), no Diário Oficial', 'pagina',
        'https://www.in.gov.br/web/dou/-/portaria-mesp-n-10-de-3-de-marco-de-2026-690209578',
        'Ministério do Esporte', 'esporte', array['lie_p10_2026', 'lie_p424_2020'], 30, '{}')
on conflict (codigo) do nothing;

alter table public.agente_execucoes drop constraint if exists agente_execucoes_agente_check;
alter table public.agente_execucoes
  add constraint agente_execucoes_agente_check check (agente in ('vigia_dou', 'vigia_paginas', 'leitor_normas', 'avaliador_normas'));

create table if not exists public.normas_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references public.agente_execucoes(id) on delete cascade,
  caso text not null check (caso ~ '^[a-z0-9_]{1,80}$'),
  titulo text not null check (char_length(titulo) <= 300),
  regime_codigo text not null,
  regime_versao integer,
  -- Título do documento lido; o id, quando é a versão guardada de uma fonte.
  documento text not null check (char_length(documento) <= 300),
  documento_id uuid references public.normas_documentos(id) on delete set null,
  modelo text,
  classificacao text check (classificacao in ('irrelevante', 'informativo', 'altera_regra')),
  classificacao_certa boolean,
  esperadas integer not null default 0 check (esperadas >= 0),
  acertos integer not null default 0 check (acertos >= 0),
  erradas integer not null default 0 check (erradas >= 0),
  faltas integer not null default 0 check (faltas >= 0),
  falsos_alarmes integer not null default 0 check (falsos_alarmes >= 0),
  -- Acertos sobre as mudanças esperadas; null quando o caso não espera mudança.
  cobertura numeric(5, 4) check (cobertura is null or cobertura between 0 and 1),
  -- A nota inteira: acertos, erradas, faltas, falsos alarmes, as mudanças conferidas e o resumo da IA.
  resultado jsonb not null default '{}'::jsonb,
  custo_usd numeric(12, 6) check (custo_usd is null or custo_usd >= 0),
  duracao_ms integer check (duracao_ms is null or duracao_ms >= 0),
  erro text check (char_length(erro) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists normas_avaliacoes_caso_idx on public.normas_avaliacoes (caso, created_at desc);
create index if not exists normas_avaliacoes_execucao_idx on public.normas_avaliacoes (execucao_id);

alter table public.normas_avaliacoes enable row level security;
revoke all on public.normas_avaliacoes from anon, authenticated;
grant select on public.normas_avaliacoes to authenticated;
grant all on public.normas_avaliacoes to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'normas_avaliacoes'
                 and policyname = 'normas_avaliacoes: super admin le') then
    create policy "normas_avaliacoes: super admin le" on public.normas_avaliacoes
      for select to authenticated using (public.is_jards_super_admin());
  end if;
end
$$;
