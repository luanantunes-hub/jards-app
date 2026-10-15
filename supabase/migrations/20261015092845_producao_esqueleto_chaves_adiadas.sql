-- PD0.8 (ajuste): as chaves entre obra, temporada e data passam a ser conferidas no fim da transação.
--
-- Por quê. Essas três chaves (producao_temporadas.obra_id, producao_datas.temporada_id e
-- producao_datas.obra_id) recusam apagar uma obra ou uma temporada que ainda tem filhos
-- (sem apagar em cascata por engano). Conferidas na hora, porém, elas também travariam o
-- apagamento de uma organização inteira: ao apagar a organização, o banco apaga primeiro
-- as obras e só depois as temporadas, as datas e os blocos (ordem dos gatilhos das chaves
-- para organizations, conferida em pg_trigger), e a chave imediata achava as temporadas
-- ainda lá. Conferidas no fim da transação, o resultado é o mesmo para quem apaga uma
-- obra ou uma temporada com filhos (o erro 23503 volta no commit), e o apagamento da
-- organização passa, porque nesse ponto os filhos já saíram. Uma função que apague
-- temporada e datas na mesma transação também passa, em qualquer ordem.
--
-- Tabelas novas e vazias (0 linhas em 15/10/2026): a troca é instantânea e não muda dado.
-- Sem DROP, reaplicável: repetir leva ao mesmo estado.

set local lock_timeout = '10s';

alter table public.producao_temporadas
  alter constraint producao_temporadas_obra_id_fkey deferrable initially deferred;
alter table public.producao_datas
  alter constraint producao_datas_temporada_id_fkey deferrable initially deferred;
alter table public.producao_datas
  alter constraint producao_datas_obra_id_fkey deferrable initially deferred;
