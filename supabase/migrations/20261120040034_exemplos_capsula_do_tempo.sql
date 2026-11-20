-- Dados de exemplo para contas novas: uma "cápsula do tempo" com marcas, produtoras e filmes que já saíram de cena,
-- todos com imagem em domínio público (Wikimedia Commons), hospedada em public/exemplos.
-- A marca `exemplo` é interna (a tela não mostra): os exemplos não ocupam as vagas do plano gratuito
-- e não disparam o aviso de "nova atividade para você".

alter table public.empresas_crm   add column if not exists exemplo boolean not null default false;
alter table public.contatos       add column if not exists exemplo boolean not null default false;
alter table public.proponentes    add column if not exists exemplo boolean not null default false;
alter table public.projetos_crm   add column if not exists exemplo boolean not null default false;
alter table public.captacoes      add column if not exists exemplo boolean not null default false;
alter table public.atividades     add column if not exists exemplo boolean not null default false;
alter table public.crm_interacoes add column if not exists exemplo boolean not null default false;

create or replace function public.enforce_free_plan_entity_limit()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_organization_id uuid;
  v_account_id uuid;
  v_count integer;
  v_limit integer;
  v_label text;
  v_new_counts boolean := true;
  v_old_counts boolean := false;
begin
  -- Exemplos não ocupam vaga do plano gratuito.
  if coalesce((to_jsonb(new)->>'exemplo')::boolean, false) then
    return new;
  end if;

  v_organization_id := nullif(to_jsonb(new)->>'organization_id', '')::uuid;
  v_account_id := nullif(to_jsonb(new)->>'account_id', '')::uuid;

  if v_organization_id is null then
    select member.organization_id
      into v_organization_id
    from public.organization_members member
    where member.user_id = coalesce(v_account_id, auth.uid())
    order by member.created_at
    limit 1;
  end if;

  -- Registros legados sem organizacao continuam sendo tratados pelas regras
  -- de acesso existentes; novos fluxos sempre enviam organization_id.
  if v_organization_id is null or not public.organization_uses_free_plan(v_organization_id) then
    return new;
  end if;

  case tg_table_name
    when 'projetos_crm' then
      v_limit := 1;
      v_label := '1 projeto ativo';
      v_new_counts := coalesce(to_jsonb(new)->>'status_operacional', 'ativo') <> 'arquivado';
      if tg_op = 'UPDATE' then
        v_old_counts := coalesce(to_jsonb(old)->>'status_operacional', 'ativo') <> 'arquivado';
      end if;
    when 'atividades' then
      v_limit := 5;
      v_label := '5 atividades em aberto';
      v_new_counts := coalesce((to_jsonb(new)->>'feita')::boolean, false) = false;
      if tg_op = 'UPDATE' then
        v_old_counts := coalesce((to_jsonb(old)->>'feita')::boolean, false) = false;
      end if;
    when 'editais_user' then
      v_limit := 5;
      v_label := '5 inscricoes em andamento';
      v_new_counts := coalesce(to_jsonb(new)->>'status', 'interesse') in ('interesse', 'inscrito', 'em_analise');
      if tg_op = 'UPDATE' then
        v_old_counts := coalesce(to_jsonb(old)->>'status', 'interesse') in ('interesse', 'inscrito', 'em_analise');
      end if;
    when 'captadores' then
      v_limit := 1;
      v_label := '1 captador ativo';
      v_new_counts := coalesce((to_jsonb(new)->>'ativo')::boolean, true);
      if tg_op = 'UPDATE' then
        v_old_counts := coalesce((to_jsonb(old)->>'ativo')::boolean, true);
      end if;
    when 'proponentes' then
      v_limit := 1;
      v_label := '1 proponente';
      v_new_counts := true;
      v_old_counts := tg_op = 'UPDATE';
    when 'contas_patrocinio' then
      v_limit := 5;
      v_label := '5 clientes ativos';
      v_new_counts := coalesce(to_jsonb(new)->>'status', 'ativa') <> 'encerrada';
      if tg_op = 'UPDATE' then
        v_old_counts := coalesce(to_jsonb(old)->>'status', 'ativa') <> 'encerrada';
      end if;
    else
      return new;
  end case;

  -- Mover um registro de outra organizacao para este workspace deve ocupar
  -- uma nova vaga, mesmo que ele ja estivesse ativo na origem.
  if tg_op = 'UPDATE'
     and nullif(to_jsonb(old)->>'organization_id', '')::uuid is distinct from v_organization_id then
    v_old_counts := false;
  end if;

  -- Atualizar um registro que ja ocupava uma vaga nao consome uma nova vaga.
  if not v_new_counts or v_old_counts then
    return new;
  end if;

  -- Serializa criacoes concorrentes da mesma entidade no mesmo workspace.
  perform pg_advisory_xact_lock(
    hashtextextended(v_organization_id::text || ':' || tg_table_name, 0)
  );

  case tg_table_name
    when 'projetos_crm' then
      select count(*) into v_count
      from public.projetos_crm
      where organization_id = v_organization_id
        and not exemplo
        and coalesce(status_operacional, 'ativo') <> 'arquivado';
    when 'atividades' then
      select count(*) into v_count
      from public.atividades
      where organization_id = v_organization_id
        and not exemplo
        and coalesce(feita, false) = false;
    when 'editais_user' then
      select count(*) into v_count
      from public.editais_user
      where organization_id = v_organization_id
        and coalesce(status, 'interesse') in ('interesse', 'inscrito', 'em_analise');
    when 'captadores' then
      select count(*) into v_count
      from public.captadores
      where organization_id = v_organization_id
        and coalesce(ativo, true);
    when 'proponentes' then
      select count(*) into v_count
      from public.proponentes
      where organization_id = v_organization_id
        and not exemplo;
    when 'contas_patrocinio' then
      select count(*) into v_count
      from public.contas_patrocinio
      where organization_id = v_organization_id
        and coalesce(status, 'ativa') <> 'encerrada';
  end case;

  if v_count >= v_limit then
    raise exception 'Limite do plano gratuito atingido: %.', v_label
      using
        errcode = 'P0001',
        detail = format('FREE_PLAN_LIMIT:%s:%s', tg_table_name, v_limit),
        hint = 'Arquive ou conclua um item existente, ou altere o plano para continuar.';
  end if;

  return new;
