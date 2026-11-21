-- Ticketeria: o envio por WHATSAPP no Público (quinta parte). O produtor prepara o envio, a tela mostra as pessoas com o link que abre cada conversa já com a mensagem, e cada uma é marcada
-- como enviada quando ele a abre. O envio usa as mesmas tabelas do e-mail (`ticketeria_envios` e `ticketeria_envio_destinatarios`, com o token do link de sair da lista); só falta o canal
-- "whatsapp" na regra do banco: troca a regra `ticketeria_envios_canal_check` (de só "email" para "email" ou "whatsapp"), sem apagar dado nenhum. Reaplicável.

set local lock_timeout = '10s';

alter table public.ticketeria_envios drop constraint if exists ticketeria_envios_canal_check;
alter table public.ticketeria_envios add constraint ticketeria_envios_canal_check check (canal in ('email', 'whatsapp'));
