-- Conector MCP: escrita segura contra repetição.
--
-- Quem cria um registro pelo Claude ou pelo ChatGPT às vezes recebe erro de rede depois de o registro já ter sido
-- gravado, e repetir o pedido duplicava. Agora quem chama manda uma chave (chave_idempotencia): repetir o MESMO
-- pedido com a MESMA chave devolve o resultado de antes, sem criar nada de novo.
--
-- Uma linha por (organização, pessoa, chave). `status` fica nulo enquanto o pedido está em andamento: é a reserva
-- da chave, que impede dois pedidos iguais simultâneos de gravarem duas vezes. `impressao` é o hash do pedido: a
-- mesma chave com dados diferentes é recusada em vez de devolver a resposta de outro pedido.
--
-- Aditiva. Só o servidor do conector (service role) lê e grava: sem policy nenhuma, o RLS barra todo o resto.

create table if not exists public.mcp_idempotencia (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  chave text not null,
  operacao text not null,
  impressao text not null,
  status integer,
  resposta jsonb,
  criada_em timestamptz not null default now(),
  concluida_em timestamptz,
  primary key (organization_id, usuario_id, chave)
);

create index if not exists idx_mcp_idempotencia_criada_em on public.mcp_idempotencia (criada_em);

alter table public.mcp_idempotencia enable row level security;
revoke all on table public.mcp_idempotencia from anon, authenticated;

comment on table public.mcp_idempotencia is
  'Chaves de idempotência das escritas do conector MCP/ChatGPT. Só o service role acessa; linhas com mais de 7 dias são apagadas todo dia.';

-- ─── Limpeza diária ─────────────────────────────────────────────────────────
-- Uma chave só precisa valer pelo tempo de uma repetição por erro de rede.

create or replace function public.fn_mcp_idempotencia_limpar()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  apagadas integer;
begin
  delete from public.mcp_idempotencia where criada_em < now() - interval '7 days';
  get diagnostics apagadas = row_count;
  return apagadas;
end;
$$;

revoke all on function public.fn_mcp_idempotencia_limpar() from public, anon, authenticated;
grant execute on function public.fn_mcp_idempotencia_limpar() to service_role;

-- 03h30 em Brasília.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('jards-mcp-idempotencia-limpar', '30 6 * * *', 'select public.fn_mcp_idempotencia_limpar();');
  end if;
end
$$;
