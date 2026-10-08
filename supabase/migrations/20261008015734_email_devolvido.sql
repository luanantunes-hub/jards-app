-- E-mail que voltou como inexistente (hard bounce) num envio pelo Resend:
-- guarda quando o provedor recusou o endereço, para os próximos envios
-- pularem essa conta e a equipe saber que o e-mail cadastrado não existe mais.

alter table public.profiles
  add column if not exists email_devolvido_em timestamptz;

comment on column public.profiles.email_devolvido_em is
  'Quando o e-mail da conta voltou como inexistente (hard bounce) num envio pelo Resend. Nulo = sem devolução.';
