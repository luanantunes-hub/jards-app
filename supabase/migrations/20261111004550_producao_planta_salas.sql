-- PD3.7: a planta do espaço, com as salas como objetos.
--
-- O objeto da planta ganha a sala a que corresponde (`sala_id`): numa planta do espaço, cada sala é um retângulo que se
-- arrasta como qualquer objeto, e a ocupação do dia (lib/producao/pauta.ts) é pintada por cima, na tela, a partir das
-- pautas; nada de ocupação é guardado na planta. Uma sala aparece no máximo uma vez por planta. Se a planta tem espaço,
-- a sala é desse espaço.
--
-- Acesso, histórico e chaves: os mesmos de producao_planta_objetos (nenhuma regra muda); apagar a sala só solta o objeto
-- (fica o rótulo e o tamanho).
--
-- Expansão: uma coluna nova anulável, um índice, a função de coerência trocada (create or replace, mesma assinatura,
-- as conferências de antes mais as da sala) e o gatilho refeito com a coluna nova. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.producao_planta_objetos add column if not exists sala_id uuid references public.producao_salas (id) on delete set null;

create unique index if not exists producao_planta_objetos_sala_key on public.producao_planta_objetos (planta_id, sala_id) where sala_id is not null;
create index if not exists producao_planta_objetos_sala_idx on public.producao_planta_objetos (sala_id) where sala_id is not null;

-- Coerência do objeto: a de producao_plantas (20261106185546) mais a sala. Erros (check_violation): organizacao_nao_muda,
-- planta_nao_muda, planta_de_outra_organizacao, item_de_outra_organizacao, sala_de_outra_organizacao, sala_de_outro_espaco.
create or replace function public.fn_producao_planta_objeto_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.planta_id is distinct from old.planta_id then
    raise exception 'planta_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_plantas p where p.id = new.planta_id and p.organization_id = new.organization_id) then
    raise exception 'planta_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.item_id is not null and not exists (select 1 from public.producao_itens i where i.id = new.item_id and i.organization_id = new.organization_id) then
    raise exception 'item_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.sala_id is not null then
    if not exists (select 1 from public.producao_salas s where s.id = new.sala_id and s.organization_id = new.organization_id) then
      raise exception 'sala_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.producao_plantas p where p.id = new.planta_id and p.espaco_id is not null)
       and not exists (select 1 from public.producao_plantas p join public.producao_salas s on s.espaco_id = p.espaco_id
                       where p.id = new.planta_id and s.id = new.sala_id) then
      raise exception 'sala_de_outro_espaco' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger producao_planta_objetos_coerencia
  before insert or update of organization_id, planta_id, item_id, sala_id on public.producao_planta_objetos
  for each row execute function public.fn_producao_planta_objeto_coerencia();

comment on column public.producao_planta_objetos.sala_id is
  'A sala do espaço que este objeto representa, numa planta do espaço. A ocupação é pintada na tela, a partir das pautas.';
