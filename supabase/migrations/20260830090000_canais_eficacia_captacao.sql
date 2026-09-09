-- Canais de captação: separa origem, intenção e contatos efetivamente realizados.
-- Estratégia expand/contract: os campos legados permanecem disponíveis nesta versão.

alter table public.captacoes
  add column if not exists origem_oportunidade text,
  add column if not exists canal_planejado text;

alter table public.captacoes
  drop constraint if exists captacoes_origem_oportunidade_check,
  add constraint captacoes_origem_oportunidade_check check (
    origem_oportunidade is null or origem_oportunidade in (
      'prospeccao_ativa','indicacao','edital','evento','inbound','parceiro','base_propria','outro'
    )
  ),
  drop constraint if exists captacoes_canal_planejado_check,
  add constraint captacoes_canal_planejado_check check (
    canal_planejado is null or canal_planejado in (
      'email','telefone','linkedin','whatsapp','videoconferencia','presencial','outro'
    )
  );

-- O histórico antigo indica intenção/cadastro, não prova que o contato ocorreu.
update public.captacoes
set origem_oportunidade = 'indicacao'
where origem_oportunidade is null and meio_contato = 'indicacao';

update public.captacoes
set canal_planejado = case meio_contato
  when 'email' then 'email'
  when 'telefone' then 'telefone'
  when 'linkedin' then 'linkedin'
  when 'reuniao' then 'videoconferencia'
  when 'outro' then 'outro'
  else null
end
where canal_planejado is null;

create index if not exists captacoes_org_origem_idx
  on public.captacoes(organization_id, origem_oportunidade);
create index if not exists captacoes_org_canal_planejado_idx
  on public.captacoes(organization_id, canal_planejado);

alter table public.crm_interacoes
  add column if not exists atividade_id uuid references public.atividades(id) on delete set null,
  add column if not exists followup_id uuid references public.crm_followups(id) on delete set null,
  add column if not exists canal text,
  add column if not exists tipo_interacao text,
  add column if not exists direcao text not null default 'saida',
  add column if not exists duracao_minutos integer,
  add column if not exists resposta_em timestamptz;

update public.crm_interacoes set canal = tipo where canal is null;
update public.crm_interacoes
set tipo_interacao = case tipo
  when 'telefone' then 'ligacao'
  when 'reuniao' then 'reuniao'
  when 'evento' then 'reuniao'
  else 'mensagem'
end
where tipo_interacao is null;

alter table public.crm_interacoes
  drop constraint if exists crm_interacoes_canal_check,
  add constraint crm_interacoes_canal_check check (
    canal is null or canal in (
      'email','telefone','linkedin','whatsapp','videoconferencia','presencial','outro'
    )
  ),
  drop constraint if exists crm_interacoes_tipo_interacao_check,
  add constraint crm_interacoes_tipo_interacao_check check (
    tipo_interacao is null or tipo_interacao in (
      'tentativa','mensagem','ligacao','reuniao','apresentacao','followup','outro'
    )
  ),
  drop constraint if exists crm_interacoes_direcao_check,
  add constraint crm_interacoes_direcao_check check (direcao in ('entrada','saida')),
  drop constraint if exists crm_interacoes_duracao_check,
  add constraint crm_interacoes_duracao_check check (duracao_minutos is null or duracao_minutos >= 0);

-- Amplia os resultados sem invalidar os valores históricos já usados.
alter table public.crm_interacoes drop constraint if exists crm_interacoes_resultado_check;
alter table public.crm_interacoes add constraint crm_interacoes_resultado_check check (
  resultado is null or resultado in (
    'sem_resposta','respondeu','reuniao_agendada','proposta_solicitada',
    'avancou','adiado','recusou','convertido','outro'
  )
);

create index if not exists crm_interacoes_org_canal_data_idx
  on public.crm_interacoes(organization_id, canal, ocorreu_em desc);
create unique index if not exists crm_interacoes_atividade_unique_idx
  on public.crm_interacoes(atividade_id) where atividade_id is not null;
create unique index if not exists crm_interacoes_followup_unique_idx
  on public.crm_interacoes(followup_id) where followup_id is not null;

