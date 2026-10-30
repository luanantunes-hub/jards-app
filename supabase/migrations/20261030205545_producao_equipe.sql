-- PD1.9 e PD1.10, a parte essencial: a equipe da produção no banco.
--
-- Quem trabalha na produção, em que temporada (ou espaço) e em que data:
--   producao_pessoas            a pessoa: nome, nome artístico, e-mail, telefone e o tipo principal
--                               (equipe, elenco, técnica...). Pode ser membro do Jards (user_id) ou não
--                               (a maior parte da equipe de uma turnê não tem conta). Uma por membro.
--   producao_vinculos           a pessoa numa temporada ou num espaço (um dos dois): função, grupo,
--                               período e situação (prevista, confirmada, cancelada)
--   producao_vinculos_valores   o cachê e a diária do vínculo, à parte: só quem vê o dinheiro lê
--   producao_escalas            a pessoa numa data: função no dia, chamada, saída e a resposta dela
--                               (pendente, confirmada, recusada). Uma por pessoa e data
-- E o recorte "só onde está vinculado" (PD0.7a), que falhava fechado, passa a valer:
-- auth_producao_ve_temporada e auth_producao_ve_espaco ganham o ramo do vínculo (create or replace,
-- mesma assinatura, sem DROP), como o cabeçalho de 20261015080447_producao_permissoes.sql previu.
--
-- ─── O que fica de fora (decisão do dono, 29/10/2026) ───────────────────────
-- Só o essencial. CPF, RG, passaporte, CNH, contato de emergência, banco e PIX, restrição
-- alimentar e alergia (dado de saúde) NÃO entram: esperam a política de dados pessoais da
-- equipe (pré-requisito 5 do plano: o que se coleta, base legal, quem vê, prazo de guarda e
-- descarte). Quando ela vier, o dado pessoal mora numa tabela própria (producao_pessoas_privado,
-- 1 para 1, sem histórico), não aqui. Também ficam para depois: a escala por bloco do dia, a
-- importação por planilha e a função de conflitos no banco (a que diria "ocupado" a quem não vê a
-- outra temporada); os conflitos visíveis a quem lê saem das próprias escalas (lib/producao).
--
-- ─── O recorte por vínculo ──────────────────────────────────────────────────
-- Quem tem o recorte "vinculado" (producao_funcoes.escopo) vê a temporada, ou o espaço, em que
-- tem um vínculo que não foi cancelado, como pessoa ligada à própria conta (producao_pessoas.user_id
-- = auth.uid()) e não arquivada. O período do vínculo não tira o acesso: quem trabalhou na turnê
-- continua vendo o que fez. Admin e quem tem a organização inteira não mudam; o super admin passa.
-- Com a temporada nula, a função continua respondendo só "a pessoa tem recorte?" (o vínculo nunca
-- casa com nulo), que é como auth_producao_ve_obra e auth_producao_ve_pessoa perguntam.
-- Quem tem o recorte vê as pessoas dos vínculos que vê, mas não cria pessoa (a pessoa nova ainda
-- não tem vínculo, e a tela não a enxergaria depois de criar): quem cria é quem vê a organização
-- inteira. Os vínculos e as escalas seguem a temporada (ou o espaço) e a data.
--
-- ─── Dinheiro e histórico ───────────────────────────────────────────────────
-- O cachê e a diária ficam em producao_vinculos_valores, com as regras de dinheiro da PD0.7a:
-- lê quem pode 'dinheiro' (ou dinheiro sem assinatura) e vê o vínculo; escreve quem pode 'editar'
-- e 'dinheiro'. Essa tabela não tem histórico (o valor não pode ir para uma linha que outras pessoas
-- leem). As outras três têm: a das pessoas deixa o e-mail e o telefone de fora (lista de exclusão
-- do gatilho), e auth_producao_ve_historico ganha os três ramos (create or replace, mesma
-- assinatura), cada um perguntando à própria tabela com as regras de quem consulta.
--
-- ─── Apagar ─────────────────────────────────────────────────────────────────
-- Pessoa com vínculo ou escala não se apaga: arquiva-se. Temporada ou espaço com vínculo, e data
-- com escala, também não. Essas chaves são conferidas no fim da transação
-- (deferrable initially deferred), como as do esqueleto, para o apagamento de uma organização
-- inteira passar. O valor sai com o vínculo; quem sai da organização desliga a pessoa da conta
-- (user_id nulo) sem apagá-la.
--
-- Expansão: quatro tabelas novas e vazias, uma função de recorte nova (auth_producao_ve_pessoa),
-- quatro de coerência, três trocadas com a mesma assinatura. Nenhuma organização tem a produção
-- (0 contratos em 29/10/2026), então hoje ninguém passa a ver nem a poder nada. Aditiva e
-- reaplicável; sem DROP.

