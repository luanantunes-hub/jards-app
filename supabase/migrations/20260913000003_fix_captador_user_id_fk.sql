-- EXPERIMENTAL — correção: atribuicoes.captador_user_id, apesar do nome,
-- referencia captadores(id) (não auth.users(id) — um captador pode nem ter
-- usuário vinculado). As duas funções anteriores tentavam gravar o auth.uid()
-- do usuário logado ali, o que sempre violava a FK.

CREATE OR REPLACE FUNCTION public.fn_captador_consultar(
  p_workspace_id uuid,
  p_tipo text,
  p_nome_busca text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_org_id uuid;
  v_captador_id uuid;
  v_nome text := trim(p_nome_busca);
  v_encontrado jsonb;
  v_pedido_id uuid;
  v_empresa_crm_id uuid;
BEGIN
  IF p_tipo NOT IN ('empresas', 'negociacoes', 'inscricoes') THEN
    RAISE EXCEPTION 'Tipo invalido: %', p_tipo;
  END IF;
  IF v_nome = '' THEN
    RAISE EXCEPTION 'Informe um nome para consultar';
  END IF;

  SELECT w.organization_id, c.id INTO v_org_id, v_captador_id
  FROM public.captador_workspaces w
  JOIN public.captadores c ON c.id = w.captador_id
  WHERE w.id = p_workspace_id AND c.user_id = auth.uid();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Workspace nao encontrado para este usuario';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.captador_workspace_escopos
    WHERE workspace_id = p_workspace_id AND tipo = p_tipo AND habilitado AND modo = 'consulta'
  ) THEN
    RAISE EXCEPTION 'Consulta nao habilitada para este tipo';
  END IF;

  IF p_tipo = 'empresas' THEN
    SELECT jsonb_build_object('nome', nome, 'status', status) INTO v_encontrado
    FROM public.empresas_crm
    WHERE organization_id = v_org_id AND nome ILIKE v_nome
    LIMIT 1;
  ELSIF p_tipo = 'negociacoes' THEN
    SELECT jsonb_build_object('titulo', cap.titulo, 'status', cap.status, 'empresa', ec.nome) INTO v_encontrado
    FROM public.captacoes cap
    LEFT JOIN public.empresas_crm ec ON ec.id = cap.empresa_crm_id
    WHERE cap.organization_id = v_org_id
      AND ec.nome ILIKE v_nome
      AND cap.status NOT IN ('aprovado', 'recusado')
    LIMIT 1;
  ELSE
    SELECT jsonb_build_object('titulo', ed.titulo, 'status', ed.status, 'empresa', ec.nome) INTO v_encontrado
    FROM public.editais_user ed
    LEFT JOIN public.empresas_crm ec ON ec.id = ed.empresa_crm_id
    WHERE ed.organization_id = v_org_id
      AND ec.nome ILIKE v_nome
      AND ed.status NOT IN ('aprovado', 'reprovado', 'cancelado')
    LIMIT 1;
  END IF;

  IF v_encontrado IS NOT NULL THEN
    RETURN jsonb_build_object('livre', false, 'encontrado', v_encontrado);
  END IF;

  SELECT id INTO v_empresa_crm_id FROM public.empresas_crm WHERE organization_id = v_org_id AND nome ILIKE v_nome LIMIT 1;
  IF v_empresa_crm_id IS NULL THEN
    INSERT INTO public.empresas_crm (nome, account_id, organization_id)
    VALUES (v_nome, auth.uid(), v_org_id)
    RETURNING id INTO v_empresa_crm_id;
  END IF;

  INSERT INTO public.atribuicoes (
    account_id, organization_id, empresa_crm_id, captador_user_id, tipo, status, motivo
  ) VALUES (
    auth.uid(), v_org_id, v_empresa_crm_id, v_captador_id, 'livre', 'ativa',
    'Criado automaticamente via consulta no workspace de captador'
  );

  INSERT INTO public.captador_workspace_pedidos (
    workspace_id, tipo, nome_busca, status, decidido_em
  ) VALUES (
    p_workspace_id, p_tipo, v_nome, 'aprovado', now()
  ) RETURNING id INTO v_pedido_id;

  RETURN jsonb_build_object('livre', true, 'pedido_id', v_pedido_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_aprovar_pedido_workspace(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_pedido record;
  v_org_id uuid;
  v_captador_id uuid;
  v_empresa_crm_id uuid;
BEGIN
  SELECT p.*, w.organization_id, c.id AS captador_id
    INTO v_pedido
  FROM public.captador_workspace_pedidos p
  JOIN public.captador_workspaces w ON w.id = p.workspace_id
  JOIN public.captadores c ON c.id = w.captador_id
  WHERE p.id = p_pedido_id;

  IF v_pedido IS NULL THEN
    RAISE EXCEPTION 'Pedido nao encontrado';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_pedido.organization_id AND user_id = auth.uid() AND papel = 'admin'
  ) THEN
    RAISE EXCEPTION 'Sem permissao para aprovar este pedido';
  END IF;
  IF v_pedido.status <> 'pendente' THEN
    RAISE EXCEPTION 'Pedido ja foi decidido';
  END IF;

  v_org_id := v_pedido.organization_id;
  v_captador_id := v_pedido.captador_id;

  SELECT id INTO v_empresa_crm_id FROM public.empresas_crm WHERE organization_id = v_org_id AND nome ILIKE v_pedido.nome_busca LIMIT 1;
  IF v_empresa_crm_id IS NULL THEN
    INSERT INTO public.empresas_crm (nome, account_id, organization_id)
    VALUES (v_pedido.nome_busca, auth.uid(), v_org_id)
    RETURNING id INTO v_empresa_crm_id;
  END IF;

  INSERT INTO public.atribuicoes (
    account_id, organization_id, empresa_crm_id, captador_user_id, tipo, status, motivo, aprovado_por
  ) VALUES (
    auth.uid(), v_org_id, v_empresa_crm_id, v_captador_id, 'livre', 'ativa',
    'Aprovado via solicitação no workspace de captador', auth.uid()
  );

  UPDATE public.captador_workspace_pedidos
  SET status = 'aprovado', decidido_por = auth.uid(), decidido_em = now()
  WHERE id = p_pedido_id;

  RETURN jsonb_build_object('ok', true, 'empresa_crm_id', v_empresa_crm_id);
END;
$function$;
