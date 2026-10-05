-- Remove o "título do edital" das inscrições (editais_user.titulo).
--
-- Uma inscrição já é identificada por empresa e projeto; o campo quase nunca era
-- preenchido (9 de 137, nenhuma em organização real) e saiu da interface.
--
-- Ordem: (1) reescreve as funções que liam a coluna, (2) recria o gatilho sem ela
-- na lista "UPDATE OF" e (3) só então remove a coluna. O DROP é sem CASCADE de
-- propósito: se sobrar algum objeto dependente, a migration falha em vez de apagá-lo.
--
-- Não confundir com editais.titulo (catálogo público) nem com captacoes.titulo.

-- Troca um trecho do corpo de uma função preservando todo o resto (atributos,
-- search_path, permissões). Reaplicar é inofensivo: se o trecho novo já está lá, não faz nada.
create or replace function pg_temp.reescrever_funcao(p_assinatura text, p_antes text, p_depois text)
returns void
language plpgsql
as $fn$
declare
  v_def text := pg_get_functiondef(p_assinatura::regprocedure);
begin
  if position(p_antes in v_def) > 0 then
    execute replace(v_def, p_antes, p_depois);
  elsif position(p_depois in v_def) = 0 then
    raise exception 'Trecho esperado não encontrado em %', p_assinatura;
  end if;
end;
$fn$;

-- 1) Gatilho que cria o contrato ao aprovar: o título do contrato da inscrição passa a ser fixo.
select pg_temp.reescrever_funcao(
  'public.fn_ensure_contrato_origem_aprovada()',
  $a$v_titulo := coalesce(nullif(trim(new.titulo), ''), 'Contrato da inscrição');$a$,
  $d$v_titulo := 'Contrato da inscrição';$d$
);

-- 2) Visão geral do captador: a oportunidade da inscrição é rotulada pela empresa.
select pg_temp.reescrever_funcao(
  'public.fn_captador_overview(uuid,date,date)',
  $a$coalesce(nullif(eu.titulo, ''), e.nome, 'Inscrição sem título') titulo,$a$,
  $d$coalesce(e.nome, 'Inscrição') titulo,$d$
);

-- 3) Notificação de prazo: "<empresa · projeto> encerra em N dias".
select pg_temp.reescrever_funcao(
  'public.fn_dispatch_deadline_notifications()',
  $a$    select id, organization_id, account_id, titulo, data_fechamento
    from public.editais_user
    where data_fechamento is not null
      and status not in ('aprovado', 'reprovado', 'cancelado')
      and data_fechamento - current_date in (30, 14, 7, 3, 1, 0)$a$,
  $d$    select eu.id, eu.organization_id, eu.account_id, eu.data_fechamento,
           nullif(concat_ws(' · ', coalesce(ec.nome, ep.nome), pc.nome), '') as rotulo
    from public.editais_user eu
    left join public.empresas_crm ec on ec.id = eu.empresa_crm_id
    left join public.empresas ep on ep.id = eu.empresa_pub_id
    left join public.projetos_crm pc on pc.id = eu.projeto_id
    where eu.data_fechamento is not null
      and eu.status not in ('aprovado', 'reprovado', 'cancelado')
      and eu.data_fechamento - current_date in (30, 14, 7, 3, 1, 0)$d$
);
select pg_temp.reescrever_funcao(
  'public.fn_dispatch_deadline_notifications()',
  $a$coalesce(r.titulo, 'Edital')$a$,
  $d$coalesce(r.rotulo, 'Inscrição')$d$
);

-- 4) Workspace do proponente: a inscrição do projeto é mostrada pela empresa, como as negociações.
select pg_temp.reescrever_funcao(
  'public.fn_proponente_projeto_detalhe(uuid)',
  $a$'titulo', coalesce(e.titulo, ed.titulo, 'Edital'),$a$,
  $d$'empresaNome', coalesce(ec.nome, ep.nome, '—'),$d$
);
select pg_temp.reescrever_funcao(
  'public.fn_proponente_projeto_detalhe(uuid)',
  $a$      left join public.editais e on e.id = ed.edital_pub_id
      where ed.projeto_id = p.id$a$,
  $d$      left join public.empresas_crm ec on ec.id = ed.empresa_crm_id
      left join public.empresas ep on ep.id = ed.empresa_pub_id
      where ed.projeto_id = p.id$d$
);

-- Nenhuma função pode mais ler a coluna que vai sair.
do $$
declare
  v_restante text;
begin
  select string_agg(proname, ', ') into v_restante
  from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname in ('fn_captador_overview', 'fn_dispatch_deadline_notifications', 'fn_proponente_projeto_detalhe')
    and (prosrc like '%eu.titulo%' or prosrc like '%ed.titulo%' or prosrc like '%r.titulo%');
  if v_restante is not null then
    raise exception 'Ainda há leitura de editais_user.titulo em: %', v_restante;
  end if;
  if exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'fn_ensure_contrato_origem_aprovada'
      and prosrc like '%coalesce(nullif(trim(new.titulo), ''''), ''Contrato da inscrição'')%'
  ) then
    raise exception 'fn_ensure_contrato_origem_aprovada ainda lê titulo da inscrição';
  end if;
end;
$$;

-- 5) O gatilho citava titulo na lista de colunas: recria sem ela.
drop trigger if exists trg_inscricao_contrato_ao_aprovar on public.editais_user;
create trigger trg_inscricao_contrato_ao_aprovar
  after insert or update of status, valor, empresa_crm_id on public.editais_user
  for each row execute function public.fn_ensure_contrato_origem_aprovada();

-- 6) Remove a coluna.
alter table public.editais_user drop column if exists titulo;
