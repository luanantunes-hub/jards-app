-- Conector MCP: a base pública de empresas com busca por cidade, estado e setor, paginação com total, e a leitura
-- dos contatos dela por organização.
--
-- Aditiva: só cria funções novas. Nada existente é alterado e ninguém passa a ver o que não via: as duas funções são
-- chamadas só pelo servidor do conector (service role), que antes confere que a pessoa é da equipe da organização.

-- ─── 1. Busca na base pública ───────────────────────────────────────────────
-- Sem diferenciar maiúsculas nem acentos ("Sao Paulo" acha "São Paulo"). `p_busca` vale para nome, cidade e setor
-- (e para a sigla do estado quando tem duas letras); os demais filtros são específicos e somam com "e".
-- A contagem total vem em todas as linhas (count(*) over ()), antes do corte da página.

create or replace function public.fn_busca_normalizada(p_texto text)
returns text
language sql
stable
set search_path = public
as $$
  select lower(public.unaccent(btrim(coalesce(p_texto, ''))))
$$;

create or replace function public.fn_buscar_empresas_publicas(
  p_organization_id uuid default null,
  p_busca text default null,
  p_cidade text default null,
  p_estado text default null,
  p_setor text default null,
  p_limite integer default 20,
  p_deslocamento integer default 0
)
returns table (
  id uuid,
  nome text,
  site text,
  cidade text,
  estado text,
  setor text,
  tem_detalhe boolean,
  contatos_disponiveis integer,
  contatos_liberados boolean,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with termos as (
    select
      nullif(public.fn_busca_normalizada(p_busca), '') as busca,
      nullif(public.fn_busca_normalizada(p_cidade), '') as cidade,
      nullif(upper(btrim(coalesce(p_estado, ''))), '') as estado,
      nullif(public.fn_busca_normalizada(p_setor), '') as setor
  ),
  tipo_busca as (
    -- Duas letras que são a sigla de um estado ("PR") valem como estado: como trecho de nome casariam com metade da base.
    select t.*,
           (t.busca is not null and length(t.busca) = 2 and t.busca = any (array[
             'ac','al','am','ap','ba','ce','df','es','go','ma','mg','ms','mt','pa','pb','pe','pi','pr','rj','rn','ro','rr','rs','sc','se','sp','to'
           ])) as busca_e_uf
    from termos t
  ),
  achadas as (
    select e.*
    from public.empresas e, tipo_busca t
    where (t.busca is null
           or (t.busca_e_uf and lower(btrim(e.estado)) = t.busca)
           or (not t.busca_e_uf and (
                position(t.busca in public.fn_busca_normalizada(e.nome)) > 0
                or position(t.busca in public.fn_busca_normalizada(e.cidade)) > 0
                or position(t.busca in public.fn_busca_normalizada(e.setor)) > 0)))
      and (t.cidade is null or position(t.cidade in public.fn_busca_normalizada(e.cidade)) > 0)
      and (t.estado is null or upper(btrim(e.estado)) = t.estado)
      and (t.setor is null or position(t.setor in public.fn_busca_normalizada(e.setor)) > 0)
  )
  select
    a.id,
    a.nome,
    a.site,
    a.cidade,
    btrim(a.estado)::text as estado,
    a.setor,
    coalesce(a.tem_detalhe, false) as tem_detalhe,
    (select count(*)::integer from public.responsaveis r where r.empresa_id = a.id) as contatos_disponiveis,
    -- Contatos liberados: a empresa não tem detalhe (aparecem sem custo, como no app) ou a organização já os desbloqueou.
    (not coalesce(a.tem_detalhe, false)
     or (p_organization_id is not null and exists (
           select 1 from public.desbloqueios d
           where d.empresa_pub_id = a.id and d.organization_id = p_organization_id))) as contatos_liberados,
    count(*) over () as total
  from achadas a
  order by a.nome, a.id
  limit greatest(least(coalesce(p_limite, 20), 100), 1)
  offset greatest(coalesce(p_deslocamento, 0), 0)
$$;

revoke all on function public.fn_busca_normalizada(text) from public, anon, authenticated;
grant execute on function public.fn_busca_normalizada(text) to service_role;
revoke all on function public.fn_buscar_empresas_publicas(uuid, text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.fn_buscar_empresas_publicas(uuid, text, text, text, text, integer, integer) to service_role;

-- ─── 2. Contatos de uma empresa da base pública, por organização ────────────
-- fn_responsaveis_empresa usa auth.uid() e não serve ao conector (que roda com a chave de serviço). Esta é a mesma
-- regra com a organização como parâmetro: nome, e-mail e LinkedIn só saem inteiros quando a empresa não tem detalhe
-- ou a organização já a desbloqueou; senão o nome sai mascarado e e-mail e LinkedIn saem vazios, como no app.
-- Não cobra nada: desbloquear é fn_desbloquear_empresa_as, que o conector só chama com a confirmação do custo.

create or replace function public.fn_responsaveis_empresa_org(p_organization_id uuid, p_empresa_id uuid)
returns table (
  id uuid,
  nome text,
  cargo text,
  email text,
  linkedin_url text,
  fonte text,
  confianca numeric,
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
  if p_organization_id is null then
    raise exception 'Informe a organização';
  end if;

  v_pode := not coalesce((select e.tem_detalhe from public.empresas e where e.id = p_empresa_id), false)
    or exists (
      select 1 from public.desbloqueios d
      where d.empresa_pub_id = p_empresa_id and d.organization_id = p_organization_id
    );

  return query
  select r.id,
         case when v_pode then r.nome else public.fn_mascarar_nome(r.nome) end,
         r.cargo,
         case when v_pode then r.email else null end,
         case when v_pode then r.linkedin_url else null end,
         r.fonte,
         r.confianca,
         not v_pode
  from public.responsaveis r
  where r.empresa_id = p_empresa_id
  order by r.ordem, r.id;
end;
$$;

revoke all on function public.fn_responsaveis_empresa_org(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_responsaveis_empresa_org(uuid, uuid) to service_role;
