-- P2.7: verificações do motor de checagens.
--
-- O motor (lib/prestacao/checagens) roda no servidor, na rota
-- /api/prestacoes/[id]/verificar, e grava os achados aqui por
-- fn_prestacao_verificacoes_sincronizar, que só o service role chama: quem
-- usa o app não escreve achado nem apaga pendência. A chave liga um achado
-- à verificação seguinte:
--   * achado novo entra aberto (ou justificado, se a própria despesa já traz
--     a justificativa escrita);
--   * achado que sumiu se resolve sozinho (resolvida, sem autor);
--   * achado que volta reabre, salvo quando uma pessoa o dispensou ou o
--     justificou: a decisão fica com ele.
-- Justificar, dispensar e reabrir passam por fn_prestacao_verificacao_decidir,
-- com o papel conferido: justificar e reabrir pedem o papel de editar;
-- dispensar, o de avaliar (revisor, responsável ou admin). Bloqueio não se
-- justifica, só se resolve ou se dispensa. Justificar e dispensar pedem texto.
--
-- prestacoes_contas.verificada_em guarda a última verificação; só a função a
-- grava.
-- Idempotente; sem DROP.

create table if not exists public.prestacao_verificacoes (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  chave text not null,
  check_codigo text not null,
  severidade text not null check (severidade in ('bloqueio', 'alerta', 'justificativa', 'info')),
  resultado text not null check (resultado in ('nao_conforme', 'revisar', 'nao_calculavel')),
  entidade_tipo text not null check (entidade_tipo in ('prestacao', 'despesa', 'pagamento', 'lancamento')),
  entidade_id uuid,
  mensagem text not null,
  fonte jsonb,
  dados jsonb not null default '{}'::jsonb,
  status text not null default 'aberta' check (status in ('aberta', 'justificada', 'dispensada', 'resolvida')),
  justificativa text,
  resolvida_por uuid references auth.users(id) on delete set null,
  resolvida_em timestamptz,
  detectada_em timestamptz not null default now(),
  visto_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists prestacao_verificacoes_chave_key on public.prestacao_verificacoes (prestacao_id, chave);
create index if not exists prestacao_verificacoes_status_idx on public.prestacao_verificacoes (prestacao_id, status, severidade);
create index if not exists prestacao_verificacoes_entidade_idx
  on public.prestacao_verificacoes (entidade_id) where entidade_id is not null;

alter table public.prestacoes_contas add column if not exists verificada_em timestamptz;

-- verificada_em só muda pela função de sincronizar.
create or replace function public.fn_prestacao_verificada_em_protegida()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon') and new.verificada_em is distinct from old.verificada_em then
    raise exception 'A verificação é gravada pelo servidor' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_prestacao_verificada_em_protegida'
                 and tgrelid = 'public.prestacoes_contas'::regclass) then
    create trigger trg_prestacao_verificada_em_protegida
      before update of verificada_em on public.prestacoes_contas
      for each row execute function public.fn_prestacao_verificada_em_protegida();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_verificacoes_updated_at'
                 and tgrelid = 'public.prestacao_verificacoes'::regclass) then
    create trigger prestacao_verificacoes_updated_at
      before update on public.prestacao_verificacoes
      for each row execute function public.set_prestacao_updated_at();
  end if;
end
$$;

-- ─── Acesso: lê quem acessa a prestação; ninguém escreve direto ─────────────

alter table public.prestacao_verificacoes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_verificacoes'
                 and policyname = 'prestacao_verificacoes: leitura pela prestacao') then
    create policy "prestacao_verificacoes: leitura pela prestacao" on public.prestacao_verificacoes
      for select to authenticated
      using (public.can_access_prestacao(prestacao_id));
  end if;
end
$$;

revoke all on public.prestacao_verificacoes from anon, authenticated;
grant select on public.prestacao_verificacoes to authenticated;

-- ─── Sincronizar (só o servidor) ────────────────────────────────────────────

