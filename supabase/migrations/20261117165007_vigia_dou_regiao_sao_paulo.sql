-- Vigia do Diário Oficial: a coleta passa a rodar em São Paulo.
-- O arquivo mensal da Base de Dados do DOU vem de um servidor no Brasil. De us-east-2 (onde o
-- Supabase atende por padrão) o download anda a cerca de 0,75 MB/s (34 MB em 45 s) e o arquivo
-- de novembro cresce uns 5 MB por dia útil: o prazo de 100 s da função estoura por volta de 24/11.
-- Pedindo a região sa-east-1 no cabeçalho x-region, a mesma leitura leva uns 9 s.
-- Mesma assinatura e mesmos privilégios; só muda o cabeçalho enviado.

create or replace function public.fn_agente_normativo_disparar(p_ultima boolean default false)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url text;
  v_segredo text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'agente_normativo_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'agente_normativo_segredo';
  if coalesce(v_url, '') = '' or coalesce(v_segredo, '') = '' then
    raise notice 'agente normativo sem endereço ou segredo no cofre';
    return null;
  end if;
  return net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-agente-segredo', v_segredo, 'x-region', 'sa-east-1'),
    body := jsonb_build_object('ultima', p_ultima),
    timeout_milliseconds := 150000);
end;
$$;
