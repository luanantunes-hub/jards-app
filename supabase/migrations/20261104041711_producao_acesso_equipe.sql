-- PD1.12: a folha do dia para a pessoa da equipe, com login e sem link público.
--
-- Decisão do dono (04/11/2026): a pessoa da equipe não abre um link solto; entra com a própria conta,
-- como o captador e o proponente no CRM, e só vê o que é dela. Em vez de um papel novo na organização
-- (que passaria por todas as regras que tratam "membro que não é captador nem proponente" como equipe
-- interna), a pessoa convidada NÃO é membro: nenhuma regra de tabela a enxerga, e ela chega aos próprios
-- dados só por funções que devolvem a folha dela. Fica fora das vagas por construção.
--
--   producao_acessos_equipe   o convite: a pessoa da equipe (ficha), o e-mail convidado e a conta, quando
--                             ela entra. Quem edita a produção convida e revoga; a pessoa convidada não lê
--                             esta tabela.
--   fn_equipe_aceitar()       liga a conta de quem está logado aos convites do e-mail dele (só com o e-mail
--                             confirmado) e devolve quantos ligou.
--   fn_equipe_minhas_datas()  as datas em que a pessoa está escalada, com a escala dela.
--   fn_equipe_folha(data)     a folha de uma data: a data, a escala dela, os blocos que ela pode ver (os de
--                             todos e os do grupo dela) e os cartões de viagem e hospedagem. Nunca devolve outra
--                             pessoa, dinheiro nem dado de outra organização.
--   fn_equipe_responder(...)  a resposta dela à escala (confirmo, não posso, ou desfazer).
-- As funções rodam com a permissão do dono e conferem auth.uid() em cada consulta; o visitante não as executa.
--
-- Expansão: uma tabela nova e vazia, uma função de coerência e quatro funções novas. Nada do que existe muda.
-- Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_acessos_equipe (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pessoa_id uuid not null references public.producao_pessoas (id) deferrable initially deferred,
  email text not null,
  user_id uuid references auth.users (id) on delete set null,
  convidado_por uuid default auth.uid() references auth.users (id) on delete set null,
  aceito_em timestamptz,
  revogado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_acessos_equipe_pessoa_key unique (pessoa_id),
  constraint producao_acessos_equipe_email_check check (email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+$')
);

create index if not exists producao_acessos_equipe_org_idx on public.producao_acessos_equipe (organization_id);
create index if not exists producao_acessos_equipe_email_idx on public.producao_acessos_equipe (email) where revogado_em is null;
create index if not exists producao_acessos_equipe_user_idx on public.producao_acessos_equipe (user_id) where user_id is not null;
create index if not exists producao_acessos_equipe_convidado_por_idx on public.producao_acessos_equipe (convidado_por) where convidado_por is not null;

create or replace function public.fn_producao_acesso_equipe_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.pessoa_id is distinct from old.pessoa_id then
    raise exception 'pessoa_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if new.pessoa_id is not null and not exists (
    select 1 from public.producao_pessoas p where p.id = new.pessoa_id and p.organization_id = new.organization_id
  ) then
    raise exception 'pessoa_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_acessos_equipe_coerencia
  before insert or update of organization_id, pessoa_id on public.producao_acessos_equipe
  for each row execute function public.fn_producao_acesso_equipe_coerencia();
create or replace trigger producao_acessos_equipe_updated_at
  before update on public.producao_acessos_equipe
  for each row execute function public.fn_producao_updated_at();

