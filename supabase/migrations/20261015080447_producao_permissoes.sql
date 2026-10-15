-- PD0.7a: permissões da produção no banco.
--
-- Quem pode o quê dentro do módulo de produção, no molde da prestação
-- (auth_prestacao_papel_permite e auth_prestacao_pode), e a tabela com as
-- funções que o admin dá a cada pessoa (ver o dinheiro, aprovar pedidos até um
-- valor, ver só o que é dela). Nenhuma tabela da produção usa isto ainda: as de
-- dados (obra, temporada, data, bloco) nascem na PD0.8, os espaços na PD0.9 e os
-- vínculos na PD1.9. A tela de edição do membro é a entrega seguinte.
--
-- Expansão: acrescenta uma tabela e funções novas e não altera nada do que já
-- existe. Nenhuma organização tem a produção ainda (0 contratos e 0 vínculos em
-- 15/10/2026), então hoje ninguém passa a ver nem a poder nada. Aditiva e
-- reaplicável; sem DROP.
--
-- ─── Ações: auth_producao_pode(organização, ação) ───────────────────────────
--   ler       admin, colaborador e leitor
--   editar    admin e colaborador
--   dinheiro  admin; colaborador e leitor só com a função "vê o dinheiro"
--             (producao_funcoes.dinheiro). É só visibilidade: escrever numa
--             tabela de dinheiro pede também "editar"
--   aprovar   admin; colaborador com "vê o dinheiro" e alçada definida
--             (producao_funcoes.alcada). Aprovar muda o pedido, então o leitor
--             não aprova nunca. O valor do pedido contra a alçada é conferido
--             por quem aprova (PD5.4); aqui só se diz se a pessoa aprova
-- Papel antigo: "visualizador" é o nome antigo do colaborador (as telas o
-- mostram como Colaborador, e auth_prestacao_papel_permite o trata assim).
-- Captador e proponente nunca usam a produção (PAPEIS_EXTERNOS em
-- lib/equipe-modulos.ts): nenhuma lista de papéis abaixo os traz, então papel
-- novo também nasce sem acesso. Ação desconhecida nega, até para o super admin,
-- que de resto passa por tudo, como em auth_tem_modulo e auth_prestacao_pode.
--
-- ─── Módulo em vigor e módulo só para leitura ───────────────────────────────
-- Cortesia ou assinatura que acaba: a produção sai de organizations.modulos_ativos
-- e vai para modulos_leitura, e quem tinha acesso continua lendo ("os dados
-- continuam guardados"), sem escrever.
--   auth_producao_pode(org, ação)            só com a produção em vigor
--   auth_producao_le_sem_assinatura(org)     produção só para leitura e a pessoa lê
--   auth_producao_dinheiro_sem_assinatura(org)  o mesmo, para quem vê o dinheiro
-- A de dinheiro existe à parte para a leitura sem assinatura não abrir o
-- dinheiro a quem não tem a função.
--
-- Como uma tabela da produção usa isto (supabase/tests/producao_permissoes.test.sql
-- cria uma tabela comum e uma de dinheiro assim, como sondas):
--   ler:      (pode(org, 'ler') or le_sem_assinatura(org)) and ve_temporada(org, temporada_id)
--   escrever: pode(org, 'editar') and ve_temporada(org, temporada_id)
--   dinheiro: ler com pode(org, 'dinheiro') or dinheiro_sem_assinatura(org);
--             escrever com pode(org, 'editar') and pode(org, 'dinheiro')
-- Aprovar não é regra de tabela: vira função de escrita (security definer) que
-- confere pode(org, 'aprovar') e o valor contra a alçada.
--
-- ─── Recorte por vínculo (escopo 'vinculado') ───────────────────────────────
-- As tabelas de temporada e de espaço (PD0.8 e PD0.9) e os vínculos (PD1.9)
-- ainda não existem. auth_producao_ve_temporada e auth_producao_ve_espaco não
-- consultam nenhuma delas e FALHAM FECHADO: quem tem o recorte "só onde está
-- vinculado" não vê nada até a PD1.9. Quem tem a organização inteira (o padrão
-- de quem não tem registro em producao_funcoes) vê tudo o que o módulo deixa, e
-- o admin sempre vê tudo. A tela não deve oferecer o recorte antes da PD1.9.
-- O que a PD1.9 troca, com create or replace e a mesma assinatura (sem DROP):
--   auth_producao_ve_temporada(p_org, p_temporada_id)
--   auth_producao_ve_espaco(p_org, p_espaco_id)
-- Em cada uma, o ramo "vinculado" passa a consultar o vínculo, dentro da condição
-- que hoje é (ficha.papel = 'admin' or ficha.escopo = 'organizacao'):
--   or (ficha.escopo = 'vinculado' and exists (
--         select 1 from public.producao_vinculos vinculo
--         where vinculo.organization_id = p_org and vinculo.user_id = auth.uid()
--           and vinculo.temporada_id = p_temporada_id))   -- em ve_espaco: espaco_id = p_espaco_id
-- (com o vínculo em vigor, no sentido que a PD1.9 definir). A condição já traz a
-- ficha da pessoa: o resto das funções não muda. Juntar ao teste
-- supabase/tests/producao_permissoes.test.sql o caso "só vê a temporada e o espaço
-- em que tem vínculo" (hoje a pessoa "aa" não vê nada) e tirar do teste de texto
-- tests/producao-permissoes-sql.test.ts a trava que proíbe a palavra "vinculado"
-- no corpo das duas funções.
--
-- ─── Quem escreve em producao_funcoes ───────────────────────────────────────
-- Só fn_producao_definir_funcao (security definer): exige que quem chama seja
-- admin da organização, e que a pessoa-alvo seja membro interno com o módulo
-- produção. A tabela não tem regra de escrita para o navegador e os privilégios
-- de escrita de anon e authenticated são revogados (defesa dupla). Sair da
-- organização apaga o registro. Perder só o módulo produção não: o registro
-- fica guardado e volta a valer se a pessoa o recuperar.

