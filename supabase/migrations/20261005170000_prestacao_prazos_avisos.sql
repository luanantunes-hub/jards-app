-- P1.8: o prazo de envio da prestação vira atividade e avisos.
--
-- Cada prestação em preparação (rascunho ou revisão interna) com prazo tem
-- uma atividade "Enviar a prestação de contas", com responsável. A atividade
-- aparece em Lista, Calendário e Gantt e já recebe os avisos de 7, 3, 1 e 0
-- dias e de atraso da rotina das atividades (fn_dispatch_deadline_notifications).
-- A rotina jards-prestacao-prazos soma os avisos de 30 e 15 dias e, quando a
-- atividade não existe (por exemplo, recusada pelo limite do plano gratuito),
-- manda também os demais. Enviada a prestação, a atividade é concluída.
-- Idempotente; sem DROP.

alter table public.atividades
  add column if not exists prestacao_id uuid references public.prestacoes_contas(id) on delete cascade;

create index if not exists atividades_prestacao_idx
  on public.atividades (prestacao_id) where prestacao_id is not null;

-- ─── Responsável ────────────────────────────────────────────────────────────
-- Quem tem a função de responsável na prestação; senão quem criou; senão um
-- administrador. Sempre alguém com o módulo e papel de edição.

create or replace function public.prestacao_responsavel(p_prestacao_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select membro.user_id
  from public.prestacoes_contas p
  join public.organizations organizacao on organizacao.id = p.organization_id
  join public.organization_members membro on membro.organization_id = p.organization_id
  where p.id = p_prestacao_id
    and 'prestacao' = any(organizacao.modulos_ativos)
    and 'prestacao' = any(membro.modulos_acesso)
    and membro.papel in ('admin', 'colaborador', 'visualizador')
  order by (membro.prestacao_funcao = 'responsavel') desc nulls last,
           (membro.user_id = p.criado_por) desc,
           (membro.papel = 'admin') desc,
           membro.created_at
  limit 1;
$$;
revoke execute on function public.prestacao_responsavel(uuid) from public, anon, authenticated;

-- ─── Atividade do prazo de envio ────────────────────────────────────────────

create or replace function public.fn_prestacao_sincronizar_atividade(p_prestacao_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.prestacoes_contas%rowtype;
  atividade public.atividades%rowtype;
  responsavel uuid;
  em_preparo boolean;
  nome_atividade text;
begin
  select * into p from public.prestacoes_contas where id = p_prestacao_id;
  if not found then return; end if;

  em_preparo := p.status in ('rascunho', 'revisao_interna');
  nome_atividade := left('Enviar a prestação de contas: ' || p.titulo, 200);

  select * into atividade from public.atividades
  where prestacao_id = p.id and regra_origem = 'prestacao_prazo_envio'
  order by created_at
  limit 1;

  if atividade.id is null then
    if not em_preparo or p.prazo is null then return; end if;
    responsavel := coalesce(public.prestacao_responsavel(p.id), p.criado_por);
    if responsavel is null then return; end if;
    begin
      insert into public.atividades
        (account_id, organization_id, prestacao_id, projeto_id, captacao_id, proponente_id,
         nome, tipo, prioridade, data_prevista, responsavel_id, origem_automatica, regra_origem)
      values
        (coalesce(p.criado_por, responsavel), p.organization_id, p.id, p.projeto_id, p.captacao_id, p.proponente_id,
         nome_atividade, 'outro', 'alta', p.prazo::timestamp at time zone 'UTC', responsavel, true, 'prestacao_prazo_envio');
    exception when others then
      -- Limite do plano gratuito ou outra recusa: a prestação segue salva e a
      -- rotina diária avisa direto.
      raise warning 'Atividade do prazo da prestação % não criada: %', p.id, sqlerrm;
    end;
    return;
  end if;

  -- Atividade concluída fica como está (diligências terão atividade própria).
  if coalesce(atividade.feita, false) then return; end if;

  if not em_preparo then
    update public.atividades set feita = true, data_realizada = now() where id = atividade.id;
  elsif p.prazo is not null
        and (atividade.nome is distinct from nome_atividade
             or atividade.data_prevista is distinct from (p.prazo::timestamp at time zone 'UTC')) then
    update public.atividades
    set nome = nome_atividade, data_prevista = p.prazo::timestamp at time zone 'UTC'
    where id = atividade.id;
  end if;
end;
$$;
revoke execute on function public.fn_prestacao_sincronizar_atividade(uuid) from public, anon, authenticated;

create or replace function public.fn_prestacao_atividade_gatilho()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_prestacao_sincronizar_atividade(new.id);
  return null;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_prestacao_atividade_insert'
                 and tgrelid = 'public.prestacoes_contas'::regclass) then
    create trigger trg_prestacao_atividade_insert
      after insert on public.prestacoes_contas
      for each row execute function public.fn_prestacao_atividade_gatilho();
  end if;
  -- O prazo pode mudar pelo gatilho de cálculo (P1.2) sem estar no SET do
  -- update; por isso a condição compara os valores, não as colunas.
  if not exists (select 1 from pg_trigger where tgname = 'trg_prestacao_atividade_update'
                 and tgrelid = 'public.prestacoes_contas'::regclass) then
    create trigger trg_prestacao_atividade_update
      after update on public.prestacoes_contas
      for each row
      when (old.prazo is distinct from new.prazo
            or old.status is distinct from new.status
            or old.titulo is distinct from new.titulo)
      execute function public.fn_prestacao_atividade_gatilho();
  end if;
end
$$;

-- ─── Rotina diária ──────────────────────────────────────────────────────────

create or replace function public.fn_prestacao_prazos_diaria()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r record;
  dias integer;
  evento uuid;
  avisos integer := 0;
begin
  -- Refaz as atividades (cria as que faltaram, conclui as enviadas).
  perform public.fn_prestacao_sincronizar_atividade(p.id)
  from public.prestacoes_contas p
  where (p.status in ('rascunho', 'revisao_interna') and p.prazo is not null)
     or exists (select 1 from public.atividades a
                where a.prestacao_id = p.id and a.regra_origem = 'prestacao_prazo_envio'
                  and coalesce(a.feita, false) = false);

  for r in
    select p.id, p.organization_id, p.titulo, p.prazo,
      coalesce(atividade.responsavel_id, public.prestacao_responsavel(p.id), p.criado_por) as destinatario,
      atividade.id is not null as tem_atividade
    from public.prestacoes_contas p
    left join lateral (
      select a.id, a.responsavel_id from public.atividades a
      where a.prestacao_id = p.id and a.regra_origem = 'prestacao_prazo_envio'
        and coalesce(a.feita, false) = false and a.responsavel_id is not null
        and a.data_prevista::date = p.prazo
      limit 1
    ) atividade on true
    where p.status in ('rascunho', 'revisao_interna')
      and p.prazo is not null
      and p.prazo - hoje in (30, 15, 7, 3, 1, 0, -1, -3, -7)
  loop
    dias := r.prazo - hoje;
    -- De 7 dias em diante, a atividade já avisa.
    continue when r.tem_atividade and dias not in (30, 15);
    continue when r.destinatario is null;
    evento := public.fn_emit_notification(
      'prestacao_prazo', r.organization_id, r.destinatario,
      case when dias < 0 then 'Prestação de contas atrasada'
           when dias = 0 then 'Prestação de contas vence hoje'
           else 'Prazo da prestação de contas' end,
      '“' || r.titulo || '” ' ||
        case when dias < 0 then 'venceu há ' || abs(dias) || ' dia(s), em ' || to_char(r.prazo, 'DD/MM/YYYY') || '.'
             when dias = 0 then 'vence hoje.'
             else 'vence em ' || dias || ' dias, em ' || to_char(r.prazo, 'DD/MM/YYYY') || '.' end,
      '/prestacoes/' || r.id, 'prestacao',
      case when dias <= 1 then 'critica' when dias <= 7 then 'alta' else 'normal' end,
      'prestacao', r.id, null,
      'prestacao_prazo:' || r.id || ':' || r.prazo || ':' || dias || ':' || r.destinatario,
      jsonb_build_object('days_remaining', dias, 'prazo', r.prazo), null);
    -- Repetido no mesmo dia volta null (dedupe) e não conta.
    if evento is not null then avisos := avisos + 1; end if;
  end loop;

  return avisos;
end;
$$;
revoke execute on function public.fn_prestacao_prazos_diaria() from public, anon, authenticated;

-- 08h20 em Brasília, depois da rotina das atividades.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('jards-prestacao-prazos', '20 11 * * *', 'select public.fn_prestacao_prazos_diaria();');
  end if;
end
$$;

-- Prestações que já existem ganham a atividade.
select public.fn_prestacao_sincronizar_atividade(id) from public.prestacoes_contas;
