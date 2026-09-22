-- EXPERIMENTAL — primeira fatia do workspace de proponente externo,
-- espelhando o mecanismo já usado pelo captador (captadores.user_id +
-- captadores_self_select + leitura via RPC SECURITY DEFINER, ver
-- 20260913142721_captador_leitura_via_rpc.sql). Fase 1 é só leitura: o
-- proponente vê os próprios projetos e o status real de negociações e
-- inscrições ligadas a eles. Nada de coordenação ou submissão ainda.

alter table public.proponentes
  add column user_id uuid references auth.users(id) on delete set null;

create policy "proponentes_self_select" on public.proponentes
  for select
  using (user_id = auth.uid());

-- projetos_crm, captacoes e editais_user ainda usam RLS de conta individual
-- (account_id = auth.uid()), então o proponente logado nunca é o "dono"
-- desses registros — precisa da mesma leitura via função SECURITY DEFINER
-- que o captador usa, verificando o vínculo antes de devolver os dados.

create or replace function public.fn_proponente_meus_projetos()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'nome', p.nome,
      'fase', p.fase,
      'statusComercial', p.status_comercial,
      'valorAlvo', p.valor_alvo,
      'valorGarantido', p.valor_garantido,
      'identidadeTipo', p.identidade_tipo,
      'identidadeValor', p.identidade_valor,
      'identidadeLogoUrl', p.identidade_logo_url,
      'identidadeCor', p.identidade_cor,
      'proponenteId', pr.id,
      'proponenteNome', pr.nome,
      'negociacoesCount', (select count(*) from public.captacoes cap where cap.projeto_id = p.id),
      'inscricoesCount', (select count(*) from public.editais_user ed where ed.projeto_id = p.id),
      'createdAt', p.created_at
    ) order by p.created_at desc)
    from public.projetos_crm p
    join public.proponentes pr on pr.id = p.proponente_id
    where pr.user_id = auth.uid()
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.fn_proponente_projeto_detalhe(p_projeto_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_projeto jsonb;
begin
  select jsonb_build_object(
    'id', p.id,
    'nome', p.nome,
    'descricao', p.descricao,
    'fase', p.fase,
    'statusComercial', p.status_comercial,
    'valorAlvo', p.valor_alvo,
    'valorGarantido', p.valor_garantido,
    'identidadeTipo', p.identidade_tipo,
    'identidadeValor', p.identidade_valor,
    'identidadeLogoUrl', p.identidade_logo_url,
    'identidadeCor', p.identidade_cor,
    'proponenteNome', pr.nome,
    'negociacoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cap.id,
        'titulo', cap.titulo,
        'status', cap.status,
        'valorSolicitado', cap.valor_solicitado,
        'empresaNome', coalesce(ec.nome, ep.nome, '—'),
        'updatedAt', cap.updated_at
      ) order by cap.updated_at desc)
      from public.captacoes cap
      left join public.empresas_crm ec on ec.id = cap.empresa_crm_id
      left join public.empresas ep on ep.id = cap.empresa_id
      where cap.projeto_id = p.id
    ), '[]'::jsonb),
    'inscricoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ed.id,
        'titulo', coalesce(e.titulo, ed.titulo, 'Edital'),
        'status', ed.status,
        'valor', ed.valor,
        'dataSubmissao', ed.created_at,
        'updatedAt', ed.updated_at
      ) order by ed.updated_at desc)
      from public.editais_user ed
      left join public.editais e on e.id = ed.edital_pub_id
      where ed.projeto_id = p.id
    ), '[]'::jsonb),
    'resultados', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'valorCaptado', r.valor_captado,
        'valorExecutado', r.valor_executado,
        'dataResultado', r.data_resultado
      ) order by r.data_resultado desc nulls last)
      from public.resultados_projeto r
      where r.projeto_id = p.id
    ), '[]'::jsonb)
  ) into v_projeto
  from public.projetos_crm p
  join public.proponentes pr on pr.id = p.proponente_id
  where p.id = p_projeto_id and pr.user_id = auth.uid();

  if v_projeto is null then
    raise exception 'Projeto nao encontrado para este usuario';
  end if;

  return v_projeto;
end;
$function$;