set local lock_timeout = '10s';

-- ─── 1. As tabelas ──────────────────────────────────────────────────────────

create table if not exists public.producao_pessoas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null,
  nome_artistico text,
  email text,
  telefone text,
  -- Do catálogo de lib/producao/vocabulario.ts (equipe, elenco, técnica...): o banco só confere a forma.
  tipo text not null default 'equipe',
  -- A conta da pessoa, quando ela é membro da organização. Sair da organização só desliga.
  user_id uuid,
  -- Fora de uso: a pessoa com vínculo ou escala não se apaga, arquiva-se.
  arquivada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_pessoas_user_key unique (organization_id, user_id),
  constraint producao_pessoas_membro_fkey foreign key (organization_id, user_id)
    references public.organization_members (organization_id, user_id) on delete set null (user_id),
  constraint producao_pessoas_nome_check check (char_length(btrim(nome)) between 1 and 200),
  constraint producao_pessoas_nome_artistico_check check (nome_artistico is null or char_length(btrim(nome_artistico)) between 1 and 200),
  constraint producao_pessoas_email_check check (email is null or (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+$')),
  constraint producao_pessoas_telefone_check check (telefone is null or char_length(btrim(telefone)) between 1 and 40),
  constraint producao_pessoas_tipo_check check (char_length(btrim(tipo)) between 1 and 40)
);

create table if not exists public.producao_vinculos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pessoa_id uuid not null references public.producao_pessoas (id) deferrable initially deferred,
  temporada_id uuid references public.producao_temporadas (id) deferrable initially deferred,
  espaco_id uuid references public.producao_espacos (id) deferrable initially deferred,
  funcao text not null,
  grupo text,
  inicio date,
  fim date,
  situacao text not null default 'prevista',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_vinculos_lugar_check check (num_nonnulls(temporada_id, espaco_id) = 1),
  constraint producao_vinculos_funcao_check check (char_length(btrim(funcao)) between 1 and 80),
  constraint producao_vinculos_grupo_check check (grupo is null or char_length(btrim(grupo)) between 1 and 80),
  constraint producao_vinculos_periodo_check check (inicio is null or fim is null or fim >= inicio),
  constraint producao_vinculos_situacao_check check (situacao in ('prevista', 'confirmada', 'cancelada'))
);

