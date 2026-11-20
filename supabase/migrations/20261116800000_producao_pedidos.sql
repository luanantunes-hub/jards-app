-- PD5.4 (primeiro corte): pedidos de pagamento com alçada.
--
-- producao_pedidos: um pedido de pagamento da temporada (um fornecedor, um cachê, uma diária), com quem pediu, o valor, a justificativa, a linha do orçamento de onde
-- sai e a situação: rascunho, pendente (esperando aprovação), aprovado, pagando, pago, ou recusado. A PRÓXIMA PENDÊNCIA (`pendencia`, `pendencia_ate`) é um texto à
-- parte da situação ("falta a nota do fornecedor", "esperando o contrato"), que a pessoa muda sem mexer na situação.
--
-- ALÇADA: aprovar não é regra de tabela. A situação só muda pela função `fn_producao_pedido_mudar` (security definer), que confere a permissão de cada passo e,
-- para aprovar, o valor do pedido contra a alçada de quem aprova (`producao_funcoes.alcada`, a regra da PD0.7: administrador não tem teto; colaborador com a função
-- "vê o dinheiro" e alçada definida aprova até o valor dela; alçada vazia não aprova; leitor nunca). O navegador não escreve a situação nem quem aprovou.
--
-- Pago só com lançamento ligado: a coluna nova `producao_lancamentos.pedido_id` liga um pagamento (PD5.3) a um pedido aprovado; o pedido só vira pago quando os
-- lançamentos ligados somam pelo menos o valor dele.
--
-- DINHEIRO: como o orçamento, só lê e escreve quem tem a permissão de dinheiro, sem histórico.
--
-- Regras no banco: nasce em rascunho; o caminho é rascunho, pendente, aprovado, pagando, pago (`pedido_passo_invalido` para o resto); pendente volta para rascunho e
-- recusado volta para rascunho (para ajustar e pedir de novo); recusar pede o motivo (`pedido_sem_motivo`); depois de enviado, o valor, a descrição, o favorecido, a
-- justificativa e a linha do orçamento não mudam (`pedido_enviado`); pago não muda (`pedido_pago`); só rascunho e recusado se apagam; a linha do orçamento é da
-- temporada (`linha_de_outra_temporada`); o lançamento só liga a pedido aprovado, da mesma temporada (`pedido_nao_aprovado`, `pedido_de_outra_temporada`).
-- Erros da função: `sem_permissao` (42501), `alcada_insuficiente`, `pedido_nao_encontrado`, `pedido_sem_lancamento`, `pedido_sem_motivo`, `passo_desconhecido`.
--
-- Expansão: uma tabela nova e vazia, uma coluna anulável, uma função nova e a função de gatilho do lançamento trocada (create or replace, mesma assinatura, mais uma
-- conferência). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_pedidos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  temporada_id uuid not null references public.producao_temporadas (id) on delete cascade,
  orcamento_linha_id uuid references public.producao_orcamento_linhas (id) on delete set null,
  solicitante_id uuid references auth.users (id) on delete set null,
  descricao text not null,
  favorecido text,
  valor numeric(14, 2) not null,
  justificativa text,
  situacao text not null default 'rascunho',
  aprovado_por uuid references auth.users (id) on delete set null,
  aprovado_em timestamptz,
  motivo_recusa text,
  pendencia text,
  pendencia_ate date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_pedidos_descricao_check check (char_length(btrim(descricao)) between 1 and 120),
  constraint producao_pedidos_favorecido_check check (favorecido is null or char_length(btrim(favorecido)) between 1 and 120),
  constraint producao_pedidos_valor_check check (valor > 0 and valor <= 999999999999.99),
  constraint producao_pedidos_justificativa_check check (justificativa is null or char_length(btrim(justificativa)) between 1 and 400),
  constraint producao_pedidos_situacao_check check (situacao in ('rascunho', 'pendente', 'aprovado', 'pagando', 'pago', 'recusado')),
  constraint producao_pedidos_motivo_check check (motivo_recusa is null or char_length(btrim(motivo_recusa)) between 1 and 300),
  constraint producao_pedidos_pendencia_check check (pendencia is null or char_length(btrim(pendencia)) between 1 and 200)
);

