-- PD6.3 (segundo corte): a foto da conferência. Quem confere o checklist de transporte pode anexar uma foto à saída e outra à volta de cada
-- linha (o item avariado, o que faltou, o lacre do caminhão). A foto é um arquivo comum da produção (producao_arquivos, na pasta
-- "deslocamentos"): a linha só guarda qual é. Apagar o arquivo solta a foto da linha, sem apagar a linha.
--
-- O banco confere que a foto é um arquivo da mesma organização, da pasta "deslocamentos" e, se o arquivo está ligado a uma data, da MESMA data do
-- deslocamento (`foto_invalida`). A função de coerência da linha é reescrita com o mesmo texto de antes mais essa conferência (create or replace,
-- mesma assinatura). Duas colunas novas e vazias; aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.producao_checklist_itens add column if not exists saida_foto_id uuid references public.producao_arquivos (id) on delete set null;
alter table public.producao_checklist_itens add column if not exists volta_foto_id uuid references public.producao_arquivos (id) on delete set null;

create index if not exists producao_checklist_itens_saida_foto_idx on public.producao_checklist_itens (saida_foto_id) where saida_foto_id is not null;
create index if not exists producao_checklist_itens_volta_foto_idx on public.producao_checklist_itens (volta_foto_id) where volta_foto_id is not null;

-- Erros (check_violation): organizacao_nao_muda, deslocamento_nao_muda, deslocamento_de_outra_organizacao, item_de_outra_organizacao, foto_invalida.
create or replace function public.fn_producao_checklist_item_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_data uuid;
  v_foto uuid;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.deslocamento_id is distinct from old.deslocamento_id then
    raise exception 'deslocamento_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  select d.data_id into v_data from public.producao_deslocamentos d where d.id = new.deslocamento_id and d.organization_id = new.organization_id;
  if not found then
    raise exception 'deslocamento_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.item_id is not null and not exists (select 1 from public.producao_itens i where i.id = new.item_id and i.organization_id = new.organization_id) then
    raise exception 'item_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  for v_foto in
    select f from unnest(array[
      case when tg_op = 'INSERT' or new.saida_foto_id is distinct from old.saida_foto_id then new.saida_foto_id end,
      case when tg_op = 'INSERT' or new.volta_foto_id is distinct from old.volta_foto_id then new.volta_foto_id end
    ]) as f where f is not null
  loop
    if not exists (
      select 1 from public.producao_arquivos a
      where a.id = v_foto and a.organization_id = new.organization_id and a.pasta = 'deslocamentos' and (a.data_id is null or a.data_id = v_data)
    ) then
      raise exception 'foto_invalida' using errcode = 'check_violation';
    end if;
  end loop;
  if tg_op = 'INSERT' then
    new.saida_em := case when new.saida = 'pendente' then null else now() end;
    new.volta_em := case when new.volta = 'pendente' then null else now() end;
  else
    if new.saida is distinct from old.saida then
      new.saida_em := case when new.saida = 'pendente' then null else now() end;
    end if;
    if new.volta is distinct from old.volta then
      new.volta_em := case when new.volta = 'pendente' then null else now() end;
    end if;
  end if;
  return new;
end;
$$;
