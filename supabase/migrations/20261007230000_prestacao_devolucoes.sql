-- P4.4: devoluções e GRU.
--
-- O regime diz como se devolve (parametros->'posEnvio'->'devolucao'): a
-- descrição, o índice de atualização e os campos da guia (unidade gestora,
-- gestão, código e referência). Na Rouanet, o saldo e os rendimentos voltam
-- ao FNC no encerramento (IN 29/2026, art. 68, IV), e o valor irregular,
-- depois da reprovação, volta atualizado pela poupança desde o fim do prazo
-- de captação (art. 77).
--
-- prestacao_devolucoes guarda cada devolução: o motivo (saldo, rendimento,
-- glosa, reprovação ou outro), o valor principal, o índice e a data-base da
-- atualização, o valor atualizado com o fator e a data até onde foi
-- calculado, os campos da guia copiados do regime (podem ser ajustados; na
-- LIE a UG ainda está "a confirmar"), competência e vencimento, e o
-- pagamento: data, valor e o comprovante, na pasta devolucoes da prestação.
-- O cálculo é do app (lib/prestacao/devolucoes.ts), com a série 195 do Banco
-- Central; o banco confere a coerência dos campos. Idempotente.

create table if not exists public.prestacao_devolucoes (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  motivo text not null check (motivo in ('saldo', 'rendimento', 'glosa', 'reprovacao', 'outro')),
  descricao text check (descricao is null or char_length(descricao) <= 500),
  valor_principal numeric(14,2) not null check (valor_principal > 0),
  indice text not null default 'nenhum' check (indice in ('nenhum', 'poupanca', 'selic', 'outro')),
  data_base date,
  atualizado_ate date,
  fator numeric(14,10) check (fator is null or fator >= 1),
  valor_atualizado numeric(14,2) check (valor_atualizado is null or valor_atualizado >= valor_principal),
  gru_unidade_gestora text check (gru_unidade_gestora is null or char_length(gru_unidade_gestora) <= 20),
  gru_gestao text check (gru_gestao is null or char_length(gru_gestao) <= 20),
  gru_codigo text check (gru_codigo is null or char_length(gru_codigo) <= 20),
  gru_referencia text check (gru_referencia is null or char_length(gru_referencia) <= 60),
  competencia text check (competencia is null or competencia ~ '^(0[1-9]|1[0-2])/[0-9]{4}$'),
  vencimento date,
  situacao text not null default 'a_pagar' check (situacao in ('a_pagar', 'paga')),
  pago_em date,
  valor_pago numeric(14,2) check (valor_pago is null or valor_pago > 0),
  storage_path text,
  nome_arquivo text check (nome_arquivo is null or char_length(nome_arquivo) <= 300),
  mime_type text,
  observacoes text check (observacoes is null or char_length(observacoes) <= 1000),
  ordem integer not null default 0,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Com índice, há data-base; a atualização não vem antes dela e traz o fator.
  constraint prestacao_devolucoes_atualizacao check (
    (indice = 'nenhum' or data_base is not null)
    and (atualizado_ate is null or (data_base is not null and atualizado_ate >= data_base))
    and ((valor_atualizado is null) = (atualizado_ate is null))
  ),
  -- Paga: com a data e o valor pagos.
  constraint prestacao_devolucoes_pagamento check (
    (situacao = 'paga') = (pago_em is not null and valor_pago is not null)
  )
);

create index if not exists prestacao_devolucoes_prestacao_idx on public.prestacao_devolucoes (prestacao_id, ordem, created_at);

-- O comprovante fica na pasta devolucoes da própria prestação.
create or replace function public.fn_prestacao_devolucao_arquivo()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.storage_path is not null and (
       split_part(new.storage_path, '/', 2) <> 'prestacoes'
       or split_part(new.storage_path, '/', 3) <> new.prestacao_id::text
       or split_part(new.storage_path, '/', 4) <> 'devolucoes'
       or split_part(new.storage_path, '/', 5) = ''
       or split_part(new.storage_path, '/', 6) <> '') then
    raise exception 'caminho_invalido' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_devolucoes_arquivo'
                 and tgrelid = 'public.prestacao_devolucoes'::regclass) then
    create trigger prestacao_devolucoes_arquivo
      before insert or update of storage_path, prestacao_id on public.prestacao_devolucoes
      for each row execute function public.fn_prestacao_devolucao_arquivo();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_devolucoes_updated_at'
                 and tgrelid = 'public.prestacao_devolucoes'::regclass) then
    create trigger prestacao_devolucoes_updated_at
      before update on public.prestacao_devolucoes
      for each row execute function public.set_prestacao_updated_at();
  end if;
end
$$;

-- ─── Acesso: lê quem acessa a prestação; escreve quem edita ─────────────────

alter table public.prestacao_devolucoes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_devolucoes'
                 and policyname = 'prestacao_devolucoes: acesso pela prestacao') then
    create policy "prestacao_devolucoes: acesso pela prestacao" on public.prestacao_devolucoes
      for all to authenticated
      using (public.can_access_prestacao(prestacao_id))
      with check (public.can_access_prestacao(prestacao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_devolucoes'
                 and policyname = 'prestacao_devolucoes: papel insere') then
    create policy "prestacao_devolucoes: papel insere" on public.prestacao_devolucoes
      as restrictive for insert to authenticated
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_devolucoes: papel edita" on public.prestacao_devolucoes
      as restrictive for update to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'))
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_devolucoes: papel apaga" on public.prestacao_devolucoes
      as restrictive for delete to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'));
  end if;
end
$$;

revoke all on public.prestacao_devolucoes from anon;
grant select, insert, update, delete on public.prestacao_devolucoes to authenticated;
grant all on public.prestacao_devolucoes to service_role;