create table if not exists public.producao_vinculos_valores (
  vinculo_id uuid primary key references public.producao_vinculos (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  cache numeric(14, 2),
  diaria numeric(14, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_vinculos_valores_cache_check check (cache is null or cache between 0 and 999999999999.99),
  constraint producao_vinculos_valores_diaria_check check (diaria is null or diaria between 0 and 999999999999.99)
);

create table if not exists public.producao_escalas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pessoa_id uuid not null references public.producao_pessoas (id) deferrable initially deferred,
  data_id uuid not null references public.producao_datas (id) deferrable initially deferred,
  funcao text,
  chamada timestamptz,
  saida timestamptz,
  confirmacao text not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_escalas_pessoa_data_key unique (pessoa_id, data_id),
  constraint producao_escalas_funcao_check check (funcao is null or char_length(btrim(funcao)) between 1 and 80),
  constraint producao_escalas_periodo_check check (saida is null or (chamada is not null and saida >= chamada)),
  constraint producao_escalas_confirmacao_check check (confirmacao in ('pendente', 'confirmada', 'recusada'))
);

-- ─── 2. Índices (toda chave tem o seu) ──────────────────────────────────────

create index if not exists producao_pessoas_org_idx on public.producao_pessoas (organization_id, nome);

create index if not exists producao_vinculos_org_idx on public.producao_vinculos (organization_id);
create index if not exists producao_vinculos_pessoa_idx on public.producao_vinculos (pessoa_id);
create index if not exists producao_vinculos_temporada_idx on public.producao_vinculos (temporada_id) where temporada_id is not null;
create index if not exists producao_vinculos_espaco_idx on public.producao_vinculos (espaco_id) where espaco_id is not null;
-- A mesma pessoa pode ter duas funções na mesma temporada (atriz e assistente), mas não a mesma duas vezes.
create unique index if not exists producao_vinculos_temporada_funcao_key
  on public.producao_vinculos (pessoa_id, temporada_id, lower(btrim(funcao))) where temporada_id is not null;
create unique index if not exists producao_vinculos_espaco_funcao_key
  on public.producao_vinculos (pessoa_id, espaco_id, lower(btrim(funcao))) where espaco_id is not null;

create index if not exists producao_vinculos_valores_org_idx on public.producao_vinculos_valores (organization_id);

create index if not exists producao_escalas_org_idx on public.producao_escalas (organization_id);
create index if not exists producao_escalas_data_idx on public.producao_escalas (data_id);

-- ─── 3. Funções ─────────────────────────────────────────────────────────────

-- Coerência: o filho está na organização do pai e a organização não muda depois. Rodam com a
-- permissão do dono para enxergar o pai mesmo quando a regra da tabela dele não deixaria a pessoa
-- vê-lo; a mesma recusa serve para "não existe" e "é de outra", sem mostrar qual. A conta da pessoa
-- (user_id) já é conferida pela chave com organization_members.
-- Erros (check_violation): organizacao_nao_muda, pessoa_de_outra_organizacao,
-- temporada_de_outra_organizacao, espaco_de_outra_organizacao, vinculo_de_outra_organizacao,
-- data_de_outra_organizacao.

create or replace function public.fn_producao_pessoa_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.fn_producao_vinculo_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if new.pessoa_id is not null and not exists (
    select 1 from public.producao_pessoas p where p.id = new.pessoa_id and p.organization_id = new.organization_id
  ) then
    raise exception 'pessoa_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.temporada_id is not null and not exists (
    select 1 from public.producao_temporadas t where t.id = new.temporada_id and t.organization_id = new.organization_id
  ) then
    raise exception 'temporada_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.espaco_id is not null and not exists (
    select 1 from public.producao_espacos e where e.id = new.espaco_id and e.organization_id = new.organization_id
  ) then
    raise exception 'espaco_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.fn_producao_vinculo_valor_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if new.vinculo_id is not null and not exists (
    select 1 from public.producao_vinculos v where v.id = new.vinculo_id and v.organization_id = new.organization_id
  ) then
    raise exception 'vinculo_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.fn_producao_escala_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if new.pessoa_id is not null and not exists (
    select 1 from public.producao_pessoas p where p.id = new.pessoa_id and p.organization_id = new.organization_id
  ) then
    raise exception 'pessoa_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.data_id is not null and not exists (
    select 1 from public.producao_datas d where d.id = new.data_id and d.organization_id = new.organization_id
  ) then
    raise exception 'data_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- O recorte por vínculo (PD0.7a): o texto de 20261015080447_producao_permissoes.sql com o ramo
-- "vinculado" na condição que era (ficha.papel = 'admin' or ficha.escopo = 'organizacao').

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
      and (ficha.papel = 'admin' or ficha.escopo = 'organizacao'
        or (ficha.escopo = 'vinculado' and exists (
          select 1 from public.producao_vinculos vinculo
          join public.producao_pessoas pessoa on pessoa.id = vinculo.pessoa_id
          where vinculo.organization_id = p_org and pessoa.organization_id = p_org
            and pessoa.user_id = auth.uid() and not pessoa.arquivada
            and vinculo.situacao <> 'cancelada'
            and vinculo.temporada_id = p_temporada_id)))
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
      and (ficha.papel = 'admin' or ficha.escopo = 'organizacao'
        or (ficha.escopo = 'vinculado' and exists (
          select 1 from public.producao_vinculos vinculo
          join public.producao_pessoas pessoa on pessoa.id = vinculo.pessoa_id
          where vinculo.organization_id = p_org and pessoa.organization_id = p_org
            and pessoa.user_id = auth.uid() and not pessoa.arquivada
            and vinculo.situacao <> 'cancelada'
            and vinculo.espaco_id = p_espaco_id)))
  );
