-- Passo 1 (aditivo, não muda nenhum acesso existente): função que entrega os
-- contatos (responsaveis) de um patrocinador respeitando o desbloqueio.
--   completos: super admin, empresa sem perfil detalhado, ou organização do
--              usuário que desbloqueou a empresa (desbloqueios)
--   mascarados: nome reduzido, e-mail e LinkedIn nulos
-- O passo 2 (20261001200100) fecha a leitura direta da tabela.

create or replace function public.fn_mascarar_nome(p_nome text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_nome is null or btrim(p_nome) = '' then null
    else (
      select string_agg(
               case when length(w) <= 1 then w else left(w, 1) || repeat('•', least(length(w) - 1, 5)) end,
               ' ')
      from unnest(regexp_split_to_array(btrim(p_nome), '\s+')) as w
    )
  end
$$;

create or replace function public.fn_pode_ver_contatos_empresa(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.is_jards_super_admin()
    or not coalesce((select e.tem_detalhe from public.empresas e where e.id = p_empresa_id), false)
    or exists (
      select 1
      from public.desbloqueios d
      where d.empresa_pub_id = p_empresa_id
        and d.organization_id = any(array(select public.auth_org_ids()))
    )
  )
$$;

create or replace function public.fn_responsaveis_empresa(p_empresa_id uuid)
returns table (
  id uuid, bubble_id text, empresa_id uuid, nome text, cargo text, email text,
  linkedin_url text, ordem integer, created_at timestamptz, updated_at timestamptz,
  fonte text, confianca numeric, confirmacoes_independentes integer,
  ultima_confirmacao_em timestamptz, votos_positivos integer, votos_negativos integer,
  mascarado boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pode boolean;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  v_pode := public.fn_pode_ver_contatos_empresa(p_empresa_id);

  return query
  select r.id, r.bubble_id, r.empresa_id,
         case when v_pode then r.nome else public.fn_mascarar_nome(r.nome) end,
         r.cargo,
         case when v_pode then r.email else null end,
         case when v_pode then r.linkedin_url else null end,
         r.ordem, r.created_at, r.updated_at, r.fonte, r.confianca,
         r.confirmacoes_independentes, r.ultima_confirmacao_em,
         r.votos_positivos, r.votos_negativos,
         not v_pode
  from public.responsaveis r
  where r.empresa_id = p_empresa_id
  order by r.ordem;
end;
$$;

revoke all on function public.fn_mascarar_nome(text) from public, anon;
revoke all on function public.fn_pode_ver_contatos_empresa(uuid) from public, anon;
revoke all on function public.fn_responsaveis_empresa(uuid) from public, anon;
grant execute on function public.fn_mascarar_nome(text) to authenticated, service_role;
grant execute on function public.fn_pode_ver_contatos_empresa(uuid) to authenticated, service_role;
grant execute on function public.fn_responsaveis_empresa(uuid) to authenticated, service_role;
