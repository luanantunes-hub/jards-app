-- Campos operacionais da página de detalhe da entrega.
-- A migration é aditiva e não altera RLS nem os estados existentes.

alter table public.compromissos_cliente
  add column if not exists criterios_aceite text,
  add column if not exists entregue_em timestamptz,
  add column if not exists entregue_por uuid references public.profiles(id) on delete set null,
  add column if not exists aprovado_por uuid references public.profiles(id) on delete set null;

-- Preserva uma referência temporal razoável para entregas históricas.
update public.compromissos_cliente
set entregue_em = coalesce(entregue_em, updated_at)
where status in ('entregue', 'aprovado')
  and entregue_em is null;

comment on column public.compromissos_cliente.criterios_aceite is
  'Condições objetivas usadas para validar a entrega.';
comment on column public.compromissos_cliente.entregue_em is
  'Momento em que a execução foi marcada como entregue.';
comment on column public.compromissos_cliente.entregue_por is
  'Membro que marcou a execução como entregue.';
comment on column public.compromissos_cliente.aprovado_por is
  'Membro que aprovou a entrega.';