alter table public.producao_acessos_equipe enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acessos_equipe' and policyname = 'producao_acessos_equipe: le') then
    create policy "producao_acessos_equipe: le" on public.producao_acessos_equipe for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_pessoa(organization_id, pessoa_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acessos_equipe' and policyname = 'producao_acessos_equipe: leitura sem assinatura') then
    create policy "producao_acessos_equipe: leitura sem assinatura" on public.producao_acessos_equipe for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_pessoa(organization_id, pessoa_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acessos_equipe' and policyname = 'producao_acessos_equipe: insere') then
    create policy "producao_acessos_equipe: insere" on public.producao_acessos_equipe for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_pessoa(organization_id, pessoa_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acessos_equipe' and policyname = 'producao_acessos_equipe: edita') then
    create policy "producao_acessos_equipe: edita" on public.producao_acessos_equipe for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_pessoa(organization_id, pessoa_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_pessoa(organization_id, pessoa_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acessos_equipe' and policyname = 'producao_acessos_equipe: apaga') then
    create policy "producao_acessos_equipe: apaga" on public.producao_acessos_equipe for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_pessoa(organization_id, pessoa_id));
  end if;
end
$$;

-- ─── As funções da pessoa convidada ─────────────────────────────────────────

-- Liga a conta de quem está logado aos convites do e-mail dele. Só vale com o e-mail confirmado: sem isso,
-- qualquer um poderia abrir uma conta com o e-mail de outra pessoa e ler a folha dela.
create or replace function public.fn_equipe_aceitar()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
  v_ligados integer;
begin
  if auth.uid() is null then
    return 0;
  end if;
  select lower(btrim(u.email)) into v_email from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
  if v_email is null or v_email = '' then
    return 0;
  end if;
  update public.producao_acessos_equipe a
  set user_id = auth.uid(), aceito_em = coalesce(a.aceito_em, now())
  where a.email = v_email and a.revogado_em is null and (a.user_id is null or a.user_id = auth.uid())
    and (a.user_id is distinct from auth.uid() or a.aceito_em is null);
  get diagnostics v_ligados = row_count;
  return v_ligados;
end;
$$;

-- As datas em que a pessoa convidada está escalada. Só a produção em vigor ou só para leitura, convite não
-- revogado, pessoa não arquivada.
create or replace function public.fn_equipe_minhas_datas()
returns table (
  escala_id uuid, data_id uuid, data date, data_fim date, tipo text, situacao text, uf text, fuso text,
  temporada_titulo text, organizacao_nome text, funcao text, chamada timestamptz, saida timestamptz, confirmacao text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.id, d.id, d.data, d.data_fim, d.tipo, d.situacao, d.uf, d.fuso,
         t.titulo, o.nome, e.funcao, e.chamada, e.saida, e.confirmacao
  from public.producao_acessos_equipe a
  join public.producao_pessoas p on p.id = a.pessoa_id and not p.arquivada
  join public.producao_escalas e on e.pessoa_id = p.id
  join public.producao_datas d on d.id = e.data_id
  join public.producao_temporadas t on t.id = d.temporada_id
  join public.organizations o on o.id = a.organization_id
  where a.user_id = auth.uid() and a.revogado_em is null
    and ('producao' = any (o.modulos_ativos) or 'producao' = any (o.modulos_leitura))
  order by d.data, e.chamada nulls last;
$$;

-- A folha de uma data: só para quem está escalado nela.
create or replace function public.fn_equipe_folha(p_data_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_escala public.producao_escalas%rowtype;
  v_org uuid;
  v_data record;
  v_grupos text[];
begin
  select e.* into v_escala
  from public.producao_acessos_equipe a
  join public.producao_pessoas p on p.id = a.pessoa_id and not p.arquivada
  join public.producao_escalas e on e.pessoa_id = p.id and e.data_id = p_data_id
  join public.organizations o on o.id = a.organization_id
  where a.user_id = auth.uid() and a.revogado_em is null
    and ('producao' = any (o.modulos_ativos) or 'producao' = any (o.modulos_leitura))
  limit 1;
  if not found then
    return null;
  end if;
  v_org := v_escala.organization_id;
  select d.id, d.temporada_id, d.data, d.data_fim, d.tipo, d.situacao, d.uf, d.fuso, t.titulo as temporada_titulo, o.nome as organizacao_nome
    into v_data
  from public.producao_datas d
  join public.producao_temporadas t on t.id = d.temporada_id
  join public.organizations o on o.id = d.organization_id
  where d.id = p_data_id and d.organization_id = v_org;
  -- Os grupos da pessoa na temporada (um bloco pode ser só de um grupo).
  select coalesce(array_agg(lower(btrim(v.grupo))) filter (where v.grupo is not null), '{}') into v_grupos
  from public.producao_vinculos v
  where v.pessoa_id = v_escala.pessoa_id and v.temporada_id = v_data.temporada_id and v.situacao <> 'cancelada';
  return jsonb_build_object(
    'data', jsonb_build_object('id', v_data.id, 'data', v_data.data, 'data_fim', v_data.data_fim, 'tipo', v_data.tipo, 'situacao', v_data.situacao,
      'uf', v_data.uf, 'fuso', v_data.fuso, 'temporada_titulo', v_data.temporada_titulo, 'organizacao_nome', v_data.organizacao_nome),
    'escala', jsonb_build_object('id', v_escala.id, 'funcao', v_escala.funcao, 'chamada', v_escala.chamada, 'saida', v_escala.saida, 'confirmacao', v_escala.confirmacao),
    'blocos', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'inicio', b.inicio, 'fim', b.fim, 'exibicao', b.exibicao, 'tipo', b.tipo, 'titulo', b.titulo, 'confirmado', b.confirmado)
                       order by b.inicio nulls last, b.ordem)
      from public.producao_blocos b
      where b.data_id = p_data_id and b.organization_id = v_org
        and (b.visivel_para is null or cardinality(b.visivel_para) = 0
             or exists (select 1 from unnest(b.visivel_para) as g where lower(btrim(g)) = any (v_grupos)))
    ), '[]'::jsonb),
    'cartoes', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', c.tipo, 'titulo', c.titulo, 'inicio', c.inicio, 'fim', c.fim, 'endereco', c.endereco, 'localizador', c.localizador, 'notas', c.notas)
                       order by c.tipo)
      from public.producao_cartoes_dia c
      where c.data_id = p_data_id and c.organization_id = v_org
    ), '[]'::jsonb)
  );
