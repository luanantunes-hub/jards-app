-- Agendar reunião pelo Jards: a reunião passa a nascer de um evento no calendário da pessoa (Google ou Outlook),
-- com a sala do Meet ou do Teams criada junto. Guardamos de qual calendário veio e o id do evento, para poder
-- desmarcar depois. `participantes` são os e-mails convidados, como foram enviados ao provedor.
-- Só acrescenta colunas; nada do que já existe muda.

alter table public.reunioes
  add column if not exists calendar_provider text check (calendar_provider in ('google', 'microsoft')),
  add column if not exists calendar_event_id text,
  add column if not exists participantes text[] not null default '{}';

comment on column public.reunioes.calendar_provider is 'Calendário onde o evento foi criado (o Meet nasce no Google; o Teams, no Outlook).';
comment on column public.reunioes.calendar_event_id is 'Id do evento no calendário, para desmarcar ou atualizar.';
