-- Ticketeria: o menu e o rodapé do site da loja (a biblioteca de seções, passo 4; layouts aprovados pelo dono em 20/11/2026).
--
-- O menu do alto e o rodapé valem para o site INTEIRO (não por página), então ficam numa coluna do próprio site: `aparencia`, um JSON com `cabecalho` (o layout do menu, o botão de ingressos e a
-- faixa fina de links) e `rodape` (o layout, o contato, as redes, as colunas de links e o convite para a newsletter). O formato é conferido no app (lib/ticketeria/aparencia.ts) e, no banco,
-- só o essencial: tem de ser um objeto e não pode passar de 20 mil bytes. Todo site existente começa com `{}`, que o app lê como "menu clássico e rodapé simples": ninguém vê mudança
-- até escolher. Aditiva e reaplicável; sem DROP; sem função nova. Quem edita o site já pode gravar aqui (o `update` da tabela já é de quem edita a Ticketeria da organização).

set local lock_timeout = '10s';

alter table public.ticketeria_sites add column if not exists aparencia jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.ticketeria_sites'::regclass and conname = 'ticketeria_sites_aparencia_check') then
    alter table public.ticketeria_sites add constraint ticketeria_sites_aparencia_check check (jsonb_typeof(aparencia) = 'object' and pg_column_size(aparencia) <= 20000);
  end if;
end
$$;
