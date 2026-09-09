-- Add FK links from contatos to captadores and proponentes
alter table contatos
  add column if not exists captador_id   uuid references captadores(id)  on delete set null,
  add column if not exists proponente_id uuid references proponentes(id) on delete set null;

create index if not exists contatos_captador_id_idx   on contatos(captador_id);
create index if not exists contatos_proponente_id_idx on contatos(proponente_id);
