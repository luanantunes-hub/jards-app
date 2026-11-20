-- Ticketeria: o tema do site da loja (construtor de sites, passo 2; plano em docs/acoes-futuras/estudos/plano-ticketeria-cms-e-integracoes.md).
--
-- O tema é o jeito do site todo (fundo, fonte, cantos e botões), escolhido entre cinco prontos: classico (o visual de sempre), editorial, moderno, noite e calor. A cor que o produtor já escolhe
-- segue sendo a cor de destaque de cada tema. Todo site existente começa no "classico", que é exatamente o que ele já mostra: ninguém vê mudança até escolher outro.
-- Os temas ficam no código (lib/ticketeria/temas.ts); o banco guarda só o nome, numa lista fechada.
--
-- Expansão: uma coluna nova com padrão e uma regra. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.ticketeria_sites add column if not exists tema text not null default 'classico';

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.ticketeria_sites'::regclass and conname = 'ticketeria_sites_tema_check') then
    alter table public.ticketeria_sites add constraint ticketeria_sites_tema_check check (tema in ('classico', 'editorial', 'moderno', 'noite', 'calor'));
  end if;
end
$$;
