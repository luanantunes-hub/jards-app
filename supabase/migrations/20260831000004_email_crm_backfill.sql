-- Converte mensagens reconhecidas antes da integração em memória relacional.

update public.emails e
set empresa_crm_id = c.empresa_crm_id,
    visibility = 'organization'
from public.contatos c
where e.contato_id = c.id
  and e.organization_id = c.organization_id
  and c.empresa_crm_id is not null;

with unica_captacao_ativa as (
  select organization_id, empresa_crm_id, (array_agg(id order by updated_at desc, id))[1] as captacao_id
  from public.captacoes
  where empresa_crm_id is not null
    and status::text not in ('aprovado', 'recusado', 'ganha', 'perdida')
  group by organization_id, empresa_crm_id
  having count(*) = 1
)
update public.emails e
set captacao_id = unica.captacao_id
from unica_captacao_ativa unica
where e.organization_id = unica.organization_id
  and e.empresa_crm_id = unica.empresa_crm_id
  and e.captacao_id is null;

with mensagens_canonicas as (
  select
    e.*,
    row_number() over (
      partition by e.organization_id,
        coalesce(e.internet_message_id, 'gmail:' || e.user_id::text || ':' || e.message_id)
      order by e.sent_at nulls last, e.created_at, e.id
    ) as ordem
  from public.emails e
  where e.visibility = 'organization'
    and e.contato_id is not null
    and e.empresa_crm_id is not null
)
insert into public.crm_interacoes (
  organization_id, account_id, empresa_crm_id, contato_id, captacao_id,
  email_id, tipo, canal, tipo_interacao, direcao, assunto, resumo,
  ocorreu_em, created_by
)
select
  e.organization_id,
  e.user_id,
  e.empresa_crm_id,
  e.contato_id,
  e.captacao_id,
  e.id,
  'email',
  'email',
  'mensagem',
  case when e.direction = 'inbound' then 'entrada' else 'saida' end,
  coalesce(nullif(trim(e.subject), ''), 'E-mail sem assunto'),
  left(nullif(trim(coalesce(e.body_text, e.snippet)), ''), 1200),
  coalesce(e.sent_at, e.created_at),
  e.user_id
from mensagens_canonicas e
where e.ordem = 1
  and not exists (
    select 1 from public.crm_interacoes i where i.email_id = e.id
  )
on conflict (email_id) do nothing;
