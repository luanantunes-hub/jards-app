-- A lista de compras de Vendas passou a vir de 30 em 30 (a mais recente primeiro): este índice a serve sem ordenar a loja inteira.
-- Só um índice, com if not exists (sem DROP): aditiva e reaplicável.

set local lock_timeout = '10s';

create index if not exists ticketeria_pedidos_loja_criado_idx on public.ticketeria_pedidos (loja_id, created_at desc, id desc);
