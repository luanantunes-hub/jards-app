-- Estoque único da Ticketeria: o setor é um balde de lugares por sessão, e todos os tipos de ingresso (inteira, meia, social…) tiram dele.
-- Desenho: docs/acoes-futuras/estudos/ticketeria-estoque-unico.md. A meia-entrada não reserva lugar: a lei a limita a 40%, e esse teto é só a quantidade do
-- lote da meia (o produtor é avisado na tela se passar, mas o banco não o impede).
--
-- Antes: a soma das quantidades dos lotes de um setor tinha de caber nos lugares, e a venda só deixava vender o que sobrava em cada lote. Com
-- Inteira = 60% e Meia = 40%, quando as inteiras esgotavam a venda parava e os lugares da meia ficavam vazios.
-- Agora:
--   - fn_ticketeria_ocupados_do_setor(sessão, setor, fora): quanto da sessão já está pago ou reservado (não vencido) em todos os ingressos do setor;
--   - fn_ticketeria_reservar: trava a linha do setor (antes dos lotes) e o que sobra de um lote é o menor entre o teto do lote e o balde;
--   - fn_ticketeria_confirmar_pagamento_real: pago depois do prazo, o balde de cada setor também tem de caber (reserva_expirada_sem_lugar);
--   - fn_ticketeria_livres: nunca mais que o balde (vitrine, lista de espera);
--   - fn_ticketeria_conferir_lugares: cada lote, sozinho, cabe nos lugares do setor (a soma deixa de ser exigida; lugares_excedidos);
--   - fn_ticketeria_comecar_pracas: a Inteira nasce com todos os lugares e a Meia com o teto de 40% (a mesma conta de antes: floor(lugares * 0,4)).
-- Eventos que já existem não são tocados: as quantidades antigas valem como tetos e a soma delas segue dentro do setor.
-- Mesmas assinaturas, só create or replace; sem DROP, sem sobrecarga (PGRST203); reaplicável. Os grants das funções ficam como estão.

set local lock_timeout = '10s';

create or replace function public.fn_ticketeria_ocupados_do_setor(p_sessao uuid, p_setor uuid, p_fora uuid default null)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(it.quantidade), 0)
  from public.ticketeria_pedido_itens it
  join public.ticketeria_pedidos p on p.id = it.pedido_id
  join public.ticketeria_ingressos ig on ig.id = it.ingresso_id
  where ig.setor_id = p_setor and p.sessao_id = p_sessao and p.id is distinct from p_fora
    and (p.situacao = 'pago' or (p.situacao = 'aguardando_pagamento' and p.reservado_ate > now()));
$$;

