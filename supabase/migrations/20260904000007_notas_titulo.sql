-- Notas ganham título opcional. Permite notas "modelo" (título fixo, conteúdo
-- livre) para qualificar a empresa, sem obrigar estrutura nenhuma — o usuário
-- pode preencher, excluir ou criar outras notas com título livre.
alter table public.notas add column if not exists titulo text;
