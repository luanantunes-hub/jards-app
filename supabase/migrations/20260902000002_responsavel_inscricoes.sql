-- Responsável por cada inscrição em edital: pode ser uma agência (captadores)
-- ou um membro interno da equipe (profiles via organization_members).
alter table editais_user
  add column if not exists responsavel_tipo text
    check (responsavel_tipo in ('agencia', 'membro')),
  add column if not exists responsavel_id   uuid,
  add column if not exists responsavel_nome  text;

create index if not exists idx_editais_user_responsavel
  on editais_user (organization_id, responsavel_tipo);