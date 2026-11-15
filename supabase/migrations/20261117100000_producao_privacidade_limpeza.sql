-- Privacidade da produção: a limpeza dos dados de quem se inscreve, agenda, é convidado ou é matriculado (política §2.4 e §8).
--
-- A política promete que esses dados são apagados ou tornados anônimos até 12 meses depois da data do evento. Esta função cumpre a promessa:
--  * voluntários (inscrição pelo link): nome, e-mail, telefone e disponibilidade, 12 meses depois do fim da temporada;
--  * agendamentos de visita: grupo, responsável, e-mail, telefone e observação, 12 meses depois do dia da visita;
--  * convidados (pedido de cortesia): nome, afiliação e quem pediu, 12 meses depois do dia da sessão;
--  * convites de presença: a observação, 12 meses depois do fim da temporada (as datas de chegada e saída são logística, e a pessoa é da equipe);
--  * matrículas da formação: nome, e-mail e telefone, 12 meses depois do fim da turma.
-- Os números ficam (quantas pessoas, quantos vieram, cota, vagas, certificado emitido): só o que identifica a pessoa sai. Como o histórico
-- guarda o nome em "antes" e "depois", o histórico dessas linhas também é apagado. É idempotente: a linha já limpa (nome "Removido") não entra de novo.
-- Sem `p_executar`, só conta o que seria limpo (para conferir antes). Só o service_role e o agendador executam.

create or replace function public.fn_producao_privacidade_limpar(p_meses integer default 12, p_executar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limite date;
  v_voluntarios uuid[];
  v_visitas uuid[];
  v_convidados uuid[];
  v_convites uuid[];
  v_matriculas uuid[];
begin
  if p_meses is null or p_meses < 1 then
    raise exception 'prazo_invalido' using errcode = 'check_violation';
  end if;
  v_limite := (current_date - make_interval(months => p_meses))::date;

  select coalesce(array_agg(v.id), '{}') into v_voluntarios
  from public.producao_voluntarios v
  join public.producao_temporadas t on t.id = v.temporada_id
  where coalesce(t.fim, t.inicio, v.created_at::date) < v_limite and v.nome <> 'Removido';

  select coalesce(array_agg(a.id), '{}') into v_visitas
  from public.producao_visitas_agendamentos a
  join public.producao_visitas_horarios h on h.id = a.horario_id
  where h.dia < v_limite and a.grupo <> 'Removido';

  select coalesce(array_agg(c.id), '{}') into v_convidados
  from public.producao_convidados c
  join public.producao_sessoes s on s.id = c.sessao_id
  where s.dia < v_limite and c.nome <> 'Removido';

  select coalesce(array_agg(c.id), '{}') into v_convites
  from public.producao_convites c
  join public.producao_temporadas t on t.id = c.temporada_id
  where coalesce(t.fim, t.inicio, c.created_at::date) < v_limite and c.observacao is not null;

  select coalesce(array_agg(m.id), '{}') into v_matriculas
  from public.producao_matriculas m
  join public.producao_turmas tu on tu.id = m.turma_id
  where coalesce(tu.fim, tu.inicio, m.created_at::date) < v_limite and m.nome <> 'Removido';

  if p_executar then
    -- O telefone "*****" só existe porque a tabela exige e-mail ou telefone: não é um número.
    update public.producao_voluntarios set nome = 'Removido', email = null, telefone = '*****', disponibilidade = null where id = any(v_voluntarios);
    update public.producao_visitas_agendamentos set grupo = 'Removido', responsavel = 'Removido', email = null, telefone = '*****', observacao = null where id = any(v_visitas);
    update public.producao_convidados set nome = 'Removido', afiliacao = null, solicitante = null where id = any(v_convidados);
    update public.producao_convites set observacao = null where id = any(v_convites);
    update public.producao_matriculas set nome = 'Removido', email = null, telefone = null where id = any(v_matriculas);

    -- O histórico guarda o nome (e, ao limpar acima, o nome de antes): sai o histórico dessas linhas, inclusive o que a limpeza acabou de gravar.
    delete from public.producao_historico
    where (entidade = 'producao_voluntarios' and entidade_id = any(v_voluntarios))
       or (entidade = 'producao_visitas_agendamentos' and entidade_id = any(v_visitas))
       or (entidade = 'producao_convidados' and entidade_id = any(v_convidados))
       or (entidade = 'producao_convites' and entidade_id = any(v_convites))
       or (entidade = 'producao_matriculas' and entidade_id = any(v_matriculas));
  end if;

  return jsonb_build_object(
    'executou', p_executar, 'meses', p_meses, 'limpar_antes_de', v_limite,
    'voluntarios', cardinality(v_voluntarios), 'visitas', cardinality(v_visitas), 'convidados', cardinality(v_convidados),
    'convites', cardinality(v_convites), 'matriculas', cardinality(v_matriculas)
  );
end;
$$;

revoke execute on function public.fn_producao_privacidade_limpar(integer, boolean) from public, anon, authenticated;
grant execute on function public.fn_producao_privacidade_limpar(integer, boolean) to service_role;

comment on function public.fn_producao_privacidade_limpar(integer, boolean) is
  'Anonimiza os dados de quem se inscreveu, agendou, foi convidado ou matriculado, depois de p_meses meses do evento. Sem p_executar, só conta.';

-- Todo dia, de madrugada (pg_cron roda como dono do banco).
select cron.schedule('jards-producao-privacidade', '40 3 * * *', $cron$select public.fn_producao_privacidade_limpar(12, true)$cron$);
