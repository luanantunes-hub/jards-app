alter table public.contatos drop constraint if exists contatos_papel_decisao_check;
alter table public.contatos add constraint contatos_papel_decisao_check
  check (papel_decisao is null or papel_decisao in ('decision_maker','champion','influencer','gatekeeper'));