end;
$$;

-- A resposta da pessoa à própria escala. Devolve se alterou.
create or replace function public.fn_equipe_responder(p_escala_id uuid, p_resposta text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_ok integer;
begin
  if p_resposta is null or p_resposta not in ('pendente', 'confirmada', 'recusada') then
    raise exception 'resposta_invalida' using errcode = 'check_violation';
  end if;
  update public.producao_escalas e
  set confirmacao = p_resposta
  where e.id = p_escala_id and e.confirmacao is distinct from p_resposta
    and exists (
      select 1
      from public.producao_acessos_equipe a
      join public.producao_pessoas p on p.id = a.pessoa_id and not p.arquivada
      join public.organizations o on o.id = a.organization_id
      join public.producao_datas d on d.id = e.data_id and d.situacao <> 'cancelada'
      where a.user_id = auth.uid() and a.revogado_em is null and p.id = e.pessoa_id
        and 'producao' = any (o.modulos_ativos)
    );
  get diagnostics v_ok = row_count;
  return v_ok > 0;
end;
$$;

revoke execute on function public.fn_producao_acesso_equipe_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_equipe_aceitar() from public, anon;
revoke execute on function public.fn_equipe_minhas_datas() from public, anon;
revoke execute on function public.fn_equipe_folha(uuid) from public, anon;
revoke execute on function public.fn_equipe_responder(uuid, text) from public, anon;
grant execute on function public.fn_equipe_aceitar() to authenticated;
grant execute on function public.fn_equipe_minhas_datas() to authenticated;
grant execute on function public.fn_equipe_folha(uuid) to authenticated;
grant execute on function public.fn_equipe_responder(uuid, text) to authenticated;

revoke all on public.producao_acessos_equipe from anon, authenticated;
grant select, insert, update, delete on public.producao_acessos_equipe to authenticated;

comment on table public.producao_acessos_equipe is
  'O convite da pessoa da equipe para ver a folha dela: a ficha, o e-mail convidado e a conta, quando entra. A pessoa convidada não é membro da organização e não lê esta tabela: usa as funções fn_equipe_*.';
comment on function public.fn_equipe_folha(uuid) is
  'A folha de uma data para a pessoa convidada escalada nela: a data, a escala dela, os blocos que ela pode ver e os cartões de viagem e hospedagem. Nunca outra pessoa nem dinheiro.';