REVOKE ALL ON FUNCTION public.fn_proponente_meus_projetos() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_proponente_projeto_detalhe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_proponente_meus_projetos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_proponente_projeto_detalhe(uuid) TO authenticated;

-- Convite: "proponente" passa a ser um papel convidável em
-- organization_members, mesmo tratamento de assento que "captador" (não
-- consome vaga paga — é acesso externo, não um membro de equipe).

alter table public.organization_members drop constraint organization_members_papel_check;
alter table public.organization_members add constraint organization_members_papel_check
  check (papel = any (array['admin'::text, 'captador'::text, 'visualizador'::text, 'proponente'::text]));

create or replace function public.add_organization_member_with_seat(target_org uuid, target_user uuid, target_role text default 'captador'::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  member_id uuid;
  capacity integer;
  used_seats integer;
BEGIN
  IF target_role NOT IN ('admin', 'captador', 'visualizador', 'proponente') THEN
    RAISE EXCEPTION 'Papel de membro invalido.' USING errcode = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(target_org::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = target_org AND user_id = target_user
  ) THEN
    RAISE EXCEPTION 'Este usuario ja faz parte da equipe.' USING errcode = '23505';
  END IF;

  -- Captadores e proponentes pertencem ao fluxo operacional externo e nao usam assento.
  IF target_role NOT IN ('captador', 'proponente') THEN
    SELECT 1 + coalesce(seats.purchased_seats, 0)
      INTO capacity
    FROM (SELECT 1) seed
    LEFT JOIN public.organization_seats seats ON seats.organization_id = target_org;

    SELECT
      (SELECT count(*) FROM public.organization_members
       WHERE organization_id = target_org AND papel NOT IN ('captador', 'proponente'))
      +
      (SELECT count(*) FROM public.organization_invitations
       WHERE organization_id = target_org AND status = 'pending' AND role NOT IN ('captador', 'proponente'))
      INTO used_seats;

    IF used_seats >= capacity THEN
      RAISE EXCEPTION 'Nao ha assentos disponiveis nesta organizacao.' USING errcode = 'check_violation';
    END IF;
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, papel)
  VALUES (target_org, target_user, target_role)
  RETURNING id INTO member_id;
  RETURN member_id;
END;
$function$;

create or replace function public.reserve_organization_invitation(target_org uuid, target_email text, target_role text, inviter uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  invitation_id uuid;
  normalized_email text := lower(trim(target_email));
  capacity integer;
  used_seats integer;
BEGIN
  IF normalized_email = '' OR position('@' IN normalized_email) = 0 THEN
    RAISE EXCEPTION 'E-mail invalido.' USING errcode = '22023';
  END IF;
  IF target_role NOT IN ('admin', 'captador', 'visualizador', 'proponente') THEN
    RAISE EXCEPTION 'Papel de membro invalido.' USING errcode = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(target_org::text, 0));

  IF EXISTS (
    SELECT 1
    FROM public.organization_members member
    JOIN public.profiles profile ON profile.id = member.user_id
    WHERE member.organization_id = target_org AND lower(profile.email) = normalized_email
  ) THEN
    RAISE EXCEPTION 'Este usuario ja faz parte da equipe.' USING errcode = '23505';
  END IF;

  -- Convites de captadores e proponentes nao reservam assentos pagos.
  IF target_role NOT IN ('captador', 'proponente') THEN
    SELECT 1 + coalesce(seats.purchased_seats, 0)
      INTO capacity
    FROM (SELECT 1) seed
    LEFT JOIN public.organization_seats seats ON seats.organization_id = target_org;

    SELECT
      (SELECT count(*) FROM public.organization_members
       WHERE organization_id = target_org AND papel NOT IN ('captador', 'proponente'))
      +
      (SELECT count(*) FROM public.organization_invitations
       WHERE organization_id = target_org AND status = 'pending' AND role NOT IN ('captador', 'proponente'))
      INTO used_seats;

    IF used_seats >= capacity THEN
      RAISE EXCEPTION 'Nao ha assentos disponiveis nesta organizacao.' USING errcode = 'check_violation';
    END IF;
  END IF;

  INSERT INTO public.organization_invitations (organization_id, email, role, status, invited_by)
  VALUES (target_org, normalized_email, target_role, 'pending', inviter)
  RETURNING id INTO invitation_id;
  RETURN invitation_id;
END;
$function$;
