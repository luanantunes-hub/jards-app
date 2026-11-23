-- Ticketeria: o servidor do app pode mandar os avisos do sino (fn_ticketeria_avisar), além dos gatilhos do banco. É para o aviso de anúncio gastando com o evento esgotado e de evento
-- quase esgotado, que dependem do gasto das campanhas lido uma vez por dia (rota /api/ticketeria/midia/ler-todas, com a chave de serviço). Ninguém de fora do servidor chama.
-- Expansão: só uma permissão nova. Reaplicável; sem DROP.

set local lock_timeout = '10s';

grant execute on function public.fn_ticketeria_avisar(uuid, text, text, text, text, text, text, uuid, text) to service_role;