revoke execute on function public.fn_ticketeria_ocupados_do_setor(uuid, uuid, uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_ticketeria_conferir_lugares(p_evento uuid, p_setor uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_organizacao uuid;
  v_lugares integer;
  v_oferta bigint;
begin
  select s.organization_id, s.lugares into v_organizacao, v_lugares from public.ticketeria_setores s where s.id = p_setor for update;
  if auth.uid() is not null and not public.auth_ticketeria_pode(v_organizacao, 'editar') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  select coalesce(max(l.quantidade), 0) into v_oferta
  from public.ticketeria_lotes l
  join public.ticketeria_ingressos i on i.id = l.ingresso_id
  where i.evento_id = p_evento and i.setor_id = p_setor and not i.arquivado;
  if v_oferta > v_lugares then
    raise exception 'lugares_excedidos' using errcode = 'check_violation';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_ticketeria_reservar(p_sessao uuid, p_itens jsonb, p_nome text, p_email text, p_minutos integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_sessao record;
  v_evento record;
  v_taxa record;
  v_pedido uuid := gen_random_uuid();
  v_codigo text;
  v_item jsonb;
  v_ingresso record;
  v_lote record;
  v_pedidos jsonb := '[]'::jsonb;
  v_restante integer;
  v_livres bigint;
  v_lugares_setor integer;
  v_tirar integer;
  v_taxa_unit integer;
  v_total bigint := 0;
  v_taxa_total bigint := 0;
  v_produtor bigint := 0;
  v_vistos uuid[] := '{}';
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  -- A sessão e o evento.
  select s.id, s.organization_id, s.evento_id, s.local_id, s.inicio, s.cancelada_em into v_sessao from public.ticketeria_sessoes s where s.id = p_sessao;
  if v_sessao.id is null or v_sessao.cancelada_em is not null or v_sessao.inicio <= now() then
    raise exception 'sessao_indisponivel' using errcode = 'check_violation';
  end if;
  select e.id, e.loja_id, e.situacao into v_evento from public.ticketeria_eventos e where e.id = v_sessao.evento_id;
  if v_evento.situacao <> 'publicado' then
    raise exception 'evento_nao_publicado' using errcode = 'check_violation';
  end if;
  -- O comprador e o prazo da reserva.
  if p_nome is null or char_length(btrim(p_nome)) not between 1 and 120 or p_email is null or char_length(p_email) > 254
     or btrim(lower(p_email)) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'comprador_invalido' using errcode = 'check_violation';
  end if;
  if p_minutos is null or p_minutos not between 1 and 60 then
    raise exception 'itens_invalidos' using errcode = 'check_violation';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) not between 1 and 10 then
    raise exception 'itens_invalidos' using errcode = 'check_violation';
  end if;

  select * into v_taxa from public.fn_ticketeria_taxa_vigente(v_evento.loja_id);

  -- Um código curto, sem letras que se confundem (I, O, 0, 1).
  loop
    v_codigo := (select string_agg(substr(v_alfabeto, 1 + floor(random() * 32)::integer, 1), '') from generate_series(1, 8));
    exit when not exists (select 1 from public.ticketeria_pedidos p where p.codigo = v_codigo);
  end loop;

  insert into public.ticketeria_pedidos (id, organization_id, loja_id, sessao_id, codigo, comprador_nome, comprador_email, situacao,
    total_centavos, taxa_centavos, produtor_centavos, quem_paga_taxa, reservado_ate)
  values (v_pedido, v_sessao.organization_id, v_evento.loja_id, v_sessao.id, v_codigo, btrim(p_nome), btrim(lower(p_email)), 'aguardando_pagamento',
    0, 0, 0, v_taxa.quem_paga, now() + make_interval(mins => p_minutos));

  for v_item in select * from jsonb_array_elements(p_itens) loop
    if jsonb_typeof(v_item) <> 'object' or (v_item ->> 'ingresso_id') is null or (v_item ->> 'quantidade') !~ '^[0-9]{1,3}$' then
      raise exception 'itens_invalidos' using errcode = 'check_violation';
    end if;
    select i.id, i.evento_id, i.setor_id, i.publico, i.arquivado, i.limite_por_pedido, s.local_id
      into v_ingresso
      from public.ticketeria_ingressos i join public.ticketeria_setores s on s.id = i.setor_id
      where i.id = (v_item ->> 'ingresso_id')::uuid;
    if v_ingresso.id is null or v_ingresso.evento_id <> v_evento.id or not v_ingresso.publico or v_ingresso.arquivado then
      raise exception 'ingresso_indisponivel' using errcode = 'check_violation';
    end if;
    if v_ingresso.local_id <> v_sessao.local_id then
      raise exception 'ingresso_de_outro_local' using errcode = 'check_violation';
    end if;
    if v_ingresso.id = any(v_vistos) then
      raise exception 'itens_invalidos' using errcode = 'check_violation';
    end if;
    v_vistos := v_vistos || v_ingresso.id;
    v_restante := (v_item ->> 'quantidade')::integer;
    if v_restante < 1 or v_restante > v_ingresso.limite_por_pedido then
      raise exception 'limite_por_pedido' using errcode = 'check_violation';
    end if;

    -- O setor é o estoque: trava a linha dele (antes dos lotes, sempre nessa ordem) e confere o balde de lugares da sessão.
    select s.lugares into v_lugares_setor from public.ticketeria_setores s where s.id = v_ingresso.setor_id for update;

    -- Os lotes em sequência, cada um travado durante a conta.
    for v_lote in
      select l.id, l.preco_centavos, l.quantidade, l.vendas_inicio, l.vendas_fim
      from public.ticketeria_lotes l where l.ingresso_id = v_ingresso.id
      order by l.ordem, l.created_at, l.id
      for update
    loop
      exit when v_lote.vendas_inicio is not null and v_lote.vendas_inicio > now(); -- a janela ainda não abriu: segura os seguintes
      continue when v_lote.vendas_fim is not null and v_lote.vendas_fim <= now(); -- a janela fechou: vale o seguinte
      -- O que sobra é o menor entre o teto do lote e o que resta no balde do setor (tudo o que já foi pedido na sessão, deste pedido também).
      v_livres := least(v_lote.quantidade - public.fn_ticketeria_ocupados(v_sessao.id, v_lote.id, v_pedido),
                        v_lugares_setor - public.fn_ticketeria_ocupados_do_setor(v_sessao.id, v_ingresso.setor_id));
      continue when v_livres <= 0; -- esgotado nesta sessão: vale o seguinte
      v_tirar := least(v_livres, v_restante)::integer;
      v_taxa_unit := public.fn_ticketeria_taxa_do_ingresso(v_lote.preco_centavos, v_taxa.percentual_bps, v_taxa.fixo_centavos, v_taxa.quem_paga);
      insert into public.ticketeria_pedido_itens (organization_id, pedido_id, ingresso_id, lote_id, quantidade, preco_centavos, taxa_centavos)
      values (v_sessao.organization_id, v_pedido, v_ingresso.id, v_lote.id, v_tirar, v_lote.preco_centavos, v_taxa_unit);
      if v_taxa.quem_paga = 'comprador' then
        v_total := v_total + (v_lote.preco_centavos + v_taxa_unit)::bigint * v_tirar;
        v_produtor := v_produtor + v_lote.preco_centavos::bigint * v_tirar;
      else
        v_total := v_total + v_lote.preco_centavos::bigint * v_tirar;
        v_produtor := v_produtor + (v_lote.preco_centavos - v_taxa_unit)::bigint * v_tirar;
      end if;
      v_taxa_total := v_taxa_total + v_taxa_unit::bigint * v_tirar;
      v_restante := v_restante - v_tirar;
      exit when v_restante = 0;
    end loop;
    if v_restante > 0 then
      raise exception 'esgotado' using errcode = 'check_violation';
    end if;
  end loop;

  update public.ticketeria_pedidos
  set total_centavos = v_total, taxa_centavos = v_taxa_total, produtor_centavos = v_produtor,
      situacao = case when v_total = 0 then 'pago' else 'aguardando_pagamento' end,
      pago_em = case when v_total = 0 then now() end
  where id = v_pedido;

  return jsonb_build_object('pedido_id', v_pedido, 'codigo', v_codigo, 'total_centavos', v_total, 'taxa_centavos', v_taxa_total,
    'produtor_centavos', v_produtor, 'situacao', case when v_total = 0 then 'pago' else 'aguardando_pagamento' end,
    'reservado_ate', now() + make_interval(mins => p_minutos));
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_ticketeria_confirmar_pagamento_real(p_pedido uuid, p_provedor text, p_ref text, p_valor_centavos bigint, p_liquido_centavos bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_pedido record;
  v_item record;
  v_lote record;
  v_transacao uuid;
  v_custo bigint;
  v_lugares_setor integer;
begin
  select * into v_pedido from public.ticketeria_pedidos p where p.id = p_pedido for update;
  if v_pedido.id is null then
    raise exception 'pedido_inexistente' using errcode = 'check_violation';
  end if;
  if v_pedido.situacao = 'pago' then
    return 'ja_pago';
  end if;
  if v_pedido.situacao = 'cancelado' then
    raise exception 'pedido_cancelado' using errcode = 'check_violation';
  end if;
  if v_pedido.meio is null then
    raise exception 'meio_nao_escolhido' using errcode = 'check_violation';
  end if;
  if p_valor_centavos is distinct from v_pedido.total_centavos then
    raise exception 'valor_divergente' using errcode = 'check_violation';
  end if;
  -- O custo que vale no razão: o real (valor pago − líquido), quando o provedor o informa; senão, a estimativa da hora de pagar.
  if p_liquido_centavos is null then
    v_custo := v_pedido.custo_meio_centavos;
  else
    v_custo := p_valor_centavos - p_liquido_centavos;
    if v_custo < 0 or v_custo > v_pedido.produtor_centavos then
      raise exception 'liquido_invalido' using errcode = 'check_violation';
    end if;
  end if;
  -- Pago depois do prazo da reserva: só vale se os lugares ainda couberem (os lotes travados durante a conta).
  if v_pedido.reservado_ate <= now() then
    for v_item in select i.lote_id, sum(i.quantidade) as quantidade from public.ticketeria_pedido_itens i where i.pedido_id = p_pedido group by i.lote_id loop
      select l.id, l.quantidade into v_lote from public.ticketeria_lotes l where l.id = v_item.lote_id for update;
      if public.fn_ticketeria_ocupados(v_pedido.sessao_id, v_item.lote_id, p_pedido) + v_item.quantidade > v_lote.quantidade then
        raise exception 'reserva_expirada_sem_lugar' using errcode = 'check_violation';
      end if;
    end loop;
    -- E o balde de cada setor (a linha do setor travada, depois dos lotes: a mesma ordem da reserva).
    for v_item in select ig.setor_id, sum(i.quantidade) as quantidade from public.ticketeria_pedido_itens i join public.ticketeria_ingressos ig on ig.id = i.ingresso_id where i.pedido_id = p_pedido group by ig.setor_id order by ig.setor_id loop
      select s.lugares into v_lugares_setor from public.ticketeria_setores s where s.id = v_item.setor_id for update;
      if public.fn_ticketeria_ocupados_do_setor(v_pedido.sessao_id, v_item.setor_id, p_pedido) + v_item.quantidade > v_lugares_setor then
        raise exception 'reserva_expirada_sem_lugar' using errcode = 'check_violation';
      end if;
    end loop;
  end if;

  update public.ticketeria_pedidos
  set situacao = 'pago', pago_em = now(), provedor = p_provedor, provedor_ref = p_ref,
      custo_meio_real_centavos = case when p_liquido_centavos is null then null else v_custo end
  where id = p_pedido;

  insert into public.ticketeria_transacoes (organization_id, loja_id, pedido_id, tipo, descricao)
  values (v_pedido.organization_id, v_pedido.loja_id, p_pedido, 'pagamento', 'Pedido ' || v_pedido.codigo)
  returning id into v_transacao;
  insert into public.ticketeria_partidas (organization_id, transacao_id, conta, valor_centavos)
  select v_pedido.organization_id, v_transacao, conta, valor from (values
    ('psp_a_receber', v_pedido.total_centavos - v_custo),
    ('produtor', -(v_pedido.produtor_centavos - v_custo)),
    ('plataforma', -v_pedido.taxa_centavos)
  ) as x(conta, valor)
  where valor <> 0;
  return 'pago';
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_ticketeria_livres(p_sessao uuid, p_ingresso uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_lote record;
  v_total bigint := 0;
  v_livres bigint;
  v_setor uuid;
  v_balde bigint;
begin
  for v_lote in select l.id, l.quantidade, l.vendas_inicio, l.vendas_fim from public.ticketeria_lotes l where l.ingresso_id = p_ingresso order by l.ordem, l.created_at, l.id loop
    exit when v_lote.vendas_inicio is not null and v_lote.vendas_inicio > now();
    continue when v_lote.vendas_fim is not null and v_lote.vendas_fim <= now();
    v_livres := v_lote.quantidade - public.fn_ticketeria_ocupados(p_sessao, v_lote.id);
    if v_livres > 0 then v_total := v_total + v_livres; end if;
  end loop;
  select st.id into v_setor from public.ticketeria_ingressos i join public.ticketeria_setores st on st.id = i.setor_id where i.id = p_ingresso and st.numerado;
  if v_setor is not null then
    v_total := least(v_total, public.fn_ticketeria_lugares_livres_do_setor(p_sessao, v_setor));
  end if;
  -- O setor é um balde só: o que se consegue comprar não passa do que resta dele (todos os tipos de ingresso somados).
  select greatest(st.lugares - public.fn_ticketeria_ocupados_do_setor(p_sessao, st.id), 0) into v_balde from public.ticketeria_ingressos i join public.ticketeria_setores st on st.id = i.setor_id where i.id = p_ingresso;
  if v_balde is not null then
    v_total := least(v_total, v_balde);
  end if;
  return v_total;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_ticketeria_comecar_pracas(p_org uuid, p_perfil text, p_evento text, p_pracas jsonb, p_lugares integer, p_hora time without time zone, p_preco_centavos integer, p_meia boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_fuso constant text := 'America/Sao_Paulo';
  v_hoje date := (now() at time zone v_fuso)::date;
  v_loja uuid;
  v_evento uuid;
  v_nome_org text;
  v_praca jsonb;
  v_datas date[];
  v_data date;
  v_nome_local text;
  v_cidade text;
  v_uf text;
  v_local uuid;
  v_setor uuid;
  v_lugares integer;
  v_numerado boolean;
  v_meia integer;
  v_ingresso uuid;
  v_locais uuid[] := '{}';
  v_total integer := 0;
  v_saida jsonb := '[]'::jsonb;
begin
  if not public.auth_ticketeria_pode(p_org, 'editar') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if p_perfil is null or p_perfil not in ('espaco', 'turne', 'unico', 'festival') then
    raise exception 'perfil_invalido' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_evento, '')), '') is null then
    raise exception 'evento_sem_nome' using errcode = '22023';
  end if;
  if p_lugares is null or p_lugares < 1 or p_lugares > 200000 then
    raise exception 'lugares_invalidos' using errcode = '22023';
  end if;
  if p_hora is null then
    raise exception 'sem_data' using errcode = '22023';
  end if;
  if p_preco_centavos is null or p_preco_centavos < 0 or p_preco_centavos > 10000000 then
    raise exception 'preco_invalido' using errcode = '22023';
  end if;
  if p_pracas is null or jsonb_typeof(p_pracas) <> 'array' or jsonb_array_length(p_pracas) < 1 or jsonb_array_length(p_pracas) > 20 then
    raise exception 'pracas_invalidas' using errcode = '22023';
  end if;

  -- Confere tudo antes de gravar qualquer coisa.
  for v_praca in select * from jsonb_array_elements(p_pracas) loop
    if jsonb_typeof(v_praca) <> 'object' or nullif(btrim(coalesce(v_praca ->> 'local', '')), '') is null then
      raise exception 'local_sem_nome' using errcode = '22023';
    end if;
    if nullif(btrim(coalesce(v_praca ->> 'cidade', '')), '') is null then
      raise exception 'cidade_sem_nome' using errcode = '22023';
    end if;
    if coalesce(v_praca ->> 'uf', '') !~ '^[A-Z]{2}$' then
      raise exception 'uf_invalida' using errcode = '22023';
    end if;
    if jsonb_typeof(v_praca -> 'datas') <> 'array' or jsonb_array_length(v_praca -> 'datas') < 1 then
      raise exception 'sem_data' using errcode = '22023';
    end if;
    if jsonb_array_length(v_praca -> 'datas') > 60 then
      raise exception 'datas_demais' using errcode = '22023';
    end if;
    v_total := v_total + jsonb_array_length(v_praca -> 'datas');
    select array_agg(d::date order by d::date) into v_datas from jsonb_array_elements_text(v_praca -> 'datas') d;
    if cardinality(v_datas) <> (select count(distinct x) from unnest(v_datas) x) then
      raise exception 'data_repetida' using errcode = '22023';
    end if;
    if v_datas[1] < v_hoje then
      raise exception 'data_no_passado' using errcode = '22023';
    end if;
  end loop;
  if v_total > 200 then
    raise exception 'sessoes_demais' using errcode = '22023';
  end if;

  -- Loja: a da organização, ou uma nova com o nome dela.
  select l.id into v_loja from public.ticketeria_lojas l where l.organization_id = p_org;
  if v_loja is null then
    select left(coalesce(nullif(btrim(o.nome), ''), 'Loja'), 120) into v_nome_org from public.organizations o where o.id = p_org;
    insert into public.ticketeria_lojas (organization_id, nome, criado_por)
    values (p_org, coalesce(v_nome_org, 'Loja'), auth.uid())
    returning id into v_loja;
  end if;
  update public.ticketeria_lojas set perfil = p_perfil where id = v_loja;

  insert into public.ticketeria_eventos (organization_id, loja_id, titulo, criado_por)
  values (p_org, v_loja, left(btrim(p_evento), 200), auth.uid())
  returning id into v_evento;

  for v_praca in select * from jsonb_array_elements(p_pracas) loop
    v_nome_local := left(btrim(v_praca ->> 'local'), 200);
    v_cidade := left(btrim(v_praca ->> 'cidade'), 120);
    v_uf := v_praca ->> 'uf';
    select array_agg(d::date order by d::date) into v_datas from jsonb_array_elements_text(v_praca -> 'datas') d;

    -- Local: o de mesmo nome e mesma cidade, ou um novo.
    select lo.id into v_local from public.ticketeria_locais lo
    where lo.loja_id = v_loja and not lo.arquivado and lower(btrim(lo.nome)) = lower(v_nome_local) and lower(btrim(coalesce(lo.cidade, ''))) = lower(v_cidade)
    order by lo.created_at limit 1;
    if v_local is null then
      insert into public.ticketeria_locais (organization_id, loja_id, nome, cidade, uf, fuso, criado_por)
      values (p_org, v_loja, v_nome_local, v_cidade, v_uf, v_fuso, auth.uid())
      returning id into v_local;
    else
      update public.ticketeria_locais set uf = v_uf where id = v_local and uf is null;
    end if;
    if v_local = any(v_locais) then
      raise exception 'praca_repetida' using errcode = '22023';
    end if;
    v_locais := v_locais || v_local;

    -- Setor "Geral": o que já existe no local, ou um novo com os lugares informados.
    select s.id, s.lugares, s.numerado into v_setor, v_lugares, v_numerado from public.ticketeria_setores s
    where s.local_id = v_local and s.nome = 'Geral' and not s.arquivado;
    if v_setor is null then
      insert into public.ticketeria_setores (organization_id, local_id, nome, lugares)
      values (p_org, v_local, 'Geral', p_lugares)
      returning id, lugares, numerado into v_setor, v_lugares, v_numerado;
    end if;

    foreach v_data in array v_datas loop
      insert into public.ticketeria_sessoes (organization_id, evento_id, local_id, inicio)
      values (p_org, v_evento, v_local, (v_data + p_hora) at time zone v_fuso);
    end loop;

    v_meia := 0;
    if p_preco_centavos = 0 then
      insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria, ordem)
      values (p_org, v_evento, v_setor, 'Gratuito', 'gratuito', 0)
      returning id into v_ingresso;
      insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade)
      values (p_org, v_ingresso, 'Lote 1', 0, v_lugares);
    else
      if coalesce(p_meia, false) and v_lugares >= 3 then
        v_meia := floor(v_lugares * 0.4);
      end if;
      insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria, ordem)
      values (p_org, v_evento, v_setor, 'Inteira', 'inteira', 0)
      returning id into v_ingresso;
      insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade)
      values (p_org, v_ingresso, 'Lote 1', p_preco_centavos, v_lugares);
      if v_meia > 0 then
        insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria, ordem)
        values (p_org, v_evento, v_setor, 'Meia-entrada', 'meia', 1)
        returning id into v_ingresso;
        insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade)
        values (p_org, v_ingresso, 'Lote 1', greatest(1, round(p_preco_centavos / 2.0)::integer), v_meia);
      end if;
    end if;

    v_saida := v_saida || jsonb_build_object('local_id', v_local, 'setor_id', v_setor, 'setor_lugares', v_lugares, 'setor_numerado', v_numerado,
                                              'sessoes', cardinality(v_datas), 'inteira', v_lugares, 'meia', v_meia);
  end loop;

  return jsonb_build_object('loja_id', v_loja, 'evento_id', v_evento, 'sessoes', v_total, 'pracas', v_saida);
end;
$function$;
