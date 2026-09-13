-- EXPERIMENTAL — "Ver tudo" também permite adicionar um item novo (mesma
-- lógica de busca-e-cria-se-livre da Consulta), não só listar os existentes.

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
    WHERE workspace_id = p_workspace_id AND tipo = p_tipo AND habilitado AND modo IN ('consulta', 'ver_tudo')
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
