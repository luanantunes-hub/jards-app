-- fn_sync_empresa_tipo passa a rodar com as permissões do dono, só dentro da organização da linha.
--
-- O gatilho recalcula o tipo da empresa (prospect, cliente ativo, ex-cliente) quando
-- muda uma negociação, uma inscrição ou uma conta de patrocínio. Rodava com as
-- permissões de quem gravou, e a regra de atualizar empresas_crm é "só quem criou a
-- empresa". Desde a PD0.4b (20261015054136) a equipe inteira da organização edita
-- negociações, contas e inscrições; quando um colega que não criou a empresa encerra a
-- conta de um cliente, a empresa continuava cliente ativo, sem erro (conferido em
-- 15/10/2026 numa transação desfeita: com a função anterior a empresa ficou
-- cliente_ativo, com esta ficou ex_cliente). Hoje nenhuma organização tem mais de uma
-- pessoa interna, então ninguém foi atingido; o ajuste vem antes de as equipes crescerem.
--
-- O que muda:
--   security definer + search_path fixo     o gatilho atualiza a empresa mesmo quando
--                                           quem gravou não a criou.
--   tudo filtrado pela organização da linha as leituras (contas, negociações, inscrições
--                                           e a cadeia de renovações) e a atualização só
--                                           olham linhas da MESMA organização da linha que
--                                           disparou o gatilho. Sem isso, rodar como dono
--                                           deixaria uma linha da organização A mudar a
--                                           empresa da organização B (a função anterior já
--                                           deixava, quando a gravação vinha da chave de
--                                           serviço ou de função do banco; conferido).
--   sem execute para o navegador            é função de gatilho; o gatilho dispara sem
--                                           precisar de permissão de execução (conferido).
--
-- O que NÃO muda: a regra de quem é cliente (conta ativa, última negociação decisiva
-- aprovada, última inscrição decisiva aprovada) e os três gatilhos
-- (trg_sync_empresa_tipo, trg_sync_empresa_tipo_captacoes, trg_sync_empresa_tipo_editais).
-- Nenhuma empresa existente muda de tipo por esta migration (só o próximo evento recalcula).
--
-- Sem DROP, reaplicável: create or replace e revoke repetem o mesmo resultado.

set local lock_timeout = '10s';

create or replace function public.fn_sync_empresa_tipo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_empresa_id uuid;
  v_org uuid;
  v_tem_conta_ativa boolean;
  v_tem_captacao_cliente boolean;
  v_tem_edital_cliente boolean;
  v_e_cliente boolean;
begin
  if TG_OP = 'DELETE' then
    v_empresa_id := OLD.empresa_crm_id;
    v_org := OLD.organization_id;
  else
    v_empresa_id := NEW.empresa_crm_id;
    v_org := NEW.organization_id;
  end if;

  if v_empresa_id is null then
    if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
  end if;

  select exists(
    select 1 from contas_patrocinio where empresa_crm_id = v_empresa_id and organization_id = v_org and status = 'ativa'
  ) into v_tem_conta_ativa;

  -- Cada linhagem de captações (agrupada pela raiz da cadeia de renovação):
  -- pega o status decisivo (aprovado/recusado) mais recente, ignorando ciclos
  -- ainda em andamento. Se o mais recente decisivo for 'aprovado', conta.
  with recursive linhagem as (
    select id, id as raiz_id, status, ciclo_ano
    from captacoes
    where empresa_crm_id = v_empresa_id and organization_id = v_org and ciclo_anterior_id is null
    union all
    select f.id, l.raiz_id, f.status, f.ciclo_ano
    from captacoes f
    join linhagem l on f.ciclo_anterior_id = l.id
    where f.organization_id = v_org
  ),
  ultimo_decisivo as (
    select distinct on (raiz_id) raiz_id, status
    from linhagem
    where status in ('aprovado', 'recusado')
    order by raiz_id, ciclo_ano desc nulls last, id desc
  )
  select exists(select 1 from ultimo_decisivo where status = 'aprovado')
  into v_tem_captacao_cliente;

  -- Mesma lógica para inscrições em editais.
  with recursive linhagem as (
    select id, id as raiz_id, status, ciclo_ano
    from editais_user
    where empresa_crm_id = v_empresa_id and organization_id = v_org and ciclo_anterior_id is null
    union all
    select f.id, l.raiz_id, f.status, f.ciclo_ano
    from editais_user f
    join linhagem l on f.ciclo_anterior_id = l.id
    where f.organization_id = v_org
  ),
  ultimo_decisivo as (
    select distinct on (raiz_id) raiz_id, status
    from linhagem
    where status in ('aprovado', 'reprovado', 'cancelado')
    order by raiz_id, ciclo_ano desc nulls last, id desc
  )
  select exists(select 1 from ultimo_decisivo where status = 'aprovado')
  into v_tem_edital_cliente;

  v_e_cliente := v_tem_conta_ativa or v_tem_captacao_cliente or v_tem_edital_cliente;

  if v_e_cliente then
    update empresas_crm set tipo = 'cliente_ativo' where id = v_empresa_id and organization_id = v_org and tipo != 'cliente_ativo';
  else
    update empresas_crm set tipo = 'ex_cliente' where id = v_empresa_id and organization_id = v_org and tipo = 'cliente_ativo';
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  else
    return NEW;
  end if;
end;
$$;

revoke execute on function public.fn_sync_empresa_tipo() from public, anon, authenticated;

comment on function public.fn_sync_empresa_tipo() is
  'Gatilho: recalcula empresas_crm.tipo (prospect, cliente_ativo, ex_cliente) a partir das contas, negociações e inscrições da mesma organização. Roda como dono para valer quando um colega que não criou a empresa altera a negociação.';
