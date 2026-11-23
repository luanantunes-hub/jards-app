-- Ticketeria: a planta de fundo do mapa da sala (M4 do estudo ticketeria-mapa-de-assentos-avancado.md, seção 5.3).
--
-- A sala passa a poder guardar, dentro da própria `ticketeria_salas.planta`, uma imagem por baixo do desenho (a planta da sala, vinda de um PDF ou de uma imagem enviada pela biblioteca de
-- imagens da loja): `fundo` = { caminho, x, y, largura, altura, opacidade }. O caminho é o do arquivo no espaço público `ticketeria-site` (<id da organização>/<id da imagem>.<webp|jpg|png>), então
-- NENHUM arquivo novo mora no banco e nada de fora entra: o banco recusa qualquer outro endereço. O mapa do comprador já devolve a planta inteira, então ele passa a trazer o fundo sem mudar.
--
--   - `fn_ticketeria_planta_ok(jsonb)`: corpo trocado, MESMA assinatura. Confere também o `fundo`, quando há (ausente ou nulo serve): caminho no formato acima, x e y entre -2000 e 2000, largura e
--     altura de 1 a 4000 e opacidade inteira de 10 a 100. A trava `ticketeria_salas_planta_check` já chama esta função, então vale para quem grava direto. Parte da versão de produção
--     (a de 20261123153914_ticketeria_planta_da_sala.sql).
--
-- Expansão: troca de corpo de uma função de formato. Aditiva e reaplicável; sem coluna nova, sem DROP.

set local lock_timeout = '10s';

create or replace function public.fn_ticketeria_planta_ok(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_setor jsonb;
  v_ids text[] := '{}';
  v_palco jsonb;
  v_fundo jsonb;
begin
  if p is null then
    return true;
  end if;
  if jsonb_typeof(p) <> 'object' or p -> 'versao' is distinct from '1'::jsonb then
    return false;
  end if;
  if jsonb_typeof(p -> 'setores') <> 'array' then
    return false;
  end if;
  if jsonb_array_length(p -> 'setores') < 1 or jsonb_array_length(p -> 'setores') > 40 then
    return false;
  end if;
  for v_setor in select * from jsonb_array_elements(p -> 'setores') loop
    if jsonb_typeof(v_setor) <> 'object' then
      return false;
    end if;
    if jsonb_typeof(v_setor -> 'setor') <> 'string' then
      return false;
    end if;
    if (v_setor ->> 'setor') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or (v_setor ->> 'setor') = any (v_ids) then
      return false;
    end if;
    v_ids := v_ids || (v_setor ->> 'setor');
    if not public.fn_ticketeria_layout_numero(v_setor -> 'x', -2000, 2000) or not public.fn_ticketeria_layout_numero(v_setor -> 'y', -2000, 2000) then
      return false;
    end if;
    if jsonb_typeof(v_setor -> 'cor') <> 'string' then
      return false;
    end if;
    if (v_setor ->> 'cor') !~ '^#[0-9a-fA-F]{6}$' then
      return false;
    end if;
  end loop;
  v_palco := p -> 'palco';
  if v_palco is not null and jsonb_typeof(v_palco) <> 'null' then
    if jsonb_typeof(v_palco) <> 'object' then
      return false;
    end if;
    if not public.fn_ticketeria_layout_numero(v_palco -> 'x', -2000, 2000) or not public.fn_ticketeria_layout_numero(v_palco -> 'y', -2000, 2000)
       or not public.fn_ticketeria_layout_numero(v_palco -> 'largura', 1, 2000) or not public.fn_ticketeria_layout_numero(v_palco -> 'altura', 0.5, 100) then
      return false;
    end if;
    if jsonb_typeof(v_palco -> 'rotulo') <> 'string' then
      return false;
    end if;
    if char_length(v_palco ->> 'rotulo') not between 1 and 30 then
      return false;
    end if;
  end if;
  v_fundo := p -> 'fundo';
  if v_fundo is not null and jsonb_typeof(v_fundo) <> 'null' then
    if jsonb_typeof(v_fundo) <> 'object' then
      return false;
    end if;
    if jsonb_typeof(v_fundo -> 'caminho') <> 'string' then
      return false;
    end if;
    -- <id da organização>/<id da imagem>.<webp|jpg|png>: só uma imagem da biblioteca de imagens da loja (espaço `ticketeria-site`), nunca um endereço de fora.
    if (v_fundo ->> 'caminho') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$' then
      return false;
    end if;
    if not public.fn_ticketeria_layout_numero(v_fundo -> 'x', -2000, 2000) or not public.fn_ticketeria_layout_numero(v_fundo -> 'y', -2000, 2000)
       or not public.fn_ticketeria_layout_numero(v_fundo -> 'largura', 1, 4000) or not public.fn_ticketeria_layout_numero(v_fundo -> 'altura', 1, 4000)
       or not public.fn_ticketeria_layout_numero(v_fundo -> 'opacidade', 10, 100, true) then
      return false;
    end if;
  end if;
  return true;
end;
$$;

-- Quem executa: o de sempre (logado sim, visitante não).
revoke execute on function public.fn_ticketeria_planta_ok(jsonb) from public, anon;
grant execute on function public.fn_ticketeria_planta_ok(jsonb) to authenticated, service_role;