create or replace function public.fn_concluir_atividade_com_interacao(
  p_atividade_id uuid,
  p_registrar_interacao boolean default false,
  p_canal text default null,
  p_resultado text default null,
  p_resumo text default null,
  p_ocorreu_em timestamptz default now(),
  p_direcao text default 'saida'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atividade public.atividades%rowtype;
  v_interacao_id uuid;
begin
  select * into v_atividade from public.atividades where id = p_atividade_id for update;
  if v_atividade.id is null then raise exception 'Atividade não encontrada'; end if;
  if not (v_atividade.organization_id = any(array(select public.auth_org_ids()))) then
    raise exception 'Sem permissão para atualizar esta atividade' using errcode = '42501';
  end if;
  if p_registrar_interacao and (v_atividade.captacao_id is null or p_canal is null) then
    raise exception 'Negociação e canal são obrigatórios para registrar a interação';
  end if;

  update public.atividades
  set feita = true, data_realizada = p_ocorreu_em, resultado = coalesce(p_resultado, resultado), updated_at = now()
  where id = p_atividade_id;

  if p_registrar_interacao then
    insert into public.crm_interacoes (
      organization_id, account_id, empresa_crm_id, contato_id, captacao_id,
      atividade_id, tipo, canal, tipo_interacao, direcao, assunto, resumo,
      resultado, ocorreu_em, created_by
    ) values (
      v_atividade.organization_id, v_atividade.account_id, v_atividade.empresa_crm_id,
      v_atividade.contato_id, v_atividade.captacao_id, v_atividade.id,
      case p_canal when 'whatsapp' then 'mensagem' when 'videoconferencia' then 'reuniao' when 'presencial' then 'reuniao' else p_canal end,
      p_canal,
      case when p_canal = 'telefone' then 'ligacao' when p_canal in ('videoconferencia','presencial') then 'reuniao' else 'mensagem' end,
      p_direcao, v_atividade.nome, nullif(trim(p_resumo), ''), p_resultado,
      p_ocorreu_em, auth.uid()
    )
    on conflict (atividade_id) where atividade_id is not null do update set
      canal = excluded.canal, resultado = excluded.resultado, resumo = excluded.resumo,
      ocorreu_em = excluded.ocorreu_em, updated_at = now()
    returning id into v_interacao_id;
  end if;

  return jsonb_build_object('id', v_atividade.id, 'feita', true,
    'data_realizada', p_ocorreu_em, 'interacao_id', v_interacao_id);
end;
$$;

create or replace function public.fn_concluir_followup_com_interacao(
  p_followup_id uuid,
  p_canal text,
  p_resultado text,
  p_resumo text default null,
  p_ocorreu_em timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_followup public.crm_followups%rowtype;
  v_interacao_id uuid;
begin
  select * into v_followup from public.crm_followups where id = p_followup_id for update;
  if v_followup.id is null then raise exception 'Follow-up não encontrado'; end if;
  if not (v_followup.organization_id = any(array(select public.auth_org_ids()))) then
    raise exception 'Sem permissão para atualizar este follow-up' using errcode = '42501';
  end if;
  if v_followup.captacao_id is null then raise exception 'O follow-up precisa estar vinculado a uma negociação'; end if;

  update public.crm_followups
  set status = 'concluido', concluido_em = p_ocorreu_em, resultado = p_resultado, updated_at = now()
  where id = p_followup_id;

  insert into public.crm_interacoes (
    organization_id, account_id, empresa_crm_id, contato_id, captacao_id,
    followup_id, tipo, canal, tipo_interacao, direcao, assunto, resumo,
    resultado, ocorreu_em, created_by
  ) values (
    v_followup.organization_id, v_followup.account_id, v_followup.empresa_crm_id,
    v_followup.contato_id, v_followup.captacao_id, v_followup.id,
    case p_canal when 'whatsapp' then 'mensagem' when 'videoconferencia' then 'reuniao' when 'presencial' then 'reuniao' else p_canal end,
    p_canal, 'followup', 'saida', v_followup.titulo,
    coalesce(nullif(trim(p_resumo), ''), v_followup.motivo), p_resultado,
    p_ocorreu_em, auth.uid()
  )
  on conflict (followup_id) where followup_id is not null do update set
    canal = excluded.canal, resultado = excluded.resultado, resumo = excluded.resumo,
    ocorreu_em = excluded.ocorreu_em, updated_at = now()
  returning id into v_interacao_id;

  return jsonb_build_object('id', v_followup.id, 'status', 'concluido', 'interacao_id', v_interacao_id);
end;
$$;

revoke all on function public.fn_concluir_atividade_com_interacao(uuid,boolean,text,text,text,timestamptz,text) from public;
grant execute on function public.fn_concluir_atividade_com_interacao(uuid,boolean,text,text,text,timestamptz,text) to authenticated;
revoke all on function public.fn_concluir_followup_com_interacao(uuid,text,text,text,timestamptz) from public;
grant execute on function public.fn_concluir_followup_com_interacao(uuid,text,text,text,timestamptz) to authenticated;

-- Métrica simples e auditável; receita não é duplicada por cada interação.
create or replace view public.vw_eficacia_canais
with (security_invoker = true)
as
select
  i.organization_id,
  date_trunc('month', i.ocorreu_em) as mes,
  coalesce(i.canal, i.tipo) as canal,
  count(*) as interacoes,
  count(*) filter (where i.resultado in ('respondeu','reuniao_agendada','proposta_solicitada','avancou','convertido')) as respostas,
  count(*) filter (where i.resultado = 'reuniao_agendada') as reunioes_agendadas,
  count(*) filter (where i.resultado = 'proposta_solicitada') as propostas_solicitadas,
  count(distinct i.captacao_id) as negociacoes,
  count(distinct i.captacao_id) filter (where c.status = 'aprovado') as negociacoes_aprovadas
from public.crm_interacoes i
left join public.captacoes c on c.id = i.captacao_id
group by i.organization_id, date_trunc('month', i.ocorreu_em), coalesce(i.canal, i.tipo);

grant select on public.vw_eficacia_canais to authenticated;
