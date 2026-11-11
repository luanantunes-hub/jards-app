-- PD12.2 (primeiro corte): SEO das páginas do site.
--
-- A página do site ganha uma descrição (para buscadores e para a prévia nas redes sociais) e uma imagem de compartilhamento
-- (endereço https). O site público usa os dois no <head> (descrição, Open Graph e Twitter) e lista as páginas publicadas no
-- sitemap.xml do domínio da pessoa.
--
-- Acesso, histórico e chaves: os mesmos de producao_site_paginas (nenhuma regra muda).
--
-- Expansão: duas colunas anuláveis novas e restrições sobre elas. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.producao_site_paginas add column if not exists descricao text;
alter table public.producao_site_paginas add column if not exists imagem_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.producao_site_paginas'::regclass and conname = 'producao_site_paginas_descricao_check') then
    alter table public.producao_site_paginas add constraint producao_site_paginas_descricao_check
      check (descricao is null or char_length(btrim(descricao)) between 1 and 300);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.producao_site_paginas'::regclass and conname = 'producao_site_paginas_imagem_url_check') then
    alter table public.producao_site_paginas add constraint producao_site_paginas_imagem_url_check
      check (imagem_url is null or (char_length(imagem_url) <= 500 and imagem_url ~ '^https://[^[:space:]]+$'));
  end if;
end
$$;

comment on column public.producao_site_paginas.descricao is 'Descrição da página para buscadores e redes sociais (até 300 letras).';
comment on column public.producao_site_paginas.imagem_url is 'Imagem de compartilhamento da página (endereço https).';