-- p_achados: [{chave, codigo, severidade, resultado, entidade_tipo,
-- entidade_id, mensagem, fonte, dados, justificativa}], como sai de
-- executarChecagens. Devolve as contagens depois da sincronização.
create or replace function public.fn_prestacao_verificacoes_sincronizar(p_prestacao_id uuid, p_achados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  agora timestamptz := now();
begin
  if not exists (select 1 from public.prestacoes_contas where id = p_prestacao_id) then
    raise exception 'prestacao_inexistente' using errcode = 'no_data_found';
  end if;
  if jsonb_typeof(coalesce(p_achados, 'null'::jsonb)) <> 'array' then
    raise exception 'achados_invalidos' using errcode = 'invalid_parameter_value';
  end if;

  with entrada as (
    select distinct on (a->>'chave')
           a->>'chave' as chave,
           a->>'codigo' as codigo,
           a->>'severidade' as severidade,
           a->>'resultado' as resultado,
           a->>'entidade_tipo' as entidade_tipo,
           nullif(a->>'entidade_id', '')::uuid as entidade_id,
           coalesce(a->>'mensagem', '') as mensagem,
           case when jsonb_typeof(a->'fonte') = 'object' then a->'fonte' end as fonte,
           case when jsonb_typeof(a->'dados') = 'object' then a->'dados' else '{}'::jsonb end as dados,
           nullif(btrim(coalesce(a->>'justificativa', '')), '') as justificativa
      from jsonb_array_elements(p_achados) a
     where coalesce(a->>'chave', '') <> ''
     order by a->>'chave'
  )
  insert into public.prestacao_verificacoes as v
    (prestacao_id, chave, check_codigo, severidade, resultado, entidade_tipo, entidade_id,
     mensagem, fonte, dados, status, justificativa, resolvida_em, detectada_em, visto_em)
  select p_prestacao_id, e.chave, e.codigo, e.severidade, e.resultado, e.entidade_tipo, e.entidade_id,
         e.mensagem, e.fonte, e.dados,
         case when e.justificativa is not null and e.severidade <> 'bloqueio' then 'justificada' else 'aberta' end,
         case when e.severidade <> 'bloqueio' then e.justificativa end,
         case when e.justificativa is not null and e.severidade <> 'bloqueio' then agora end,
         agora, agora
    from entrada e
  on conflict (prestacao_id, chave) do update set
    check_codigo = excluded.check_codigo,
    severidade = excluded.severidade,
    resultado = excluded.resultado,
    entidade_tipo = excluded.entidade_tipo,
    entidade_id = excluded.entidade_id,
    mensagem = excluded.mensagem,
    fonte = excluded.fonte,
    dados = excluded.dados,
    visto_em = agora,
    -- A decisão de uma pessoa fica: dispensa sempre; justificativa, enquanto não for bloqueio.
    status = case
      when v.status = 'dispensada'
        or (v.status = 'justificada' and v.resolvida_por is not null and excluded.severidade <> 'bloqueio')
        then v.status
      else excluded.status end,
    justificativa = case
      when v.status = 'dispensada'
        or (v.status = 'justificada' and v.resolvida_por is not null and excluded.severidade <> 'bloqueio')
        then v.justificativa
      else excluded.justificativa end,
    resolvida_por = case
      when v.status = 'dispensada'
        or (v.status = 'justificada' and v.resolvida_por is not null and excluded.severidade <> 'bloqueio')
        then v.resolvida_por
      end,
    resolvida_em = case
      when v.status = 'dispensada'
        or (v.status = 'justificada' and v.resolvida_por is not null and excluded.severidade <> 'bloqueio')
        then v.resolvida_em
      when excluded.status = 'justificada' then coalesce(case when v.status = 'justificada' then v.resolvida_em end, agora)
      end,
    -- Achado que volta depois de resolvido conta como novo.
    detectada_em = case when v.status = 'resolvida' then agora else v.detectada_em end;

  -- O que não apareceu nesta verificação se resolveu.
  update public.prestacao_verificacoes v
     set status = 'resolvida', resolvida_em = agora, resolvida_por = null
   where v.prestacao_id = p_prestacao_id
     and v.status in ('aberta', 'justificada')
     and not exists (select 1 from jsonb_array_elements(p_achados) a where a->>'chave' = v.chave);

  update public.prestacoes_contas set verificada_em = agora where id = p_prestacao_id;

  return (
    select jsonb_build_object(
      'abertas', count(*) filter (where status = 'aberta' and severidade <> 'info'),
      'bloqueios', count(*) filter (where status = 'aberta' and severidade = 'bloqueio'),
      'avisos', count(*) filter (where status = 'aberta' and severidade = 'info'),
      'justificadas', count(*) filter (where status = 'justificada'),
      'dispensadas', count(*) filter (where status = 'dispensada'),
      'resolvidas', count(*) filter (where status = 'resolvida'),
      'verificada_em', agora)
      from public.prestacao_verificacoes
     where prestacao_id = p_prestacao_id
  );
end;
$$;

revoke all on function public.fn_prestacao_verificacoes_sincronizar(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.fn_prestacao_verificacoes_sincronizar(uuid, jsonb) to service_role;

-- ─── Decidir (quem usa o app) ───────────────────────────────────────────────

create or replace function public.fn_prestacao_verificacao_decidir(p_verificacao_id uuid, p_status text, p_justificativa text default null)
returns public.prestacao_verificacoes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.prestacao_verificacoes;
  texto text := nullif(btrim(coalesce(p_justificativa, '')), '');
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = 'insufficient_privilege';
  end if;
  select * into v from public.prestacao_verificacoes
   where id = p_verificacao_id and public.can_access_prestacao(prestacao_id)
   for update;
  if not found then
    raise exception 'verificacao_inexistente' using errcode = 'no_data_found';
  end if;
  if p_status is null or p_status not in ('justificada', 'dispensada', 'aberta') then
    raise exception 'status_invalido' using errcode = 'check_violation';
  end if;
  if not public.auth_prestacao_pode(v.prestacao_id, case when p_status = 'dispensada' then 'avaliar' else 'editar' end) then
    raise exception 'sem_permissao' using errcode = 'insufficient_privilege';
  end if;
  if v.status = 'resolvida' then
    raise exception 'verificacao_resolvida' using errcode = 'check_violation';
  end if;
  if p_status = 'justificada' and v.severidade = 'bloqueio' then
    raise exception 'bloqueio_nao_se_justifica' using errcode = 'check_violation';
  end if;
  if p_status in ('justificada', 'dispensada') and (texto is null or char_length(texto) < 5) then
    raise exception 'justificativa_obrigatoria' using errcode = 'check_violation';
  end if;

  update public.prestacao_verificacoes
     set status = p_status,
         justificativa = case when p_status = 'aberta' then null else texto end,
         resolvida_por = case when p_status = 'aberta' then null else auth.uid() end,
         resolvida_em = case when p_status = 'aberta' then null else now() end
   where id = v.id
  returning * into v;
  return v;
end;
$$;

revoke all on function public.fn_prestacao_verificacao_decidir(uuid, text, text) from public, anon;
grant execute on function public.fn_prestacao_verificacao_decidir(uuid, text, text) to authenticated, service_role;