create index if not exists producao_pedidos_org_idx on public.producao_pedidos (organization_id);
create index if not exists producao_pedidos_temporada_idx on public.producao_pedidos (temporada_id, situacao);
create index if not exists producao_pedidos_linha_idx on public.producao_pedidos (orcamento_linha_id) where orcamento_linha_id is not null;

alter table public.producao_lancamentos add column if not exists pedido_id uuid references public.producao_pedidos (id) on delete set null;
create index if not exists producao_lancamentos_pedido_idx on public.producao_lancamentos (pedido_id) where pedido_id is not null;

-- Coerência do pedido. Erros (check_violation): organizacao_nao_muda, temporada_nao_muda, solicitante_nao_muda, temporada_de_outra_organizacao, linha_de_outra_temporada,
-- pedido_nasce_rascunho, pedido_pago, pedido_situacao_so_pela_funcao, pedido_passo_invalido, pedido_enviado, pedido_sem_motivo.
create or replace function public.fn_producao_pedido_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pela_funcao boolean := coalesce(current_setting('jards.producao_pedido', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    if old.situacao not in ('rascunho', 'recusado') and exists (select 1 from public.producao_temporadas t where t.id = old.temporada_id) then
      raise exception 'pedido_enviado' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.organization_id is null then
      return new; -- a coluna é not null: quem recusa é a tabela
    end if;
    if not exists (select 1 from public.producao_temporadas t where t.id = new.temporada_id and t.organization_id = new.organization_id) then
      raise exception 'temporada_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if new.situacao <> 'rascunho' then
      raise exception 'pedido_nasce_rascunho' using errcode = 'check_violation';
    end if;
    new.solicitante_id := coalesce(auth.uid(), new.solicitante_id);
    new.aprovado_por := null;
    new.aprovado_em := null;
    new.motivo_recusa := null;
  else
    if new.organization_id is distinct from old.organization_id then
      raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
    end if;
    if new.temporada_id is distinct from old.temporada_id then
      raise exception 'temporada_nao_muda' using errcode = 'check_violation';
    end if;
    if new.solicitante_id is distinct from old.solicitante_id and old.solicitante_id is not null and not v_pela_funcao then
      raise exception 'solicitante_nao_muda' using errcode = 'check_violation';
    end if;
    if old.situacao = 'pago' then
      raise exception 'pedido_pago' using errcode = 'check_violation';
    end if;
    if not v_pela_funcao and (new.situacao is distinct from old.situacao or new.aprovado_por is distinct from old.aprovado_por
                              or new.aprovado_em is distinct from old.aprovado_em or new.motivo_recusa is distinct from old.motivo_recusa) then
      raise exception 'pedido_situacao_so_pela_funcao' using errcode = 'check_violation';
    end if;
    if new.situacao is distinct from old.situacao then
      if not ((old.situacao, new.situacao) in (('rascunho', 'pendente'), ('pendente', 'rascunho'), ('pendente', 'aprovado'), ('pendente', 'recusado'),
                                               ('aprovado', 'pagando'), ('pagando', 'pago'), ('recusado', 'rascunho'))) then
        raise exception 'pedido_passo_invalido' using errcode = 'check_violation';
      end if;
      if new.situacao = 'recusado' and (new.motivo_recusa is null or btrim(new.motivo_recusa) = '') then
        raise exception 'pedido_sem_motivo' using errcode = 'check_violation';
      end if;
      if new.situacao in ('aprovado', 'recusado') then
        new.aprovado_por := auth.uid();
        new.aprovado_em := now();
      end if;
      if new.situacao = 'rascunho' then
        new.aprovado_por := null;
        new.aprovado_em := null;
        new.motivo_recusa := null;
      end if;
      if new.situacao <> 'recusado' and old.situacao <> 'recusado' then
        new.motivo_recusa := null;
      end if;
    end if;
    -- Depois de enviado, o que foi pedido não muda.
    if old.situacao <> 'rascunho' and (new.valor is distinct from old.valor or new.descricao is distinct from old.descricao or new.favorecido is distinct from old.favorecido
                                        or new.justificativa is distinct from old.justificativa or new.orcamento_linha_id is distinct from old.orcamento_linha_id) then
      raise exception 'pedido_enviado' using errcode = 'check_violation';
    end if;
  end if;
  if new.orcamento_linha_id is not null and (tg_op = 'INSERT' or new.orcamento_linha_id is distinct from old.orcamento_linha_id) then
    if not exists (
      select 1 from public.producao_orcamento_linhas ol join public.producao_orcamentos o on o.id = ol.orcamento_id
      where ol.id = new.orcamento_linha_id and ol.organization_id = new.organization_id and o.temporada_id = new.temporada_id
    ) then
      raise exception 'linha_de_outra_temporada' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- A coerência do lançamento (da PD5.3), agora com a ligação ao pedido aprovado da mesma temporada.
-- Erros (check_violation): organizacao_nao_muda, temporada_nao_muda, temporada_de_outra_organizacao, divisao_passa_do_valor, pedido_de_outra_temporada, pedido_nao_aprovado.
create or replace function public.fn_producao_lancamento_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_situacao text;
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
    end if;
    if new.temporada_id is distinct from old.temporada_id then
      raise exception 'temporada_nao_muda' using errcode = 'check_violation';
    end if;
    -- Baixar o valor abaixo do que já foi dividido deixaria a divisão passando do total.
    if new.valor < old.valor and (select coalesce(sum(l.valor), 0) from public.producao_lancamento_linhas l where l.lancamento_id = new.id) > new.valor then
      raise exception 'divisao_passa_do_valor' using errcode = 'check_violation';
    end if;
  else
    if new.organization_id is null then
      return new; -- a coluna é not null: quem recusa é a tabela
    end if;
    if not exists (select 1 from public.producao_temporadas t where t.id = new.temporada_id and t.organization_id = new.organization_id) then
      raise exception 'temporada_de_outra_organizacao' using errcode = 'check_violation';
    end if;
  end if;
  if new.pedido_id is not null and (tg_op = 'INSERT' or new.pedido_id is distinct from old.pedido_id) then
    select p.situacao into v_situacao from public.producao_pedidos p where p.id = new.pedido_id and p.organization_id = new.organization_id and p.temporada_id = new.temporada_id;
    if not found then
      raise exception 'pedido_de_outra_temporada' using errcode = 'check_violation';
    end if;
    if v_situacao in ('rascunho', 'pendente', 'recusado') then
      raise exception 'pedido_nao_aprovado' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- A única porta para mudar a situação de um pedido: confere a permissão de cada passo e, para aprovar, o valor contra a alçada.
-- p_para: enviar, retirar, aprovar, recusar, reabrir, pagar (começa a pagar) ou concluir (pago). p_motivo só serve para recusar.
create or replace function public.fn_producao_pedido_mudar(p_pedido uuid, p_passo text, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido public.producao_pedidos%rowtype;
  v_ficha record;
  v_lancado numeric;
  v_para text;
begin
  if auth.uid() is null then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  select * into v_pedido from public.producao_pedidos where id = p_pedido for update;
  if not found then
    raise exception 'pedido_nao_encontrado' using errcode = 'check_violation';
  end if;
  v_para := case p_passo
    when 'enviar' then 'pendente' when 'retirar' then 'rascunho' when 'aprovar' then 'aprovado' when 'recusar' then 'recusado'
    when 'reabrir' then 'rascunho' when 'pagar' then 'pagando' when 'concluir' then 'pago' end;
  if v_para is null then
    raise exception 'passo_desconhecido' using errcode = 'check_violation';
  end if;
  if p_passo in ('aprovar', 'recusar') then
    if not public.auth_producao_pode(v_pedido.organization_id, 'aprovar') or not public.auth_producao_pode(v_pedido.organization_id, 'dinheiro') then
      raise exception 'sem_permissao' using errcode = '42501';
    end if;
    if p_passo = 'aprovar' and not public.is_jards_super_admin() then
      select * into v_ficha from public.auth_producao_ficha(v_pedido.organization_id);
      if v_ficha.papel <> 'admin' and (v_ficha.alcada is null or v_pedido.valor > v_ficha.alcada) then
        raise exception 'alcada_insuficiente' using errcode = 'check_violation';
      end if;
    end if;
  else
    if not (public.auth_producao_pode(v_pedido.organization_id, 'editar') and public.auth_producao_pode(v_pedido.organization_id, 'dinheiro')) then
      raise exception 'sem_permissao' using errcode = '42501';
    end if;
  end if;
  if p_passo = 'concluir' then
    select coalesce(sum(l.valor), 0) into v_lancado from public.producao_lancamentos l where l.pedido_id = v_pedido.id;
    if v_lancado < v_pedido.valor then
      raise exception 'pedido_sem_lancamento' using errcode = 'check_violation';
    end if;
  end if;
  perform set_config('jards.producao_pedido', 'on', true);
  update public.producao_pedidos set situacao = v_para, motivo_recusa = case when p_passo = 'recusar' then nullif(btrim(coalesce(p_motivo, '')), '') else motivo_recusa end where id = v_pedido.id;
  perform set_config('jards.producao_pedido', 'off', true);
end;
$$;

create or replace trigger producao_pedidos_coerencia
  before insert or update or delete on public.producao_pedidos
  for each row execute function public.fn_producao_pedido_coerencia();
create or replace trigger producao_pedidos_updated_at
  before update on public.producao_pedidos
  for each row execute function public.fn_producao_updated_at();

alter table public.producao_pedidos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_pedidos' and policyname = 'producao_pedidos: le') then
    create policy "producao_pedidos: le" on public.producao_pedidos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_temporadas t where t.id = producao_pedidos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_pedidos' and policyname = 'producao_pedidos: leitura sem assinatura') then
    create policy "producao_pedidos: leitura sem assinatura" on public.producao_pedidos for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_temporadas t where t.id = producao_pedidos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_pedidos' and policyname = 'producao_pedidos: insere') then
    create policy "producao_pedidos: insere" on public.producao_pedidos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_temporadas t where t.id = producao_pedidos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_pedidos' and policyname = 'producao_pedidos: edita') then
    create policy "producao_pedidos: edita" on public.producao_pedidos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_temporadas t where t.id = producao_pedidos.temporada_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_temporadas t where t.id = producao_pedidos.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_pedidos' and policyname = 'producao_pedidos: apaga') then
    create policy "producao_pedidos: apaga" on public.producao_pedidos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_temporadas t where t.id = producao_pedidos.temporada_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_pedido_coerencia() from public, anon, authenticated;
revoke all on public.producao_pedidos from anon, authenticated;
-- A situação, quem aprovou, quando e o motivo da recusa só a função escreve; o navegador escreve o resto.
grant select, delete on public.producao_pedidos to authenticated;
grant insert (organization_id, temporada_id, orcamento_linha_id, descricao, favorecido, valor, justificativa, pendencia, pendencia_ate) on public.producao_pedidos to authenticated;
grant update (orcamento_linha_id, descricao, favorecido, valor, justificativa, pendencia, pendencia_ate) on public.producao_pedidos to authenticated;

revoke execute on function public.fn_producao_pedido_mudar(uuid, text, text) from public, anon;
grant execute on function public.fn_producao_pedido_mudar(uuid, text, text) to authenticated;

comment on table public.producao_pedidos is 'Pedido de pagamento da temporada: rascunho, pendente, aprovado, pagando, pago ou recusado. A situação só muda pela função fn_producao_pedido_mudar, que confere a alçada. Pago só com lançamento ligado. Dinheiro: só com a permissão. Sem histórico.';
comment on column public.producao_lancamentos.pedido_id is 'O pedido aprovado que este pagamento cumpre; o pedido só vira pago quando os lançamentos ligados somam o valor dele.';