set local lock_timeout = '10s';

-- ─── 1. Funções que o admin dá a cada pessoa ────────────────────────────────

create table if not exists public.producao_funcoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  -- Vê o dinheiro da produção (orçamento, cachês, pagamentos).
  dinheiro boolean not null default false,
  -- Aprova pedidos até este valor; nula = não aprova. Só vale com "dinheiro".
  alcada numeric(14, 2),
  -- 'organizacao' = tudo o que o módulo deixa; 'vinculado' = só as temporadas e
  -- os espaços em que a pessoa tem vínculo (vale a partir da PD1.9).
  escopo text not null default 'organizacao',
  definido_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_funcoes_organization_id_user_id_key unique (organization_id, user_id),
  -- A função é do vínculo: sair da organização apaga o registro, e quem volta
  -- não herda o que tinha.
  constraint producao_funcoes_membro_fkey foreign key (organization_id, user_id)
    references public.organization_members (organization_id, user_id) on delete cascade,
  constraint producao_funcoes_escopo_check check (escopo in ('organizacao', 'vinculado')),
  constraint producao_funcoes_alcada_check check (alcada is null or (dinheiro and alcada >= 0))
);

comment on table public.producao_funcoes is
  'Funções do membro na produção: ver o dinheiro, aprovar pedidos até a alçada e o recorte por vínculo. Um registro por pessoa e organização. Só fn_producao_definir_funcao escreve.';

alter table public.producao_funcoes enable row level security;

-- Cada pessoa lê a própria função (a tela sabe o que mostrar) e o admin da
-- organização, ou o suporte, lê todas. Sem regra de insert, update nem delete.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_funcoes'
                 and policyname = 'producao_funcoes: le a propria ou admin') then
    create policy "producao_funcoes: le a propria ou admin" on public.producao_funcoes
      for select to authenticated
      using (user_id = auth.uid() or public.auth_admin_da_organizacao(organization_id));
  end if;
end
$$;

revoke all on public.producao_funcoes from anon, authenticated;
grant select on public.producao_funcoes to authenticated;

-- ─── 2. O que cada papel pode (pura, no molde de auth_prestacao_papel_permite) ──