$$;

-- Quem vê a pessoa: quem não tem recorte e, com o recorte por vínculo, quem vê a temporada ou o
-- espaço de algum vínculo dela. Roda com a permissão do dono (como auth_producao_ve_obra), para a
-- regra das pessoas não depender da regra dos vínculos e vice-versa. Não confere o estado do
-- módulo nem a ação: a regra da tabela junta esta com pode/le_sem_assinatura.

create or replace function public.auth_producao_ve_pessoa(p_org uuid, p_pessoa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.auth_producao_ve_temporada(p_org, null)
    or exists (
      select 1 from public.producao_vinculos v
      where v.organization_id = p_org and v.pessoa_id = p_pessoa_id
        and ((v.temporada_id is not null and public.auth_producao_ve_temporada(p_org, v.temporada_id))
          or (v.espaco_id is not null and public.auth_producao_ve_espaco(p_org, v.espaco_id)))
    );
$$;

-- Quem vê o histórico: o texto de 20261015155358_producao_arquivos.sql com os três ramos novos no fim.
-- Os valores do vínculo não têm histórico, então não têm ramo.

create or replace function public.auth_producao_ve_historico(p_org uuid, p_entidade text, p_entidade_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(case p_entidade
    when 'producao_obras' then exists (select 1 from public.producao_obras x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_temporadas' then exists (select 1 from public.producao_temporadas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_datas' then exists (select 1 from public.producao_datas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_blocos' then exists (select 1 from public.producao_blocos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_espacos' then exists (select 1 from public.producao_espacos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_salas' then exists (select 1 from public.producao_salas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_funcoes' then exists (select 1 from public.producao_funcoes x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_arquivos' then exists (select 1 from public.producao_arquivos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_pessoas' then exists (select 1 from public.producao_pessoas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_vinculos' then exists (select 1 from public.producao_vinculos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_escalas' then exists (select 1 from public.producao_escalas x where x.id = p_entidade_id and x.organization_id = p_org)
  end, false);
$$;

-- ─── 4. Gatilhos ────────────────────────────────────────────────────────────

create or replace trigger producao_pessoas_coerencia
  before insert or update of organization_id on public.producao_pessoas
  for each row execute function public.fn_producao_pessoa_coerencia();
create or replace trigger producao_vinculos_coerencia
  before insert or update of organization_id, pessoa_id, temporada_id, espaco_id on public.producao_vinculos
  for each row execute function public.fn_producao_vinculo_coerencia();
create or replace trigger producao_vinculos_valores_coerencia
  before insert or update of organization_id, vinculo_id on public.producao_vinculos_valores
  for each row execute function public.fn_producao_vinculo_valor_coerencia();
create or replace trigger producao_escalas_coerencia
  before insert or update of organization_id, pessoa_id, data_id on public.producao_escalas
  for each row execute function public.fn_producao_escala_coerencia();

create or replace trigger producao_pessoas_updated_at
  before update on public.producao_pessoas
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_vinculos_updated_at
  before update on public.producao_vinculos
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_vinculos_valores_updated_at
  before update on public.producao_vinculos_valores
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_escalas_updated_at
  before update on public.producao_escalas
  for each row execute function public.fn_producao_updated_at();

-- O histórico (PD0.10): o e-mail e o telefone da pessoa ficam de fora; o rótulo é o nome e a função.
create or replace trigger producao_pessoas_historico
  after insert or update or delete on public.producao_pessoas
  for each row execute function public.fn_producao_historico('email,telefone', 'nome');
create or replace trigger producao_vinculos_historico
  after insert or update or delete on public.producao_vinculos
  for each row execute function public.fn_producao_historico('', 'funcao');
create or replace trigger producao_escalas_historico
  after insert or update or delete on public.producao_escalas
  for each row execute function public.fn_producao_historico('', 'funcao');

-- ─── 5. Regras de acesso ────────────────────────────────────────────────────

alter table public.producao_pessoas enable row level security;
alter table public.producao_vinculos enable row level security;
alter table public.producao_vinculos_valores enable row level security;
alter table public.producao_escalas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_pessoas'
                 and policyname = 'producao_pessoas: le') then
    create policy "producao_pessoas: le" on public.producao_pessoas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_pessoa(organization_id, id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_pessoas'
                 and policyname = 'producao_pessoas: leitura sem assinatura') then
    create policy "producao_pessoas: leitura sem assinatura" on public.producao_pessoas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_pessoa(organization_id, id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_pessoas'
                 and policyname = 'producao_pessoas: insere') then
    create policy "producao_pessoas: insere" on public.producao_pessoas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_pessoas'
                 and policyname = 'producao_pessoas: edita') then
    create policy "producao_pessoas: edita" on public.producao_pessoas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_pessoa(organization_id, id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_pessoa(organization_id, id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_pessoas'
                 and policyname = 'producao_pessoas: apaga') then
    create policy "producao_pessoas: apaga" on public.producao_pessoas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
end
$$;

-- O vínculo segue a temporada ou o espaço dele (um dos dois, a tabela confere).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_vinculos'
                 and policyname = 'producao_vinculos: le') then
    create policy "producao_vinculos: le" on public.producao_vinculos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and ((temporada_id is not null and public.auth_producao_ve_temporada(organization_id, temporada_id))
               or (espaco_id is not null and public.auth_producao_ve_espaco(organization_id, espaco_id))));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_vinculos'
                 and policyname = 'producao_vinculos: leitura sem assinatura') then
    create policy "producao_vinculos: leitura sem assinatura" on public.producao_vinculos for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and ((temporada_id is not null and public.auth_producao_ve_temporada(organization_id, temporada_id))
               or (espaco_id is not null and public.auth_producao_ve_espaco(organization_id, espaco_id))));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_vinculos'
                 and policyname = 'producao_vinculos: insere') then
    create policy "producao_vinculos: insere" on public.producao_vinculos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and ((temporada_id is not null and public.auth_producao_ve_temporada(organization_id, temporada_id))
                    or (espaco_id is not null and public.auth_producao_ve_espaco(organization_id, espaco_id))));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_vinculos'
                 and policyname = 'producao_vinculos: edita') then
    create policy "producao_vinculos: edita" on public.producao_vinculos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and ((temporada_id is not null and public.auth_producao_ve_temporada(organization_id, temporada_id))
               or (espaco_id is not null and public.auth_producao_ve_espaco(organization_id, espaco_id))))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and ((temporada_id is not null and public.auth_producao_ve_temporada(organization_id, temporada_id))
                    or (espaco_id is not null and public.auth_producao_ve_espaco(organization_id, espaco_id))));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_vinculos'
                 and policyname = 'producao_vinculos: apaga') then
    create policy "producao_vinculos: apaga" on public.producao_vinculos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and ((temporada_id is not null and public.auth_producao_ve_temporada(organization_id, temporada_id))
               or (espaco_id is not null and public.auth_producao_ve_espaco(organization_id, espaco_id))));
  end if;
