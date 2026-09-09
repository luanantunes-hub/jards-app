-- Migration 014: campo captador_id em captacoes
-- Um "captador" é o membro da organização responsável pela negociação.
-- "Blindagem" é implícita: uma empresa com captação ativa de captador A
-- bloqueia a prospecção pelo captador B (detectado no client).

alter table captacoes
  add column if not exists captador_id uuid references auth.users(id);

create index if not exists idx_captacoes_captador_id on captacoes(captador_id);
