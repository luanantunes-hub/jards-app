-- Corrige fn_sync_empresa_tipo(): uma aprovação não vale para sempre.
-- Para cada linhagem de renovação (via ciclo_anterior_id), o que conta é o
-- resultado DECISIVO mais recente daquela linhagem — ignorando ciclos ainda
-- em andamento (prospecção, em análise, etc). Enquanto a renovação de uma
-- negociação aprovada não é decidida, a aprovação anterior continua valendo;
-- só quando a renovação é recusada/reprovada é que a empresa deixa de ser
-- cliente por aquela linha.

create or replace function fn_sync_empresa_tipo()
returns trigger as $$
declare
  v_empresa_id uuid;
  v_tem_conta_ativa boolean;
  v_tem_captacao_cliente boolean;
  v_tem_edital_cliente boolean;
  v_e_cliente boolean;
begin
  if TG_OP = 'DELETE' then
    v_empresa_id := OLD.empresa_crm_id;
  else
    v_empresa_id := NEW.empresa_crm_id;
  end if;

  if v_empresa_id is null then
    if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
  end if;

  select exists(
    select 1 from contas_patrocinio where empresa_crm_id = v_empresa_id and status = 'ativa'
  ) into v_tem_conta_ativa;

  -- Cada linhagem de captações (agrupada pela raiz da cadeia de renovação):
  -- pega o status decisivo (aprovado/recusado) mais recente, ignorando ciclos
  -- ainda em andamento. Se o mais recente decisivo for 'aprovado', conta.
  with recursive linhagem as (
    select id, id as raiz_id, status, ciclo_ano
    from captacoes
    where empresa_crm_id = v_empresa_id and ciclo_anterior_id is null
    union all
    select f.id, l.raiz_id, f.status, f.ciclo_ano
    from captacoes f
    join linhagem l on f.ciclo_anterior_id = l.id
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
    where empresa_crm_id = v_empresa_id and ciclo_anterior_id is null
    union all
    select f.id, l.raiz_id, f.status, f.ciclo_ano
    from editais_user f
    join linhagem l on f.ciclo_anterior_id = l.id
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
    update empresas_crm set tipo = 'cliente_ativo' where id = v_empresa_id and tipo != 'cliente_ativo';
  else
    update empresas_crm set tipo = 'ex_cliente' where id = v_empresa_id and tipo = 'cliente_ativo';
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  else
    return NEW;
  end if;
end;
$$ language plpgsql;

-- Reaplica a regra corrigida aos dados existentes
update empresas_crm e set tipo = 'ex_cliente'
where tipo = 'cliente_ativo'
  and not exists(select 1 from contas_patrocinio where empresa_crm_id = e.id and status = 'ativa')
  and not exists(
    with recursive linhagem as (
      select id, id as raiz_id, status, ciclo_ano from captacoes
      where empresa_crm_id = e.id and ciclo_anterior_id is null
      union all
      select f.id, l.raiz_id, f.status, f.ciclo_ano from captacoes f
      join linhagem l on f.ciclo_anterior_id = l.id
    ),
    ultimo_decisivo as (
      select distinct on (raiz_id) raiz_id, status from linhagem
      where status in ('aprovado', 'recusado')
      order by raiz_id, ciclo_ano desc nulls last, id desc
    )
    select 1 from ultimo_decisivo where status = 'aprovado'
  )
  and not exists(
    with recursive linhagem as (
      select id, id as raiz_id, status, ciclo_ano from editais_user
      where empresa_crm_id = e.id and ciclo_anterior_id is null
      union all
      select f.id, l.raiz_id, f.status, f.ciclo_ano from editais_user f
      join linhagem l on f.ciclo_anterior_id = l.id
    ),
    ultimo_decisivo as (
      select distinct on (raiz_id) raiz_id, status from linhagem
      where status in ('aprovado', 'reprovado', 'cancelado')
      order by raiz_id, ciclo_ano desc nulls last, id desc
    )
    select 1 from ultimo_decisivo where status = 'aprovado'
  );