end;
$function$;

create or replace function public.fn_notify_activity_assignment()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.responsavel_id is not null
     and not coalesce(new.exemplo, false)
     and coalesce(new.sync_origin, '') not in ('google', 'microsoft')
     and (tg_op = 'INSERT' or new.responsavel_id is distinct from old.responsavel_id)
     and new.responsavel_id is distinct from auth.uid() then
    perform public.fn_emit_notification(
      'atividade_atribuida', new.organization_id, new.responsavel_id,
      'Nova atividade para você', new.nome,
      '/atividades?atividade=' || new.id, 'atividades', 'alta',
      'atividade', new.id, auth.uid(),
      'atividade_atribuida:' || new.id || ':' || new.responsavel_id,
      jsonb_build_object('data_prevista', new.data_prevista), new.account_id
    );
  end if;
  return new;
end;
$function$;

-- Semeia a cápsula do tempo numa organização. Idempotente: se já houver exemplos, não faz nada.
create or replace function public.fn_semear_exemplos(p_org uuid, p_user uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  e_varig uuid; e_vasp uuid; e_transbrasil uuid; e_cruzeiro uuid; e_mappin uuid;
  e_mesbla uuid; e_nacional uuid; e_real uuid; e_unibanco uuid; e_bamerindus uuid;
  p_atlantida uuid; p_tupi uuid; p_manchete uuid;
  j_aviso uuid; j_alo uuid; j_banana uuid; j_tico uuid; j_cangaceiro uuid; j_pagador uuid;
  c_varig uuid; c_nacional uuid; c_mappin uuid; c_vasp uuid; c_mesbla uuid; c_bamerindus uuid;
  n_aviso uuid; n_pagador uuid; n_tico uuid; n_cangaceiro uuid; n_banana uuid; n_alo uuid;
begin
  if p_org is null or p_user is null then
    return 0;
  end if;
  if exists (select 1 from public.projetos_crm where organization_id = p_org and exemplo) then
    return 0;
  end if;

  -- Patrocinadores (logos em components/CompanyLogo.tsx, pelo domínio)
  insert into public.empresas_crm (account_id, organization_id, nome, setor, domain_key, cidade, estado, tipo, ja_patrocina_cultura, exemplo)
    values (p_user, p_org, 'Varig', 'Aviação', 'varig.com.br', 'Porto Alegre', 'RS', 'prospect', true, true) returning id into e_varig;
  insert into public.empresas_crm (account_id, organization_id, nome, setor, domain_key, cidade, estado, tipo, ja_patrocina_cultura, exemplo)
    values (p_user, p_org, 'VASP', 'Aviação', 'vasp.com.br', 'São Paulo', 'SP', 'prospect', false, true) returning id into e_vasp;
  insert into public.empresas_crm (account_id, organization_id, nome, setor, domain_key, cidade, estado, tipo, ja_patrocina_cultura, exemplo)
    values (p_user, p_org, 'Transbrasil', 'Aviação', 'transbrasil.com.br', 'São Paulo', 'SP', 'prospect', false, true) returning id into e_transbrasil;
  insert into public.empresas_crm (account_id, organization_id, nome, setor, domain_key, cidade, estado, tipo, ja_patrocina_cultura, exemplo)
    values (p_user, p_org, 'Cruzeiro do Sul', 'Aviação', 'cruzeirodosul.aero', 'Rio de Janeiro', 'RJ', 'prospect', false, true) returning id into e_cruzeiro;
  insert into public.empresas_crm (account_id, organization_id, nome, setor, domain_key, cidade, estado, tipo, ja_patrocina_cultura, exemplo)
    values (p_user, p_org, 'Mappin', 'Varejo', 'mappin.com.br', 'São Paulo', 'SP', 'prospect', true, true) returning id into e_mappin;
  insert into public.empresas_crm (account_id, organization_id, nome, setor, domain_key, cidade, estado, tipo, ja_patrocina_cultura, exemplo)
    values (p_user, p_org, 'Mesbla', 'Varejo', 'mesbla.com.br', 'Rio de Janeiro', 'RJ', 'prospect', false, true) returning id into e_mesbla;
  insert into public.empresas_crm (account_id, organization_id, nome, setor, domain_key, cidade, estado, tipo, ja_patrocina_cultura, exemplo)
    values (p_user, p_org, 'Banco Nacional', 'Financeiro', 'banconacional.com.br', 'Rio de Janeiro', 'RJ', 'prospect', true, true) returning id into e_nacional;
  insert into public.empresas_crm (account_id, organization_id, nome, setor, domain_key, cidade, estado, tipo, ja_patrocina_cultura, exemplo)
    values (p_user, p_org, 'Banco Real', 'Financeiro', 'bancoreal.com.br', 'São Paulo', 'SP', 'prospect', true, true) returning id into e_real;
  insert into public.empresas_crm (account_id, organization_id, nome, setor, domain_key, cidade, estado, tipo, ja_patrocina_cultura, exemplo)
    values (p_user, p_org, 'Unibanco', 'Financeiro', 'unibanco.com.br', 'São Paulo', 'SP', 'prospect', true, true) returning id into e_unibanco;
  insert into public.empresas_crm (account_id, organization_id, nome, setor, domain_key, cidade, estado, tipo, ja_patrocina_cultura, exemplo)
    values (p_user, p_org, 'Bamerindus', 'Financeiro', 'bamerindus.com.br', 'Curitiba', 'PR', 'prospect', false, true) returning id into e_bamerindus;

  -- Proponentes
  insert into public.proponentes (account_id, organization_id, nome, tipo, cidade, estado, descricao, identidade_tipo, identidade_logo_url, exemplo)
    values (p_user, p_org, 'Atlântida Cinematográfica', 'empresa', 'Rio de Janeiro', 'RJ',
      'O estúdio das chanchadas, de Oscarito e Grande Otelo. Fundado em 1941.', 'logo', '/exemplos/atlantida.png', true)
    returning id into p_atlantida;
  insert into public.proponentes (account_id, organization_id, nome, tipo, cidade, estado, descricao, identidade_tipo, identidade_logo_url, exemplo)
    values (p_user, p_org, 'TV Tupi', 'empresa', 'São Paulo', 'SP',
      'A primeira emissora de televisão do Brasil, no ar de 1950 a 1980.', 'logo', '/exemplos/tupi.png', true)
    returning id into p_tupi;
  insert into public.proponentes (account_id, organization_id, nome, tipo, cidade, estado, descricao, identidade_tipo, identidade_logo_url, exemplo)
    values (p_user, p_org, 'Rede Manchete', 'empresa', 'Rio de Janeiro', 'RJ',
      'Emissora de 1983 a 1999, das novelas Pantanal e Dona Beija.', 'logo', '/exemplos/manchete.png', true)
    returning id into p_manchete;

  -- Projetos (filmes clássicos, com cartaz ou foto de cena)
  insert into public.projetos_crm (account_id, organization_id, nome, descricao, valor_alvo, mecanismo, proponente_id, proponente_nome, cidade, estado,
      fase, status_operacional, status_comercial, visibilidade, identidade_tipo, identidade_logo_url, capa_url, areas_culturais, exemplo)
    values (p_user, p_org, 'Aviso aos Navegantes', 'Chanchada de 1950 com Oscarito e Grande Otelo, toda passada a bordo de um navio.',
      600000, 'audiovisual', p_atlantida, 'Atlântida Cinematográfica', 'Rio de Janeiro', 'RJ',
      'captacao', 'ativo', 'em_captacao', 'equipe', 'logo', '/exemplos/aviso.jpg', '/exemplos/aviso.jpg', array['Cinema'], true)
    returning id into j_aviso;
  insert into public.projetos_crm (account_id, organization_id, nome, descricao, valor_alvo, mecanismo, cidade, estado,
      fase, status_operacional, status_comercial, visibilidade, identidade_tipo, identidade_logo_url, capa_url, areas_culturais, exemplo)
    values (p_user, p_org, 'Alô, Alô, Carnaval', 'Musical de 1936 com Carmen e Aurora Miranda cantando as marchinhas do ano.',
      400000, 'audiovisual', 'Rio de Janeiro', 'RJ',
      'captacao', 'ativo', 'em_captacao', 'equipe', 'logo', '/exemplos/alo.jpg', '/exemplos/alo.jpg', array['Cinema', 'Música'], true)
    returning id into j_alo;
  insert into public.projetos_crm (account_id, organization_id, nome, descricao, valor_alvo, mecanismo, cidade, estado,
      fase, status_operacional, status_comercial, visibilidade, identidade_tipo, identidade_logo_url, capa_url, areas_culturais, exemplo)
    values (p_user, p_org, 'Banana da Terra', 'O filme de 1939 em que Carmen Miranda canta "O que é que a baiana tem?".',
      450000, 'audiovisual', 'Rio de Janeiro', 'RJ',
      'captacao', 'ativo', 'em_captacao', 'equipe', 'logo', '/exemplos/banana.jpg', '/exemplos/banana.jpg', array['Cinema', 'Música'], true)
    returning id into j_banana;
  insert into public.projetos_crm (account_id, organization_id, nome, descricao, valor_alvo, mecanismo, cidade, estado,
      fase, status_operacional, status_comercial, visibilidade, identidade_tipo, identidade_logo_url, capa_url, areas_culturais, exemplo)
    values (p_user, p_org, 'Tico-Tico no Fubá', 'A vida de Zequinha de Abreu, filmada em 1952 nos estúdios da Vera Cruz.',
      700000, 'audiovisual', 'São Bernardo do Campo', 'SP',
      'captacao', 'ativo', 'em_captacao', 'equipe', 'logo', '/exemplos/tico.jpg', '/exemplos/tico.jpg', array['Cinema'], true)
    returning id into j_tico;
  insert into public.projetos_crm (account_id, organization_id, nome, descricao, valor_alvo, mecanismo, cidade, estado,
      fase, status_operacional, status_comercial, visibilidade, identidade_tipo, identidade_logo_url, capa_url, areas_culturais, exemplo)
    values (p_user, p_org, 'O Cangaceiro', 'O faroeste do sertão de Lima Barreto, premiado em Cannes em 1953.',
      900000, 'audiovisual', 'São Bernardo do Campo', 'SP',
      'captacao', 'ativo', 'em_captacao', 'equipe', 'logo', '/exemplos/cangaceiro.jpg', '/exemplos/cangaceiro.jpg', array['Cinema'], true)
    returning id into j_cangaceiro;
  insert into public.projetos_crm (account_id, organization_id, nome, descricao, valor_alvo, mecanismo, cidade, estado,
      fase, status_operacional, status_comercial, visibilidade, identidade_tipo, identidade_logo_url, capa_url, areas_culturais, exemplo)
    values (p_user, p_org, 'O Pagador de Promessas', 'O filme de Anselmo Duarte que trouxe a Palma de Ouro para o Brasil em 1962.',
      1200000, 'audiovisual', 'Salvador', 'BA',
      'captacao', 'ativo', 'em_captacao', 'equipe', 'logo', '/exemplos/pagador.jpg', '/exemplos/pagador.jpg', array['Cinema'], true)
    returning id into j_pagador;

  -- Contatos (pessoas inventadas, com cargos da época)
  insert into public.contatos (account_id, organization_id, empresa_crm_id, nome, cargo, origem, papel_decisao, influencia, forca_relacao, sentimento, canal_preferido, exemplo)
    values (p_user, p_org, e_varig, 'Helena Braga', 'Gerente de Marketing Cultural', 'proprio', 'decision_maker', 5, 4, 'positivo', 'reuniao', true) returning id into c_varig;
  insert into public.contatos (account_id, organization_id, empresa_crm_id, nome, cargo, origem, papel_decisao, influencia, forca_relacao, sentimento, canal_preferido, exemplo)
    values (p_user, p_org, e_nacional, 'Otávio Lins', 'Diretor de Comunicação', 'indicacao', 'decision_maker', 5, 3, 'positivo', 'telefone', true) returning id into c_nacional;
  insert into public.contatos (account_id, organization_id, empresa_crm_id, nome, cargo, origem, papel_decisao, influencia, forca_relacao, sentimento, canal_preferido, exemplo)
    values (p_user, p_org, e_mappin, 'Celina Prado', 'Coordenadora de Patrocínios', 'proprio', 'champion', 3, 4, 'positivo', 'email', true) returning id into c_mappin;
  insert into public.contatos (account_id, organization_id, empresa_crm_id, nome, cargo, origem, papel_decisao, influencia, forca_relacao, sentimento, canal_preferido, exemplo)
    values (p_user, p_org, e_vasp, 'Raul Menezes', 'Gerente de Relações Institucionais', 'linkedin', 'influencer', 3, 2, 'neutro', 'linkedin', true) returning id into c_vasp;
  insert into public.contatos (account_id, organization_id, empresa_crm_id, nome, cargo, origem, papel_decisao, influencia, forca_relacao, sentimento, canal_preferido, exemplo)
    values (p_user, p_org, e_mesbla, 'Dora Vasconcelos', 'Analista de Marketing', 'proprio', 'gatekeeper', 2, 2, 'desconhecido', 'email', true) returning id into c_mesbla;
  insert into public.contatos (account_id, organization_id, empresa_crm_id, nome, cargo, origem, papel_decisao, influencia, forca_relacao, sentimento, canal_preferido, exemplo)
    values (p_user, p_org, e_bamerindus, 'Jairo Pacheco', 'Superintendente de Marketing', 'proprio', 'decision_maker', 4, 2, 'negativo', 'telefone', true) returning id into c_bamerindus;

  -- Negociações, uma em cada etapa do funil
  insert into public.captacoes (account_id, organization_id, projeto_id, empresa_crm_id, contato_empresa_id, lei, status, valor_solicitado, valor_aprovado,
      prioridade, potencial_fechamento, meio_contato, data_previsao, exemplo)
    values (p_user, p_org, j_aviso, e_varig, c_varig, 'audiovisual', 'aprovado', 350000, 350000,
      'alta', 'alto', 'reuniao', hoje - 12, true) returning id into n_aviso;
  insert into public.captacoes (account_id, organization_id, projeto_id, empresa_crm_id, contato_empresa_id, lei, status, valor_solicitado,
      prioridade, potencial_fechamento, meio_contato, proxima_prospeccao, data_previsao, exemplo)
    values (p_user, p_org, j_pagador, e_nacional, c_nacional, 'audiovisual', 'proposta_enviada', 500000,
      'alta', 'alto', 'email', hoje + 2, hoje + 30, true) returning id into n_pagador;
  insert into public.captacoes (account_id, organization_id, projeto_id, empresa_crm_id, contato_empresa_id, lei, status, valor_solicitado,
      prioridade, potencial_fechamento, meio_contato, proxima_prospeccao, data_previsao, exemplo)
    values (p_user, p_org, j_tico, e_mappin, c_mappin, 'audiovisual', 'em_negociacao', 220000,
      'media', 'medio', 'reuniao', hoje + 4, hoje + 45, true) returning id into n_tico;
  insert into public.captacoes (account_id, organization_id, projeto_id, empresa_crm_id, contato_empresa_id, lei, status, valor_solicitado,
      prioridade, potencial_fechamento, meio_contato, proxima_prospeccao, exemplo)
    values (p_user, p_org, j_cangaceiro, e_vasp, c_vasp, 'audiovisual', 'primeiro_contato', 300000,
      'media', 'medio', 'linkedin', hoje + 7, true) returning id into n_cangaceiro;
  insert into public.captacoes (account_id, organization_id, projeto_id, empresa_crm_id, contato_empresa_id, lei, status, valor_solicitado,
      prioridade, potencial_fechamento, exemplo)
    values (p_user, p_org, j_banana, e_mesbla, c_mesbla, 'audiovisual', 'prospeccao', 150000,
      'baixa', 'baixo', true) returning id into n_banana;
  insert into public.captacoes (account_id, organization_id, projeto_id, empresa_crm_id, contato_empresa_id, lei, status, valor_solicitado,
      prioridade, potencial_fechamento, meio_contato, retorno, exemplo)
    values (p_user, p_org, j_alo, e_bamerindus, c_bamerindus, 'audiovisual', 'recusado', 120000,
      'baixa', 'baixo', 'telefone', 'A verba de patrocínio do ano já estava comprometida.', true) returning id into n_alo;

  -- Atividades: uma atrasada, uma para hoje, duas adiante e uma feita
  insert into public.atividades (account_id, organization_id, responsavel_id, captacao_id, empresa_crm_id, contato_id, projeto_id,
      nome, tipo, prioridade, data_inicio, data_prevista, feita, calendar_sync_requested, exemplo)
    values
    (p_user, p_org, p_user, n_aviso, e_varig, c_varig, j_aviso, 'Enviar o contrato assinado para a Varig', 'email', 'alta',
      (hoje - 3)::timestamptz, (hoje - 3)::timestamptz, false, false, true),
    (p_user, p_org, p_user, n_pagador, e_nacional, c_nacional, j_pagador, 'Ligar para o Otávio sobre a proposta', 'telefone', 'alta',
      hoje::timestamptz, hoje::timestamptz, false, false, true),
    (p_user, p_org, p_user, n_tico, e_mappin, c_mappin, j_tico, 'Apresentar as cotas do Tico-Tico ao Mappin', 'reuniao', 'media',
      (hoje + 4)::timestamptz, (hoje + 4)::timestamptz, false, false, true),
    (p_user, p_org, p_user, n_cangaceiro, e_vasp, c_vasp, j_cangaceiro, 'Mandar o dossiê de O Cangaceiro para a VASP', 'email', 'media',
      (hoje + 7)::timestamptz, (hoje + 7)::timestamptz, false, false, true),
    (p_user, p_org, p_user, n_banana, e_mesbla, c_mesbla, j_banana, 'Primeira conversa com a Mesbla', 'telefone', 'baixa',
      (hoje - 10)::timestamptz, (hoje - 10)::timestamptz, true, false, true);

  update public.atividades set data_realizada = data_prevista
    where organization_id = p_org and exemplo and feita and data_realizada is null;

  -- Histórico de conversas
  insert into public.crm_interacoes (organization_id, account_id, empresa_crm_id, contato_id, captacao_id, tipo, tipo_interacao, direcao, assunto, resumo, ocorreu_em, created_by, exemplo)
    values
    (p_org, p_user, e_varig, c_varig, n_aviso, 'reuniao', 'reuniao', 'saida', 'Apresentação do Aviso aos Navegantes',
      'A Helena gostou da ideia de exibir o filme a bordo, nos voos para o Rio. Pediu a proposta com a cota principal.', (hoje - 30)::timestamptz + interval '15 hours', p_user, true),
    (p_org, p_user, e_varig, c_varig, n_aviso, 'email', 'mensagem', 'entrada', 'Patrocínio aprovado',
      'A diretoria aprovou R$ 350 mil. Contrato segue para assinatura.', (hoje - 12)::timestamptz + interval '10 hours', p_user, true),
    (p_org, p_user, e_nacional, c_nacional, n_pagador, 'email', 'mensagem', 'saida', 'Proposta: O Pagador de Promessas',
      'Enviada a proposta com três cotas e as contrapartidas de exibição gratuita.', (hoje - 5)::timestamptz + interval '11 hours', p_user, true),
    (p_org, p_user, e_mappin, c_mappin, n_tico, 'telefone', 'ligacao', 'saida', 'Retorno sobre o Tico-Tico no Fubá',
      'A Celina quer levar a proposta ao comitê, mas pediu uma sessão para os funcionários na loja da Praça Ramos.', (hoje - 2)::timestamptz + interval '16 hours', p_user, true),
    (p_org, p_user, e_bamerindus, c_bamerindus, n_alo, 'telefone', 'ligacao', 'entrada', 'Resposta do Bamerindus',
      'Não vão patrocinar este ano. Vale procurar de novo no próximo ciclo.', (hoje - 20)::timestamptz + interval '14 hours', p_user, true);

  return 1;
end;
$function$;

revoke all on function public.fn_semear_exemplos(uuid, uuid) from public, anon, authenticated;
