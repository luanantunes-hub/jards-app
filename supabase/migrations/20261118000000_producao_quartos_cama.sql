-- PD6.8 (segundo corte): o tipo de cama de cada quarto. O hotel precisa saber se o quarto é de casal ou de solteiro para
-- arrumar certo; a lista que ele recebe pelo link passa a mostrar a cama. Opcional: quarto sem a cama dita segue como antes.
-- Lista fechada, conferida pelo banco (o app usa as mesmas palavras em lib/producao/estados.ts).

alter table public.producao_quartos add column if not exists cama text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'producao_quartos_cama_check') then
    alter table public.producao_quartos add constraint producao_quartos_cama_check check (cama in ('casal', 'solteiro', 'duas_solteiro', 'casal_e_solteiro', 'beliche'));
  end if;
end
$$;