end
$$;

-- O dinheiro do vínculo: a regra de dinheiro da PD0.7a, e o vínculo à vista (a subconsulta passa
-- pelas regras de producao_vinculos, da pessoa que consulta).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_vinculos_valores'
                 and policyname = 'producao_vinculos_valores: le') then
    create policy "producao_vinculos_valores: le" on public.producao_vinculos_valores for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_vinculos v where v.id = producao_vinculos_valores.vinculo_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_vinculos_valores'
                 and policyname = 'producao_vinculos_valores: leitura sem assinatura') then
    create policy "producao_vinculos_valores: leitura sem assinatura" on public.producao_vinculos_valores for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_vinculos v where v.id = producao_vinculos_valores.vinculo_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_vinculos_valores'
                 and policyname = 'producao_vinculos_valores: insere') then
    create policy "producao_vinculos_valores: insere" on public.producao_vinculos_valores for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_vinculos v where v.id = producao_vinculos_valores.vinculo_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_vinculos_valores'
                 and policyname = 'producao_vinculos_valores: edita') then
    create policy "producao_vinculos_valores: edita" on public.producao_vinculos_valores for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_vinculos v where v.id = producao_vinculos_valores.vinculo_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_vinculos v where v.id = producao_vinculos_valores.vinculo_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_vinculos_valores'
                 and policyname = 'producao_vinculos_valores: apaga') then
    create policy "producao_vinculos_valores: apaga" on public.producao_vinculos_valores for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_vinculos v where v.id = producao_vinculos_valores.vinculo_id));
  end if;
