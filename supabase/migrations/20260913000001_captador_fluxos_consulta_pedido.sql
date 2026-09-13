-- EXPERIMENTAL — fluxos de "Consulta" e "Solicitação" do workspace de captador.

ALTER TABLE public.captador_workspace_pedidos
  ADD COLUMN IF NOT EXISTS nome_busca text NOT NULL DEFAULT '';
ALTER TABLE public.captador_workspace_pedidos ALTER COLUMN nome_busca DROP DEFAULT;

-- Consulta: verifica se uma empresa/negociação/inscrição já está em andamento
-- pelo nome digitado. Se não estiver, libera na hora, registrando um pedido
-- já aprovado (marca o "reservado", sem exigir aprovação de um admin).
-- SECURITY DEFINER porque o captador não tem (e não deve ter) acesso direto
-- de leitura a captacoes/editais_user/empresas_crm da organização inteira —
-- só ao resultado pontual desta consulta.
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
  v_nome text := trim(p_nome_busca);
  v_encontrado jsonb;
  v_pedido_id uuid;
BEGIN
  IF p_tipo NOT IN ('empresas', 'negociacoes', 'inscricoes') THEN
    RAISE EXCEPTION 'Tipo invalido: %', p_tipo;
  END IF;
  IF v_nome = '' THEN
    RAISE EXCEPTION 'Informe um nome para consultar';
  END IF;

  SELECT w.organization_id INTO v_org_id
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

  INSERT INTO public.captador_workspace_pedidos (
    workspace_id, tipo, nome_busca, status, decidido_em
  ) VALUES (
    p_workspace_id, p_tipo, v_nome, 'aprovado', now()
  ) RETURNING id INTO v_pedido_id;

  RETURN jsonb_build_object('livre', true, 'pedido_id', v_pedido_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_captador_consultar(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_captador_consultar(uuid, text, text) TO authenticated;

-- A RLS de insert do captador exigia status='pendente' — mas a função acima
-- roda como SECURITY DEFINER (dono da função, não o captador), então não é
-- afetada pela RLS de qualquer forma. Mantemos a policy como está: ela só
-- protege contra o captador tentar inserir um pedido já aprovado por conta
-- própria, direto pela tabela.

COMMENT ON COLUMN public.captador_workspace_pedidos.nome_busca IS 'Nome (empresa/edital) que o captador buscou ou solicitou — preenchido em consulta e solicitação.';
