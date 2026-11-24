-- Ticketeria: salvar o desenho da sala de uma vez (o desenho passou a ser da SALA toda, com cada bloco atribuído a um setor; ver lib/ticketeria/desenho-da-sala.ts).
--
-- Salvar distribui o desenho: cada setor com blocos recebe os seus (layout) e as fileiras e lugares que eles descrevem, e a sala recebe a planta (cores, pistas, palco e fundo). Tudo isso tem de valer
-- junto ou não valer: um setor salvo e outro não deixaria a sala pela metade.
--
--   - `fn_ticketeria_salvar_desenho_da_sala(p_sala uuid, p_setores jsonb, p_planta jsonb)`: função NOVA (outro nome: nenhuma sobrecarga, PGRST203). `p_setores` é uma lista de
--     { setor, corredor, fileiras, layout }; para cada um chama a `fn_ticketeria_salvar_mapa_com_layout` de sempre (as mesmas regras: lugar vendido não sai do mapa, layout bate com os lugares, setor
--     arquivado não salva), conferindo antes que o setor é desta sala; depois grava `ticketeria_salas.planta` (nulo tira o mapa da sala). Recusa: `desenho_invalido` (formato), `setor_de_outra_sala`,
--     `planta_invalida` (formato, ou um setor da planta que não é da sala) e `sala_nao_encontrada`. Roda com os direitos de quem chama (as regras de acesso das tabelas valem). Uma chamada, uma
--     transação: se qualquer passo falha, nada muda.
--
-- Expansão: função nova. Aditiva e reaplicável; sem coluna nova, sem DROP.

set local lock_timeout = '10s';

create or replace function public.fn_ticketeria_salvar_desenho_da_sala(p_sala uuid, p_setores jsonb, p_planta jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_setor uuid;
  v_total integer := 0;
begin
  if p_planta is not null and jsonb_typeof(p_planta) = 'null' then
    p_planta := null;
  end if;
  if p_setores is null or jsonb_typeof(p_setores) <> 'array' or jsonb_array_length(p_setores) > 40 then
    raise exception 'desenho_invalido' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.ticketeria_salas where id = p_sala) then
    raise exception 'sala_nao_encontrada' using errcode = 'check_violation';
  end if;
  if p_planta is not null then
    if not public.fn_ticketeria_planta_ok(p_planta) then
      raise exception 'planta_invalida' using errcode = 'check_violation';
    end if;
    -- Todo setor da planta é desta sala (a função de formato já garante que o id é um uuid).
    if exists (
      select 1 from jsonb_array_elements(p_planta -> 'setores') e
      where not exists (select 1 from public.ticketeria_setores s where s.id = (e ->> 'setor')::uuid and s.sala_id = p_sala)
    ) then
      raise exception 'planta_invalida' using errcode = 'check_violation';
    end if;
  end if;
  for v_item in select * from jsonb_array_elements(p_setores) loop
    if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item -> 'setor') is distinct from 'string'
       or (v_item ->> 'setor') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(v_item -> 'fileiras') is distinct from 'array' then
      raise exception 'desenho_invalido' using errcode = 'check_violation';
    end if;
    v_setor := (v_item ->> 'setor')::uuid;
    if not exists (select 1 from public.ticketeria_setores s where s.id = v_setor and s.sala_id = p_sala) then
      raise exception 'setor_de_outra_sala' using errcode = 'check_violation';
    end if;
    perform public.fn_ticketeria_salvar_mapa_com_layout(v_setor, v_item -> 'fileiras', coalesce((v_item ->> 'corredor')::boolean, true), v_item -> 'layout');
    v_total := v_total + 1;
  end loop;
  update public.ticketeria_salas set planta = p_planta where id = p_sala;
  if not found then
    raise exception 'sala_nao_encontrada' using errcode = 'check_violation';
  end if;
  return jsonb_build_object('setores', v_total, 'planta', p_planta is not null);
end;
$$;

-- Quem executa: o logado (as regras de acesso das tabelas decidem o que ele pode mudar); o visitante não.
revoke execute on function public.fn_ticketeria_salvar_desenho_da_sala(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.fn_ticketeria_salvar_desenho_da_sala(uuid, jsonb, jsonb) to authenticated;