end
$$;

-- A escala herda o recorte da data: a subconsulta passa pelas regras de producao_datas.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_escalas'
                 and policyname = 'producao_escalas: le') then
    create policy "producao_escalas: le" on public.producao_escalas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_datas d where d.id = producao_escalas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_escalas'
                 and policyname = 'producao_escalas: leitura sem assinatura') then
    create policy "producao_escalas: leitura sem assinatura" on public.producao_escalas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_datas d where d.id = producao_escalas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_escalas'
                 and policyname = 'producao_escalas: insere') then
    create policy "producao_escalas: insere" on public.producao_escalas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_datas d where d.id = producao_escalas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_escalas'
                 and policyname = 'producao_escalas: edita') then
    create policy "producao_escalas: edita" on public.producao_escalas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_datas d where d.id = producao_escalas.data_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_datas d where d.id = producao_escalas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_escalas'
                 and policyname = 'producao_escalas: apaga') then
    create policy "producao_escalas: apaga" on public.producao_escalas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_datas d where d.id = producao_escalas.data_id));
  end if;
end
$$;

-- ─── 6. Quem executa e quem acessa ──────────────────────────────────────────
-- Os gatilhos rodam sem que a pessoa precise de execute. A que as regras chamam
-- (auth_producao_ve_pessoa) é executada por quem está logado, como as outras auth_producao_*.
-- As três trocadas mantêm os privilégios que já tinham.

revoke execute on function public.fn_producao_pessoa_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_vinculo_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_vinculo_valor_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_escala_coerencia() from public, anon, authenticated;
revoke execute on function public.auth_producao_ve_pessoa(uuid, uuid) from public, anon;
grant execute on function public.auth_producao_ve_pessoa(uuid, uuid) to authenticated;

-- O visitante não toca nas tabelas; quem está logado só passa pelas regras.
revoke all on public.producao_pessoas, public.producao_vinculos, public.producao_vinculos_valores, public.producao_escalas
  from anon, authenticated;
grant select, insert, update, delete
  on public.producao_pessoas, public.producao_vinculos, public.producao_vinculos_valores, public.producao_escalas
  to authenticated;

comment on table public.producao_pessoas is
  'Quem trabalha na produção, com ou sem conta no Jards: nome, nome artístico, e-mail, telefone e tipo. Sem documento, banco nem saúde (esperam a política de dados pessoais). Arquivar, não apagar.';
comment on table public.producao_vinculos is
  'A pessoa numa temporada ou num espaço (um dos dois): função, grupo, período e situação. O vínculo não cancelado de quem tem o recorte por vínculo deixa ver a temporada ou o espaço.';
comment on table public.producao_vinculos_valores is
  'O cachê e a diária de um vínculo. Lê quem vê o dinheiro; escreve quem edita e vê o dinheiro. Sem histórico.';
comment on table public.producao_escalas is
  'A pessoa numa data: função no dia, chamada, saída e confirmação (pendente, confirmada, recusada). Uma por pessoa e data.';
comment on function public.auth_producao_ve_temporada(uuid, uuid) is
  'O recorte da pessoa deixa ver a temporada? Admin e organização inteira veem; com o recorte por vínculo, só a temporada de um vínculo não cancelado da própria pessoa (PD1.9).';
comment on function public.auth_producao_ve_espaco(uuid, uuid) is
  'O recorte da pessoa deixa ver o espaço? Admin e organização inteira veem; com o recorte por vínculo, só o espaço de um vínculo não cancelado da própria pessoa (PD1.9).';
comment on function public.auth_producao_ve_pessoa(uuid, uuid) is
  'O recorte da pessoa deixa ver esta pessoa da equipe? Quem não tem recorte vê; com o recorte por vínculo, só quem tem vínculo numa temporada ou num espaço que ela vê.';
