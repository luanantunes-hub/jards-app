-- Ticketeria: a taxa do Jards passa a ser 2,5% do preço de cada ingresso pago (decisão do dono em 19/11/2026), no lugar do valor fixo
-- provisório de R$ 1,35 gravado pela T5 (parte 2).
--
-- A regra continua sendo uma linha de `ticketeria_taxas` (a tabela é só de inserção e guarda o histórico: a de `vigente_desde` mais
-- recente vale): aqui entra a nova regra padrão (loja nula), percentual 250 pontos-base, fixo zero, paga pelo comprador, somada ao
-- preço; o produtor recebe o preço cheio. Cortesia e gratuito seguem com taxa zero (preço zero, taxa zero). Por loja, o super admin
-- grava uma linha própria quando quiser outro valor. O custo do meio de pagamento (Asaas) não muda: segue pago pelo comprador.
-- Sem dinheiro real: nada vai à produção antes do parecer jurídico e das respostas do Asaas.
-- Dados apenas; sem mudança de estrutura. Reaplicável (só insere se a regra padrão ainda não for essa).

insert into public.ticketeria_taxas (loja_id, percentual_bps, fixo_centavos, quem_paga)
select null, 250, 0, 'comprador'
where not exists (
  select 1 from public.ticketeria_taxas t
  where t.loja_id is null and t.percentual_bps = 250 and t.fixo_centavos = 0 and t.quem_paga = 'comprador'
);
