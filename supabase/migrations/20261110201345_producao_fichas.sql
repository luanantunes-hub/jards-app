-- PD3.1: ficha do espaço e ficha técnica da sala.
--
-- producao_espaco_fichas: o que se sabe do espaço como um todo (funcionamento, acessibilidade, carga e descarga, o
-- contato de quem cuida), uma por espaço. producao_sala_fichas: a ficha técnica estruturada da sala (palco, som, luz,
-- energia e camarins), uma por sala, com as medidas em número e a unidade no nome da coluna (m, kVA, V). É o que o
-- rider vai ser comparado (PD4.3) e o que o espaço preenche uma vez e usa em toda produção que chega.
--
-- Acesso: o do espaço (quem lê o espaço lê a ficha dele; quem edita e vê o espaço escreve), então o recorte "só onde
-- está vinculado" vale: quem cuida de um espaço vê e edita a ficha dele. Sem dinheiro. Sem histórico: o contato da
-- ficha é dado pessoal (telefone e e-mail), e o espaço já tem o dele.
-- Apagar: a ficha sai com o espaço, com a sala e com a organização.
--
-- Expansão: duas tabelas novas e vazias e duas funções de gatilho. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_espaco_fichas (
  espaco_id uuid primary key references public.producao_espacos (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  funcionamento text,
  acessibilidade text,
  carga_descarga text,
  doca_altura_m numeric(5, 2),
  veiculo_max_m numeric(5, 2),
  contato_nome text,
  contato_telefone text,
  contato_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_espaco_fichas_funcionamento_check check (funcionamento is null or char_length(funcionamento) <= 2000),
  constraint producao_espaco_fichas_acessibilidade_check check (acessibilidade is null or char_length(acessibilidade) <= 2000),
  constraint producao_espaco_fichas_carga_check check (carga_descarga is null or char_length(carga_descarga) <= 2000),
  constraint producao_espaco_fichas_doca_check check (doca_altura_m is null or doca_altura_m between 0 and 20),
  constraint producao_espaco_fichas_veiculo_check check (veiculo_max_m is null or veiculo_max_m between 0 and 40),
  constraint producao_espaco_fichas_contato_nome_check check (contato_nome is null or char_length(btrim(contato_nome)) between 1 and 200),
  constraint producao_espaco_fichas_contato_telefone_check check (contato_telefone is null or char_length(btrim(contato_telefone)) between 1 and 40),
  constraint producao_espaco_fichas_contato_email_check check (contato_email is null or (char_length(contato_email) <= 254 and contato_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'))
);

create index if not exists producao_espaco_fichas_org_idx on public.producao_espaco_fichas (organization_id);

create table if not exists public.producao_sala_fichas (
  sala_id uuid primary key references public.producao_salas (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  palco_boca_m numeric(6, 2),
  palco_profundidade_m numeric(6, 2),
  palco_altura_m numeric(6, 2),
  palco_piso text,
  som_sistema text,
  som_canais_entrada integer,
  luz_descricao text,
  luz_refletores integer,
  energia_kva numeric(8, 2),
  energia_tensao_v integer,
  energia_fases integer,
  camarins_quantidade integer,
  camarins_capacidade integer,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_sala_fichas_boca_check check (palco_boca_m is null or palco_boca_m between 0 and 200),
  constraint producao_sala_fichas_profundidade_check check (palco_profundidade_m is null or palco_profundidade_m between 0 and 200),
  constraint producao_sala_fichas_altura_check check (palco_altura_m is null or palco_altura_m between 0 and 100),
  constraint producao_sala_fichas_piso_check check (palco_piso is null or char_length(palco_piso) <= 200),
  constraint producao_sala_fichas_som_sistema_check check (som_sistema is null or char_length(som_sistema) <= 500),
  constraint producao_sala_fichas_som_canais_check check (som_canais_entrada is null or som_canais_entrada between 0 and 256),
  constraint producao_sala_fichas_luz_descricao_check check (luz_descricao is null or char_length(luz_descricao) <= 500),
  constraint producao_sala_fichas_luz_refletores_check check (luz_refletores is null or luz_refletores between 0 and 5000),
  constraint producao_sala_fichas_energia_kva_check check (energia_kva is null or energia_kva between 0 and 100000),
  constraint producao_sala_fichas_energia_tensao_check check (energia_tensao_v is null or energia_tensao_v between 100 and 1000),
  constraint producao_sala_fichas_energia_fases_check check (energia_fases is null or energia_fases between 1 and 3),
  constraint producao_sala_fichas_camarins_quantidade_check check (camarins_quantidade is null or camarins_quantidade between 0 and 100),
  constraint producao_sala_fichas_camarins_capacidade_check check (camarins_capacidade is null or camarins_capacidade between 0 and 1000),
  constraint producao_sala_fichas_notas_check check (notas is null or char_length(notas) <= 4000)
);

create index if not exists producao_sala_fichas_org_idx on public.producao_sala_fichas (organization_id);

-- Coerência da ficha do espaço: o espaço é da organização e não muda. Erros (check_violation): organizacao_nao_muda,
-- espaco_nao_muda, espaco_de_outra_organizacao.
create or replace function public.fn_producao_espaco_ficha_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.espaco_id is distinct from old.espaco_id then
    raise exception 'espaco_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_espacos e where e.id = new.espaco_id and e.organization_id = new.organization_id) then
    raise exception 'espaco_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência da ficha da sala: a sala é da organização e não muda. Erros: organizacao_nao_muda, sala_nao_muda,
-- sala_de_outra_organizacao.
create or replace function public.fn_producao_sala_ficha_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.sala_id is distinct from old.sala_id then
    raise exception 'sala_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new;
  end if;
  if not exists (select 1 from public.producao_salas s where s.id = new.sala_id and s.organization_id = new.organization_id) then
    raise exception 'sala_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_espaco_fichas_coerencia
  before insert or update of organization_id, espaco_id on public.producao_espaco_fichas
  for each row execute function public.fn_producao_espaco_ficha_coerencia();
create or replace trigger producao_espaco_fichas_updated_at
  before update on public.producao_espaco_fichas
  for each row execute function public.fn_producao_updated_at();

create or replace trigger producao_sala_fichas_coerencia
  before insert or update of organization_id, sala_id on public.producao_sala_fichas
  for each row execute function public.fn_producao_sala_ficha_coerencia();
create or replace trigger producao_sala_fichas_updated_at
  before update on public.producao_sala_fichas
  for each row execute function public.fn_producao_updated_at();

alter table public.producao_espaco_fichas enable row level security;
alter table public.producao_sala_fichas enable row level security;

-- A ficha do espaço herda o espaço à vista (a subconsulta passa pelas regras de producao_espacos, com o recorte).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_espaco_fichas' and policyname = 'producao_espaco_fichas: le') then
    create policy "producao_espaco_fichas: le" on public.producao_espaco_fichas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_espacos e where e.id = producao_espaco_fichas.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_espaco_fichas' and policyname = 'producao_espaco_fichas: leitura sem assinatura') then
    create policy "producao_espaco_fichas: leitura sem assinatura" on public.producao_espaco_fichas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_espacos e where e.id = producao_espaco_fichas.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_espaco_fichas' and policyname = 'producao_espaco_fichas: insere') then
    create policy "producao_espaco_fichas: insere" on public.producao_espaco_fichas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_espacos e where e.id = producao_espaco_fichas.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_espaco_fichas' and policyname = 'producao_espaco_fichas: edita') then
    create policy "producao_espaco_fichas: edita" on public.producao_espaco_fichas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_espacos e where e.id = producao_espaco_fichas.espaco_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_espacos e where e.id = producao_espaco_fichas.espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_espaco_fichas' and policyname = 'producao_espaco_fichas: apaga') then
    create policy "producao_espaco_fichas: apaga" on public.producao_espaco_fichas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_espacos e where e.id = producao_espaco_fichas.espaco_id));
  end if;
end
$$;

-- A ficha da sala herda a sala à vista (a subconsulta passa pelas regras de producao_salas, que trazem o recorte do espaço).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_sala_fichas' and policyname = 'producao_sala_fichas: le') then
    create policy "producao_sala_fichas: le" on public.producao_sala_fichas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_salas s where s.id = producao_sala_fichas.sala_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_sala_fichas' and policyname = 'producao_sala_fichas: leitura sem assinatura') then
    create policy "producao_sala_fichas: leitura sem assinatura" on public.producao_sala_fichas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_salas s where s.id = producao_sala_fichas.sala_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_sala_fichas' and policyname = 'producao_sala_fichas: insere') then
    create policy "producao_sala_fichas: insere" on public.producao_sala_fichas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_salas s where s.id = producao_sala_fichas.sala_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_sala_fichas' and policyname = 'producao_sala_fichas: edita') then
    create policy "producao_sala_fichas: edita" on public.producao_sala_fichas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_salas s where s.id = producao_sala_fichas.sala_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_salas s where s.id = producao_sala_fichas.sala_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_sala_fichas' and policyname = 'producao_sala_fichas: apaga') then
    create policy "producao_sala_fichas: apaga" on public.producao_sala_fichas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_salas s where s.id = producao_sala_fichas.sala_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_espaco_ficha_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_sala_ficha_coerencia() from public, anon, authenticated;
revoke all on public.producao_espaco_fichas, public.producao_sala_fichas from anon, authenticated;
grant select, insert, update, delete on public.producao_espaco_fichas, public.producao_sala_fichas to authenticated;

comment on table public.producao_espaco_fichas is
  'Ficha do espaço: funcionamento, acessibilidade, carga e descarga e o contato de quem cuida. Uma por espaço.';
comment on table public.producao_sala_fichas is
  'Ficha técnica da sala: palco, som, luz, energia e camarins, com as medidas em número (a unidade está no nome da coluna). Uma por sala.';
