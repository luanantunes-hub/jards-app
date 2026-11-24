-- Salas (M0), segunda parte: o nome do setor passa a ser único dentro da SALA, não mais dentro do espaço.
--
-- A migration das salas (20261127100900) criou o índice único (sala_id, nome). Esta tira a regra antiga (local_id, nome), que impedia um cinema de ter
-- "Plateia" em duas salas. Não apaga dado: só afrouxa uma regra, e a regra por sala (mais estreita) já vale. Autorizada pelo dono em 22/11/2026.

alter table public.ticketeria_setores drop constraint if exists ticketeria_setores_nome_key;