create or replace function public.auth_producao_papel_permite(
  p_papel text, p_dinheiro boolean, p_alcada numeric, p_acao text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(case p_acao
    when 'ler' then p_papel in ('admin', 'colaborador', 'visualizador', 'leitor')
    when 'editar' then p_papel in ('admin', 'colaborador', 'visualizador')
    when 'dinheiro' then p_papel = 'admin'
      or (p_papel in ('colaborador', 'visualizador', 'leitor') and coalesce(p_dinheiro, false))
    when 'aprovar' then p_papel = 'admin'
      or (p_papel in ('colaborador', 'visualizador') and coalesce(p_dinheiro, false) and p_alcada is not null)
  end, false);
$$;

-- ─── 3. A ficha da pessoa logada na organização (uso interno) ───────────────
-- Uma linha quando a pessoa é membro com o módulo produção em vigor ou só para
-- leitura na organização; nenhuma linha nos outros casos (inclusive visitante).
-- so_leitura: a produção está em modulos_leitura em vez de modulos_ativos.

create or replace function public.auth_producao_ficha(p_org uuid)
returns table (papel text, dinheiro boolean, alcada numeric, escopo text, so_leitura boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select membro.papel,
         coalesce(funcao.dinheiro, false),
         funcao.alcada,
         coalesce(funcao.escopo, 'organizacao'),
         not ('producao' = any (organizacao.modulos_ativos))
  from public.organization_members membro
  join public.organizations organizacao on organizacao.id = membro.organization_id
  left join public.producao_funcoes funcao
    on funcao.organization_id = membro.organization_id and funcao.user_id = membro.user_id
  where membro.organization_id = p_org
    and membro.user_id = auth.uid()
    and 'producao' = any (membro.modulos_acesso)
    and ('producao' = any (organizacao.modulos_ativos) or 'producao' = any (organizacao.modulos_leitura));
$$;

-- ─── 4. Quem pode, com a produção em vigor ──────────────────────────────────

create or replace function public.auth_producao_pode(p_org uuid, p_acao text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(p_acao in ('ler', 'editar', 'dinheiro', 'aprovar'), false)
    and (
      public.is_jards_super_admin()
      or exists (
        select 1 from public.auth_producao_ficha(p_org) ficha
        where not ficha.so_leitura
          and public.auth_producao_papel_permite(ficha.papel, ficha.dinheiro, ficha.alcada, p_acao)
      )
    );
$$;

-- ─── 5. Quem lê com a produção só para leitura ──────────────────────────────

create or replace function public.auth_producao_le_sem_assinatura(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.auth_producao_ficha(p_org) ficha
    where ficha.so_leitura
      and public.auth_producao_papel_permite(ficha.papel, ficha.dinheiro, ficha.alcada, 'ler')
  );
$$;

create or replace function public.auth_producao_dinheiro_sem_assinatura(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.auth_producao_ficha(p_org) ficha
    where ficha.so_leitura
      and public.auth_producao_papel_permite(ficha.papel, ficha.dinheiro, ficha.alcada, 'dinheiro')
  );
$$;

-- ─── 6. Recorte por vínculo (falha fechado até a PD1.9) ─────────────────────
-- Dizem se o recorte da pessoa deixa ver a temporada ou o espaço. Não conferem
-- o estado do módulo nem a ação: a regra da tabela junta estas com pode/le_sem_assinatura.

create or replace function public.auth_producao_ve_temporada(p_org uuid, p_temporada_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_jards_super_admin() or exists (
    select 1 from public.auth_producao_ficha(p_org) ficha
    where public.auth_producao_papel_permite(ficha.papel, ficha.dinheiro, ficha.alcada, 'ler')
      and (ficha.papel = 'admin' or ficha.escopo = 'organizacao')
  );
$$;

create or replace function public.auth_producao_ve_espaco(p_org uuid, p_espaco_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_jards_super_admin() or exists (
    select 1 from public.auth_producao_ficha(p_org) ficha
    where public.auth_producao_papel_permite(ficha.papel, ficha.dinheiro, ficha.alcada, 'ler')
      and (ficha.papel = 'admin' or ficha.escopo = 'organizacao')
  );
$$;

-- ─── 7. Dar a função a alguém (a única escrita em producao_funcoes) ─────────
-- Quem chama é admin da organização (ou o suporte); o alvo é membro interno com
-- o módulo produção, numa organização que o tem em vigor. Grava ou substitui o
-- registro da pessoa e devolve o id. Erros: nao_autenticado e sem_permissao
-- (42501); dados_invalidos, escopo_invalido, alcada_invalida e alcada_sem_dinheiro
-- (22023); membro_inexistente (P0002); captador_sem_modulo, modulo_inativo e
-- pessoa_sem_producao (P0001).

create or replace function public.fn_producao_definir_funcao(
  p_org uuid, p_user uuid, p_dinheiro boolean, p_alcada numeric, p_escopo text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alvo record;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if p_org is null or not public.auth_admin_da_organizacao(p_org) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if p_user is null or p_dinheiro is null then
    raise exception 'dados_invalidos' using errcode = '22023';
  end if;
  if p_escopo is null or p_escopo not in ('organizacao', 'vinculado') then
    raise exception 'escopo_invalido' using errcode = '22023';
  end if;
  if p_alcada is not null and (p_alcada < 0 or p_alcada >= 1000000000000) then
    raise exception 'alcada_invalida' using errcode = '22023';
  end if;
  if p_alcada is not null and not p_dinheiro then
    raise exception 'alcada_sem_dinheiro' using errcode = '22023';
  end if;

  select membro.papel, membro.modulos_acesso, organizacao.modulos_ativos
  into v_alvo
  from public.organization_members membro
  join public.organizations organizacao on organizacao.id = membro.organization_id
  where membro.organization_id = p_org and membro.user_id = p_user;
  if not found then
    raise exception 'membro_inexistente' using errcode = 'P0002';
  end if;
  if v_alvo.papel in ('captador', 'proponente') then
    raise exception 'captador_sem_modulo' using errcode = 'P0001';
  end if;
  if not ('producao' = any (v_alvo.modulos_ativos)) then
    raise exception 'modulo_inativo' using errcode = 'P0001';
  end if;
  if not ('producao' = any (v_alvo.modulos_acesso)) then
    raise exception 'pessoa_sem_producao' using errcode = 'P0001';
  end if;

  insert into public.producao_funcoes (organization_id, user_id, dinheiro, alcada, escopo, definido_por)
  values (p_org, p_user, p_dinheiro, p_alcada, p_escopo, auth.uid())
  on conflict (organization_id, user_id) do update
    set dinheiro = excluded.dinheiro,
        alcada = excluded.alcada,
        escopo = excluded.escopo,
        definido_por = excluded.definido_por,
        updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- ─── 8. Quem executa ────────────────────────────────────────────────────────
-- As regras de tabela chamam estas funções com a permissão de quem está logado,
-- então authenticated precisa executá-las; o visitante nunca. A ficha é só das
-- outras funções (que rodam com a permissão do dono) e não sai para o navegador.

revoke execute on function public.auth_producao_papel_permite(text, boolean, numeric, text) from public, anon;
revoke execute on function public.auth_producao_ficha(uuid) from public, anon, authenticated;
revoke execute on function public.auth_producao_pode(uuid, text) from public, anon;
revoke execute on function public.auth_producao_le_sem_assinatura(uuid) from public, anon;
revoke execute on function public.auth_producao_dinheiro_sem_assinatura(uuid) from public, anon;
revoke execute on function public.auth_producao_ve_temporada(uuid, uuid) from public, anon;
revoke execute on function public.auth_producao_ve_espaco(uuid, uuid) from public, anon;
revoke execute on function public.fn_producao_definir_funcao(uuid, uuid, boolean, numeric, text) from public, anon;

grant execute on function public.auth_producao_papel_permite(text, boolean, numeric, text) to authenticated;
grant execute on function public.auth_producao_pode(uuid, text) to authenticated;
grant execute on function public.auth_producao_le_sem_assinatura(uuid) to authenticated;
grant execute on function public.auth_producao_dinheiro_sem_assinatura(uuid) to authenticated;
grant execute on function public.auth_producao_ve_temporada(uuid, uuid) to authenticated;
grant execute on function public.auth_producao_ve_espaco(uuid, uuid) to authenticated;
grant execute on function public.fn_producao_definir_funcao(uuid, uuid, boolean, numeric, text) to authenticated;

comment on function public.auth_producao_papel_permite(text, boolean, numeric, text) is
  'O papel pode a ação na produção? Ações: ler, editar, dinheiro, aprovar. Recebe a função da pessoa (vê o dinheiro, alçada). Papel e ação desconhecidos negam; captador e proponente nunca.';
comment on function public.auth_producao_pode(uuid, text) is
  'A pessoa logada pode a ação (ler, editar, dinheiro, aprovar) na produção da organização, com o módulo em vigor. Super admin passa.';
comment on function public.auth_producao_le_sem_assinatura(uuid) is
  'A produção da organização está só para leitura (assinatura ou cortesia acabou) e a pessoa logada lê. Não dá escrita.';
comment on function public.auth_producao_dinheiro_sem_assinatura(uuid) is
  'Como auth_producao_le_sem_assinatura, para tabelas de dinheiro: só quem vê o dinheiro.';
comment on function public.auth_producao_ve_temporada(uuid, uuid) is
  'O recorte da pessoa deixa ver a temporada? Falha fechado para o recorte por vínculo até a PD1.9.';
comment on function public.auth_producao_ve_espaco(uuid, uuid) is
  'O recorte da pessoa deixa ver o espaço? Falha fechado para o recorte por vínculo até a PD1.9.';
comment on function public.fn_producao_definir_funcao(uuid, uuid, boolean, numeric, text) is
  'Dá à pessoa a função na produção (dinheiro, alçada, recorte). Só o admin da organização; a única escrita em producao_funcoes.';
