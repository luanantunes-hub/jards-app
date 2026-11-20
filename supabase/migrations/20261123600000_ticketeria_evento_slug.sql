-- Ticketeria: o endereço de cada evento no site da loja (C2, a página que nasce sozinha para cada evento; plano em docs/acoes-futuras/estudos/plano-ticketeria-cms-e-integracoes.md).
--
-- A página do evento abre no domínio do produtor em /e/<slug>. O slug vem do título (sem acento, em minúsculas, com hífens, até 40 letras), é ÚNICO dentro da loja (se já existe, ganha -2, -3...)
-- e NÃO muda quando o título é editado: assim os links já divulgados não quebram. Os eventos que já existem ganham o slug aqui; os novos o ganham ao nascer (gatilho), sem a tela precisar mandar.
--
-- Funções (só o banco, nenhuma é chamada de fora): fn_ticketeria_slug_do_titulo(título) → o slug-base; fn_ticketeria_evento_slug() → o gatilho que preenche o slug de um evento novo.
-- Expansão: uma coluna nova com padrão, a cópia para os eventos de hoje, uma regra de formato, um índice único e um gatilho. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.ticketeria_eventos add column if not exists slug text not null default '';

-- O slug-base de um título: sem acento, minúsculas, só letras e números separados por um hífen, até 40 letras; título sem letra nem número vira "evento".
create or replace function public.fn_ticketeria_slug_do_titulo(p_titulo text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(nullif(trim(both '-' from left(trim(both '-' from regexp_replace(
    translate(lower(coalesce(p_titulo, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', '-', 'g')), 40)), ''), 'evento');
$$;

-- O slug livre da loja: o base, ou base-2, base-3... (corta o base para o sufixo caber nos 40).
create or replace function public.fn_ticketeria_evento_slug_livre(p_loja uuid, p_titulo text, p_evento uuid)
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_base text := public.fn_ticketeria_slug_do_titulo(p_titulo);
  v_slug text := v_base;
  n integer := 1;
begin
  while exists (select 1 from public.ticketeria_eventos e where e.loja_id = p_loja and e.slug = v_slug and e.id is distinct from p_evento) loop
    n := n + 1;
    v_slug := trim(both '-' from left(v_base, 40 - length(n::text) - 1)) || '-' || n;
  end loop;
  return v_slug;
end;
$$;

-- Os eventos de hoje, do mais antigo ao mais novo (o mais antigo fica com o slug limpo).
do $$
declare
  r record;
begin
  for r in select id, loja_id, titulo from public.ticketeria_eventos where slug = '' order by created_at, id loop
    update public.ticketeria_eventos set slug = public.fn_ticketeria_evento_slug_livre(r.loja_id, r.titulo, r.id) where id = r.id;
  end loop;
end
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.ticketeria_eventos'::regclass and conname = 'ticketeria_eventos_slug_check') then
    alter table public.ticketeria_eventos add constraint ticketeria_eventos_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 40);
  end if;
end
$$;

create unique index if not exists ticketeria_eventos_loja_slug_key on public.ticketeria_eventos (loja_id, slug);

-- O evento novo nasce com o slug do título (se a tela não mandou um).
create or replace function public.fn_ticketeria_evento_slug()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.fn_ticketeria_evento_slug_livre(new.loja_id, new.titulo, new.id);
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'ticketeria_eventos_slug' and tgrelid = 'public.ticketeria_eventos'::regclass) then
    create trigger ticketeria_eventos_slug
      before insert on public.ticketeria_eventos
      for each row execute function public.fn_ticketeria_evento_slug();
  end if;
end
$$;

revoke execute on function public.fn_ticketeria_slug_do_titulo(text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_evento_slug_livre(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_evento_slug() from public, anon, authenticated;
