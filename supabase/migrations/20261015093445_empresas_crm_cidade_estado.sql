-- Localização das empresas do CRM em campos próprios: cidade e estado (UF).
--
-- Até aqui a localização era um texto livre ("São Paulo-SP"), que o conector e as telas escreviam de jeitos diferentes
-- ("d-D", vazio, sem estado). Agora há `cidade` e `estado`, com a UF validada. `localizacao` continua existindo e as
-- telas continuam gravando nela: um gatilho mantém as duas formas em sincronia, de modo que nada nas telas muda.
--
--   • Escreveu só `localizacao` ("Curitiba-PR"): cidade e estado saem dela.
--   • Escreveu `cidade`/`estado` (o conector): `localizacao` vira "Cidade-UF".
--   • Empresa ligada à base pública (empresa_pub_id) e sem localização: herda a cidade e o estado de lá.
--
-- Aditiva. Só preenche o que está vazio; nenhum valor existente é trocado. Texto que não dá para entender (ex.: "d-D")
-- fica como está em `localizacao` e sem cidade/estado.

-- ─── 1. Colunas ─────────────────────────────────────────────────────────────

alter table public.empresas_crm add column if not exists cidade text;
alter table public.empresas_crm add column if not exists estado text;

-- ─── 2. Separar "Cidade-UF" ─────────────────────────────────────────────────

create or replace function public.fn_uf_valida(p_uf text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select upper(btrim(coalesce(p_uf, ''))) = any (array[
    'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
  ])
$$;

-- "Curitiba-PR", "Curitiba - PR", "Curitiba/PR" ou "Curitiba, PR" viram cidade e UF. Só a cidade ("Curitiba", sem
-- nenhum separador) vira cidade sem estado. O que tem separador mas não termina numa UF válida ("d-D", "Curitiba-XX")
-- é tratado como malformado e devolve nulos: não vira cidade.
create or replace function public.fn_separar_cidade_uf(p_texto text)
returns table (cidade text, estado text)
language plpgsql
immutable
set search_path = public
as $$
declare
  v_texto text := btrim(coalesce(p_texto, ''));
  v_partes text[];
begin
  v_partes := regexp_match(v_texto, '^(.+?)\s*[-/,–]\s*([A-Za-z]{2})$');
  if v_partes is not null and public.fn_uf_valida(v_partes[2]) and btrim(v_partes[1]) <> '' then
    return query select btrim(v_partes[1]), upper(v_partes[2]);
  elsif length(v_texto) = 2 and public.fn_uf_valida(v_texto) then
    return query select null::text, upper(v_texto);
  elsif length(v_texto) >= 2 and v_texto !~ '[-/,–]' then
    return query select v_texto, null::text;
  else
    return query select null::text, null::text;
  end if;
end;
$$;

-- ─── 3. Preenche o que já existe (só onde está vazio) ───────────────────────

-- O gatilho de updated_at fica de fora nos dois preenchimentos: separar a localização ou herdar a cidade não é uma
-- edição da pessoa e não deve mexer na ordem das listas.
alter table public.empresas_crm disable trigger trg_empresas_crm_updated_at;

-- Das localizações que já são "Cidade-UF".
update public.empresas_crm e
set cidade = s.cidade, estado = s.estado
from (
  select x.id, (public.fn_separar_cidade_uf(x.localizacao)).*
  from public.empresas_crm x
  where x.localizacao is not null and btrim(x.localizacao) <> ''
) s
where e.id = s.id and s.estado is not null and e.cidade is null and e.estado is null;

-- Das empresas ligadas à base pública que não têm localização.
update public.empresas_crm e
set cidade = nullif(btrim(p.cidade), ''),
    estado = case when public.fn_uf_valida(p.estado) then upper(btrim(p.estado)) else null end,
    localizacao = case
      when nullif(btrim(p.cidade), '') is not null and public.fn_uf_valida(p.estado) then btrim(p.cidade) || '-' || upper(btrim(p.estado))
      else e.localizacao
    end
from public.empresas p
where e.empresa_pub_id = p.id
  and e.cidade is null and e.estado is null
  and (e.localizacao is null or btrim(e.localizacao) = '')
  and nullif(btrim(p.cidade), '') is not null and public.fn_uf_valida(p.estado);

alter table public.empresas_crm enable trigger trg_empresas_crm_updated_at;

-- ─── 4. UF sempre válida ────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'empresas_crm_estado_uf') then
    alter table public.empresas_crm
      add constraint empresas_crm_estado_uf check (estado is null or public.fn_uf_valida(estado));
  end if;
end
$$;

-- ─── 5. Gatilho que mantém tudo em sincronia ────────────────────────────────

create or replace function public.fn_empresas_crm_localizacao()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_separado record;
  v_pub record;
begin
  new.cidade := nullif(btrim(coalesce(new.cidade, '')), '');
  new.estado := nullif(upper(btrim(coalesce(new.estado, ''))), '');

  -- Só `localizacao` foi escrita (as telas): cidade e estado saem dela.
  if (tg_op = 'INSERT' and new.cidade is null and new.estado is null)
     or (tg_op = 'UPDATE' and new.cidade is not distinct from old.cidade and new.estado is not distinct from old.estado
         and new.localizacao is distinct from old.localizacao) then
    select * into v_separado from public.fn_separar_cidade_uf(new.localizacao);
    new.cidade := v_separado.cidade;
    new.estado := v_separado.estado;
  end if;

  -- Sem localização nenhuma e ligada à base pública: herda de lá.
  if new.empresa_pub_id is not null and new.cidade is null and new.estado is null
     and (new.localizacao is null or btrim(new.localizacao) = '') then
    select nullif(btrim(e.cidade), '') as cidade, nullif(upper(btrim(e.estado)), '') as estado
      into v_pub from public.empresas e where e.id = new.empresa_pub_id;
    if v_pub.cidade is not null and public.fn_uf_valida(v_pub.estado) then
      new.cidade := v_pub.cidade;
      new.estado := v_pub.estado;
    end if;
  end if;

  -- `localizacao` acompanha cidade e estado: "Cidade-UF", só a cidade, só a UF, ou vazia quando os dois foram limpos.
  if new.cidade is not null and new.estado is not null then
    new.localizacao := new.cidade || '-' || new.estado;
  elsif new.cidade is not null then
    new.localizacao := new.cidade;
  elsif new.estado is not null then
    new.localizacao := new.estado;
  elsif tg_op = 'UPDATE' and (old.cidade is not null or old.estado is not null)
        and new.localizacao is not distinct from old.localizacao then
    new.localizacao := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_empresas_crm_localizacao on public.empresas_crm;
create trigger trg_empresas_crm_localizacao
  before insert or update on public.empresas_crm
  for each row execute function public.fn_empresas_crm_localizacao();
