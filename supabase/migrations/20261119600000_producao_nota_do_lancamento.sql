-- PD5.3/PD10.2: a nota fiscal de um pagamento lançado.
--
-- O lançamento (o pagamento já feito, PD5.3) guardava só os dados: descrição, favorecido, documento, data e valor. A
-- nota em si ficava fora do Jards. Agora `producao_arquivos` pode apontar para um lançamento (`lancamento_id`), na
-- pasta `documentos` da temporada, como a data já faz com `data_id`.
--
-- É o que falta para a ponte com a prestação de contas (PD10.2): o comprovante da prestação **exige** um arquivo
-- (`nome_arquivo` e `storage_path` são obrigatórios lá), então sem a nota guardada aqui não há o que mandar para lá.
--
-- Acesso: o de `producao_arquivos` (não muda) — a pasta `documentos` não é sensível, então quem lê os arquivos da
-- temporada lê a nota. Coerência: o lançamento é da mesma organização e da mesma temporada do arquivo.
-- Apagar: o arquivo sai com o lançamento (o objeto no armazenamento é apagado pela tela, como já é hoje).
--
-- Expansão: uma coluna anulável, um índice, a função de coerência trocada (create or replace) e o gatilho dela
-- recriado. Aditiva e reaplicável; sem DROP de tabela nem de coluna.

set local lock_timeout = '10s';

alter table public.producao_arquivos add column if not exists lancamento_id uuid references public.producao_lancamentos (id) on delete cascade;

create index if not exists producao_arquivos_lancamento_idx on public.producao_arquivos (lancamento_id) where lancamento_id is not null;

comment on column public.producao_arquivos.lancamento_id is
  'O pagamento lançado de que este arquivo é a nota fiscal (nulo: arquivo da temporada ou da data). Pasta "documentos".';

-- ─── A coerência, agora com o lançamento ────────────────────────────────────
-- A mesma função da PD0.14, com dois erros novos: o lançamento é da organização e da temporada do arquivo.

create or replace function public.fn_producao_arquivo_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_partes text[];
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
    end if;
    if new.temporada_id is distinct from old.temporada_id then
      raise exception 'temporada_do_arquivo_nao_muda' using errcode = 'check_violation';
    end if;
    if new.pasta is distinct from old.pasta or new.storage_path is distinct from old.storage_path
       or new.tipo is distinct from old.tipo or new.tamanho is distinct from old.tamanho
       or new.sha256 is distinct from old.sha256 then
      raise exception 'arquivo_nao_muda' using errcode = 'check_violation';
    end if;
    -- Quem enviou só some (a conta foi apagada), nunca vira outra pessoa.
    if new.enviado_por is distinct from old.enviado_por and new.enviado_por is not null then
      raise exception 'enviado_por_nao_muda' using errcode = 'check_violation';
    end if;
    if new.data_id is not distinct from old.data_id and new.lancamento_id is not distinct from old.lancamento_id then
      return new;
    end if;
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if tg_op = 'INSERT' then
    v_partes := public.fn_producao_caminho_partes(new.storage_path);
    if v_partes is null then
      raise exception 'caminho_invalido' using errcode = 'check_violation';
    end if;
    if v_partes[1]::uuid is distinct from new.organization_id then
      raise exception 'caminho_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if v_partes[2]::uuid is distinct from new.temporada_id then
      raise exception 'caminho_de_outra_temporada' using errcode = 'check_violation';
    end if;
    if v_partes[3] is distinct from new.pasta then
      raise exception 'caminho_de_outra_pasta' using errcode = 'check_violation';
    end if;
    -- Sem usuário (a chave de serviço, uma rotina), quem envia é o que a rotina disser.
    if auth.uid() is not null and new.enviado_por is distinct from auth.uid() then
      raise exception 'enviado_por_invalido' using errcode = 'check_violation';
    end if;
    if not exists (
      select 1 from public.producao_temporadas t where t.id = new.temporada_id and t.organization_id = new.organization_id
    ) then
      raise exception 'temporada_de_outra_organizacao' using errcode = 'check_violation';
    end if;
  end if;
  if new.lancamento_id is not null then
    if not exists (
      select 1 from public.producao_lancamentos l where l.id = new.lancamento_id and l.organization_id = new.organization_id
    ) then
      raise exception 'lancamento_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if not exists (
      select 1 from public.producao_lancamentos l where l.id = new.lancamento_id and l.temporada_id = new.temporada_id
    ) then
      raise exception 'lancamento_de_outra_temporada' using errcode = 'check_violation';
    end if;
  end if;
  if new.data_id is not null then
    if not exists (
      select 1 from public.producao_datas d where d.id = new.data_id and d.organization_id = new.organization_id
    ) then
      raise exception 'data_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if not exists (
      select 1 from public.producao_datas d where d.id = new.data_id and d.temporada_id = new.temporada_id
    ) then
      raise exception 'data_de_outra_temporada' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger producao_arquivos_coerencia
  before insert or update on public.producao_arquivos
  for each row execute function public.fn_producao_arquivo_coerencia();
