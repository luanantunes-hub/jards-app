-- P3.4: plano de distribuição pela IN 29/2026 (arts. 41 a 44).
--
-- prestacao_distribuicao guardava tipo (pago, gratuito, cortesia), público e
-- preço soltos, sem como conferir as cotas do art. 41. Cada linha passa a ser
-- uma parte do plano de um produto:
--
--  * produto (o espetáculo, o livro, a exposição): as cotas valem por produto;
--  * categoria do regime: patrocinador (I, até 10%), proponente (II, até 10%),
--    social e educativo (III, ao menos 10%), preço popular (IV, ao menos 20%
--    a até R$ 50), venda a preço livre e gratuita ao público;
--  * quantidade prevista, quantas são meia-entrada e o preço do ingresso
--    inteiro (só nas categorias com venda);
--  * quantidade realizada, que a prestação compara com o plano;
--  * quem recebeu (entidade ou escola, com CPF ou CNPJ), a justificativa de
--    quem mudou o plano e observações.
--
-- Os limites e o preço popular vêm das regras do regime, no app; o banco só
-- guarda o que é coerente em qualquer regime.
--
-- A tabela estava vazia em produção (07/10/2026), então muda de forma aqui
-- mesmo, sem fase de contração; a guarda abaixo recusa se houver linhas.
-- prestacao_verificacoes passa a aceitar distribuição como entidade.

do $$
begin
  if exists (select 1 from public.prestacao_distribuicao) then
    raise exception 'prestacao_distribuicao tem linhas: migre os dados antes de mudar a forma';
  end if;
end
$$;

alter table public.prestacao_distribuicao
  drop column if exists tipo,
  drop column if exists publico_alvo,
  drop column if exists preco_unitario;

alter table public.prestacao_distribuicao
  add column if not exists produto text,
  add column if not exists quantidade_meia integer not null default 0,
  add column if not exists preco numeric(12, 2),
  add column if not exists quantidade_realizada integer,
  add column if not exists beneficiario text,
  add column if not exists beneficiario_documento text,
  add column if not exists justificativa text,
  add column if not exists ordem integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table public.prestacao_distribuicao
  alter column produto set not null,
  alter column categoria set not null,
  alter column quantidade drop default,
  alter column created_at set not null;

alter table public.prestacao_distribuicao
  drop constraint if exists prestacao_distribuicao_produto_check,
  drop constraint if exists prestacao_distribuicao_categoria_check,
  drop constraint if exists prestacao_distribuicao_quantidade_check,
  drop constraint if exists prestacao_distribuicao_meia_check,
  drop constraint if exists prestacao_distribuicao_preco_check,
  drop constraint if exists prestacao_distribuicao_realizada_check,
  drop constraint if exists prestacao_distribuicao_beneficiario_check,
  drop constraint if exists prestacao_distribuicao_documento_check,
  drop constraint if exists prestacao_distribuicao_textos_check;

alter table public.prestacao_distribuicao
  add constraint prestacao_distribuicao_produto_check
    check (char_length(btrim(produto)) between 1 and 200),
  add constraint prestacao_distribuicao_categoria_check
    check (categoria in ('patrocinador', 'proponente', 'social', 'educativo', 'popular', 'venda', 'gratuita')),
  add constraint prestacao_distribuicao_quantidade_check
    check (quantidade > 0),
  -- Meia-entrada só existe onde há venda, e é parte da quantidade.
  add constraint prestacao_distribuicao_meia_check
    check (quantidade_meia >= 0 and quantidade_meia <= quantidade
           and (categoria in ('popular', 'venda') or quantidade_meia = 0)),
  -- Preço do ingresso inteiro: obrigatório onde há venda e só nela.
  add constraint prestacao_distribuicao_preco_check
    check ((categoria in ('popular', 'venda')) = (preco is not null) and (preco is null or preco > 0)),
  add constraint prestacao_distribuicao_realizada_check
    check (quantidade_realizada is null or quantidade_realizada >= 0),
  add constraint prestacao_distribuicao_beneficiario_check
    check (beneficiario is null or char_length(beneficiario) <= 200),
  -- CPF (11 dígitos) ou CNPJ, também o alfanumérico (12 posições e 2 dígitos verificadores).
  add constraint prestacao_distribuicao_documento_check
    check (beneficiario_documento is null or beneficiario_documento ~ '^([0-9]{11}|[0-9A-Z]{12}[0-9]{2})$'),
  add constraint prestacao_distribuicao_textos_check
    check ((justificativa is null or char_length(justificativa) <= 2000)
           and (observacoes is null or char_length(observacoes) <= 1000));

create index if not exists prestacao_distribuicao_ordem_idx on public.prestacao_distribuicao (prestacao_id, ordem, created_at);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_distribuicao_updated_at'
                 and tgrelid = 'public.prestacao_distribuicao'::regclass) then
    create trigger prestacao_distribuicao_updated_at
      before update on public.prestacao_distribuicao
      for each row execute function public.set_prestacao_updated_at();
  end if;
end
$$;

-- ─── Verificações: distribuição como entidade ───────────────────────────────

alter table public.prestacao_verificacoes drop constraint if exists prestacao_verificacoes_entidade_tipo_check;
alter table public.prestacao_verificacoes add constraint prestacao_verificacoes_entidade_tipo_check
  check (entidade_tipo in ('prestacao', 'despesa', 'pagamento', 'lancamento', 'meta', 'local', 'atividade', 'evidencia', 'distribuicao'));

-- O acesso fica como estava: leitura pela prestação e escrita por quem edita.
