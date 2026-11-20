alter table email_agendados add column if not exists cco text[] not null default '{}';
