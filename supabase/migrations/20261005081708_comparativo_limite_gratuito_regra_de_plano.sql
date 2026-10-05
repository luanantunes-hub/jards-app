-- O limite de comparações passa a usar a mesma definição de "plano gratuito" dos demais
-- limites do plano (organization_uses_free_plan), em vez de repetir a regra de assinatura
-- do Stripe aqui. Mudou o critério de quem está livre do limite; o resto da função é igual.

create or replace function public.fn_registrar_comparacoes(p_empresa_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_uid        uuid := auth.uid();
  v_limite     constant integer := 15;
  v_ilimitado  boolean;
  v_total      integer;
  v_id         uuid;
  v_permitidas uuid[] := '{}';
  v_bloqueadas uuid[] := '{}';
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  -- Sem limite: super admin, plano pago no próprio perfil ou em organização do usuário.
  -- Os dois caminhos existem de propósito: errar pro lado de liberar é melhor do que cobrar
  -- um limite de quem paga.
  v_ilimitado :=
    public.is_jards_super_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = v_uid and p.plano::text <> 'gratuito'
    )
    or exists (
      select 1 from public.organization_members om
      where om.user_id = v_uid
        and not public.organization_uses_free_plan(om.organization_id)
    );

  -- Serializa por usuário: duas abas abertas não passam do limite juntas.
  perform pg_advisory_xact_lock(hashtextextended('comparativo_empresas:' || v_uid::text, 0));

  select count(*) into v_total from public.comparativo_empresas where user_id = v_uid;

  -- Ids repetidos ou inexistentes são ignorados; a ordem de chegada decide quem entra
  -- quando só sobram algumas vagas.
  for v_id in
    select e.id
    from unnest(p_empresa_ids) with ordinality as t(id, ord)
    join public.empresas e on e.id = t.id
    group by e.id
    order by min(t.ord)
  loop
    if v_ilimitado then
      v_permitidas := v_permitidas || v_id;
    elsif exists (
      select 1 from public.comparativo_empresas where user_id = v_uid and empresa_id = v_id
    ) then
      v_permitidas := v_permitidas || v_id;
    elsif v_total < v_limite then
      insert into public.comparativo_empresas (user_id, empresa_id) values (v_uid, v_id);
      v_total := v_total + 1;
      v_permitidas := v_permitidas || v_id;
    else
      v_bloqueadas := v_bloqueadas || v_id;
    end if;
  end loop;

  return jsonb_build_object(
    'permitidas', to_jsonb(v_permitidas),
    'bloqueadas', to_jsonb(v_bloqueadas),
    'total', v_total,
    'limite', case when v_ilimitado then null else v_limite end
  );
end;
$$;

revoke all on function public.fn_registrar_comparacoes(uuid[]) from public, anon;
grant execute on function public.fn_registrar_comparacoes(uuid[]) to authenticated;
