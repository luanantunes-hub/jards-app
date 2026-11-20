-- Concluir uma atividade registrando o contato: vale o vínculo de quem foi contatado
-- (negociação, empresa, proponente ou conta), a mesma regra dos follow-ups
-- (fn_concluir_followup_com_interacao_v2). Antes só a negociação servia, e uma atividade
-- ligada só à empresa não conseguia registrar o contato. A interação passa a guardar
-- também o proponente e a conta da atividade.
--
-- A assinatura não muda: uma sobrecarga nova duplicaria o RPC no PostgREST (PGRST203).

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
  if p_registrar_interacao then
    if num_nonnulls(v_atividade.captacao_id, v_atividade.empresa_crm_id, v_atividade.proponente_id, v_atividade.conta_patrocinio_id) = 0 then
      raise exception 'Vincule a atividade a uma empresa ou negociação para registrar o contato';
    end if;
    if p_canal is null then
      raise exception 'Informe o canal para registrar o contato';
    end if;
  end if;

  update public.atividades
  set feita = true, data_realizada = p_ocorreu_em, resultado = coalesce(p_resultado, resultado), updated_at = now()
  where id = p_atividade_id;

  if p_registrar_interacao then
    insert into public.crm_interacoes (
      organization_id, account_id, empresa_crm_id, proponente_id, contato_id, captacao_id,
      conta_patrocinio_id, atividade_id, tipo, canal, tipo_interacao, direcao, assunto, resumo,
      resultado, ocorreu_em, created_by
    ) values (
      v_atividade.organization_id, v_atividade.account_id, v_atividade.empresa_crm_id,
      v_atividade.proponente_id, v_atividade.contato_id, v_atividade.captacao_id,
      v_atividade.conta_patrocinio_id, v_atividade.id,
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

revoke all on function public.fn_concluir_atividade_com_interacao(uuid,boolean,text,text,text,timestamptz,text) from public;
grant execute on function public.fn_concluir_atividade_com_interacao(uuid,boolean,text,text,text,timestamptz,text) to authenticated;
