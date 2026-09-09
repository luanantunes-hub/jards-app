-- Expande fn_sync_empresa_tipo(): além de conta de patrocínio ativa,
-- inscrição em edital aprovada ou negociação aprovada também tornam a empresa cliente.
-- Reverte para ex_cliente quando nenhuma dessas fontes permanece ativa/aprovada.

create or replace function fn_sync_empresa_tipo()
returns trigger as $$
declare
  v_empresa_id uuid;
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
    union all
    select 1 from editais_user where empresa_crm_id = v_empresa_id and status = 'aprovado'
    union all
    select 1 from captacoes where empresa_crm_id = v_empresa_id and status = 'aprovado'
  ) into v_e_cliente;

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

drop trigger if exists trg_sync_empresa_tipo_editais on editais_user;
create trigger trg_sync_empresa_tipo_editais
  after insert or update or delete on editais_user
  for each row execute function fn_sync_empresa_tipo();

drop trigger if exists trg_sync_empresa_tipo_captacoes on captacoes;
create trigger trg_sync_empresa_tipo_captacoes
  after insert or update or delete on captacoes
  for each row execute function fn_sync_empresa_tipo();

-- Backfill: aplica a regra a empresas que já têm edital ou negociação aprovados hoje
update empresas_crm e
set tipo = 'cliente_ativo'
where tipo != 'cliente_ativo'
  and (
    exists(select 1 from contas_patrocinio where empresa_crm_id = e.id and status = 'ativa')
    or exists(select 1 from editais_user where empresa_crm_id = e.id and status = 'aprovado')
    or exists(select 1 from captacoes where empresa_crm_id = e.id and status = 'aprovado')
  );
