-- Um bug de corrida no seed automático (ver fn_seed_notas_modelo) já criou
-- notas-modelo duplicadas em produção. Antes de travar a unicidade abaixo,
-- limpamos essas duplicatas: por par (empresa_crm_id, lower(titulo)), mantém
-- a nota com conteúdo preenchido (se só uma tiver texto) e, entre empatadas,
-- mantém a mais antiga. Não deleta pares que tenham conteúdo em ambos os
-- lados com títulos diferentes — só duplicatas exatas de título.
delete from public.notas a
using public.notas b
where a.titulo is not null
  and b.titulo is not null
  and a.empresa_crm_id is not distinct from b.empresa_crm_id
  and lower(a.titulo) = lower(b.titulo)
  and (
    (trim(a.conteudo) = '' and trim(b.conteudo) <> '')
    or (
      (trim(a.conteudo) = '') = (trim(b.conteudo) = '')
      and (a.created_at, a.id) > (b.created_at, b.id)
    )
  );

-- Evita notas com o mesmo título na mesma empresa. Título é opcional — a
-- regra só vale quando preenchido (múltiplas notas sem título continuam ok).
create unique index if not exists notas_empresa_titulo_unico
  on public.notas (empresa_crm_id, lower(titulo))
  where titulo is not null;
