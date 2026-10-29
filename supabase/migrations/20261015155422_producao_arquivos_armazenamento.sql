-- PD0.14: as regras do bucket "documentos" para a pasta {organização}/producoes/.
--
-- Os arquivos da produção moram no bucket "documentos", que também guarda os da prestação de
-- contas de clientes de verdade. Esta migration NÃO reescreve nem apaga nenhuma das regras que o
-- bucket já tem: só acrescenta regras novas, e cada uma só vale para um caminho cujo segundo
-- segmento é `producoes`. Para qualquer outro caminho (prestacoes, fornecedores, contratos,
-- entregas, qualquer outro) elas dizem "não se aplica", e o bucket responde como respondia.
-- Precisa da migration producao_arquivos na frente: as regras chamam as funções dela.
--
-- Aditiva, reaplicável e sem DROP. Nenhuma organização tem a produção ainda (0 contratos e
-- 0 vínculos em 15/10/2026) e o bucket não tem nenhum objeto em `producoes/` (0 de 8 objetos),
-- então hoje nenhum arquivo muda de situação.
--
-- ─── O que as regras de hoje permitem em {org}/producoes/ ───────────────────
-- Lidas de pg_policies em 15/10/2026: 30 regras em storage.objects, 10 do bucket documentos.
-- Todas são para authenticated (nenhuma para o visitante no documentos).
--   documentos: read org (leitura)           membro da organização do primeiro segmento (auth_org_ids():
--                                            qualquer papel, qualquer módulo); prestacoes e fornecedores
--                                            pedem também o módulo da prestação. Qualquer outro segundo
--                                            segmento, producoes inclusive, lê todo membro
--   documentos: upload org (envio)           membro; prestacoes e fornecedores pedem o papel da prestação
--   documentos: update org (troca)           e QUALQUER OUTRA PASTA CAI EM `else true`: todo membro,
--   documentos: delete org (exclusão)        de qualquer papel e módulo (captador e proponente também),
--                                            envia, troca e apaga em {org}/producoes/
--   documentos: leitura sem assinatura       só prestacoes e fornecedores, com a prestação só para leitura
--   documentos: convidado le                 só prestacoes e fornecedores, para o convidado do cliente
--   documentos: proponente envia / desfaz envio   só prestacoes
--   documentos: enviado nao muda / nao sai   RESTRITIVAS (troca e exclusão): bucket_id <> 'documentos'
--                                            or not fn_prestacao_arquivo_guardado(name); para um caminho
--                                            de producoes a função devolve falso e a regra passa
-- As outras 20 regras são dos buckets avatars, normas, projetos-identidade, propostas,
-- relatorios-sustentabilidade e workspace-anexos, e cada uma começa por bucket_id = '<o outro
-- bucket>': não alcançam o documentos. O bucket não limita o tipo nem o tamanho do arquivo
-- (allowed_mime_types e file_size_limit nulos). Conclusão: hoje todo membro da organização lê,
-- envia, troca e apaga em producoes/, e é isso que a produção não pode herdar.
--
-- ─── O que esta migration acrescenta ────────────────────────────────────────
-- 1. Quatro regras RESTRITIVAS, uma por comando, para authenticated:
--      documentos: producoes restrita (le | insere | altera | apaga)
--      bucket_id <> 'documentos'
--      or coalesce((storage.foldername(name))[2], '') <> 'producoes'
--      or public.auth_producao_arquivo_pode(name, 'ler' | 'editar')
--    As duas primeiras condições são o "não se aplica": outro bucket, ou outro segundo segmento,
--    passa sem a regra sequer olhar a produção (a terceira nem chega a ser avaliada). Para um
--    caminho de producoes, a pessoa precisa da permissão da produção. Por serem restritivas, juntam-se
--    com E às regras de hoje, que seguem como estão: o que `else true` liberava em producoes/ a quem
--    não tem a produção deixa de valer.
-- 2. Quatro regras PERMISSIVAS, as mesmas quatro para authenticated:
--      documentos: producoes le | insere | altera | apaga
--      bucket_id = 'documentos' and ...[2] = 'producoes' and auth_producao_arquivo_pode(name, ...)
--    Dão o acesso da produção pela organização do próprio caminho: não dependem da organização
--    aberta no navegador, nem de o `else true` das regras de hoje continuar existindo, e alcançam o
--    suporte (super admin), que não é membro. Ler vale também para a produção só para leitura.
-- 3. auth_producao_arquivo_pode(nome, ação), a função das oito regras. Lê o caminho com
--    fn_producao_caminho_partes (migration anterior) e junta o recorte da temporada
--    (auth_producao_ve_temporada) com auth_producao_pasta_pode, a mesma função das regras da tabela
--    producao_arquivos: a pasta pessoas só abre a quem pode `dinheiro` (ler: pode `dinheiro` ou a leitura
--    sem assinatura dele; escrever: `editar` e `dinheiro`), e as outras pastas pedem ler ou editar.
--    Ações: ler (leitura, em vigor ou só para leitura) e editar (enviar, trocar, apagar). Caminho de
--    producoes que não tem a forma do bucket (pasta desconhecida, extensão fora da lista, `..`, segmento a
--    mais) nega a todos: nada legítimo mora lá, e as regras de hoje não o protegeriam.
-- Cada regra nova só é criada se o nome ainda não existe.
--
-- ─── O que isto não faz ─────────────────────────────────────────────────────
-- Não confere se o arquivo tem uma linha em producao_arquivos (o aplicativo envia e registra; objeto
-- sem linha só é visível a quem tem a permissão), não limita o tamanho (o bucket não limita) e não
-- impede de mover para fora de producoes/ quem também edita no destino. O suporte passa pelas mesmas
-- funções auth_producao_*: lê e escreve em qualquer organização, inclusive na pasta pessoas.
--
-- ─── Conferência depois de aplicar (só leitura) ─────────────────────────────
-- As 30 regras que já existiam seguem iguais, letra por letra. Esta consulta tem de devolver
-- 30 e o mesmo resumo de 15/10/2026, antes desta migration (as oito novas ficam de fora pelo nome):
--   select count(*), md5(string_agg(policyname || cmd || permissive || coalesce(qual, '') || coalesce(with_check, ''), '|' order by policyname))
--   from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname not like 'documentos: producoes%';
--   -- 30 | f69d142cd2895887562468f486d53506

set local lock_timeout = '10s';

-- ─── 1. A função das regras ─────────────────────────────────────────────────

create or replace function public.auth_producao_arquivo_pode(p_nome text, p_acao text)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce((
    select public.auth_producao_ve_temporada(c.organizacao, c.temporada)
           and case p_acao
             when 'ler' then public.auth_producao_pasta_pode(c.organizacao, c.pasta, 'ler')
                          or public.auth_producao_pasta_pode(c.organizacao, c.pasta, 'ler_sem_assinatura')
             when 'editar' then public.auth_producao_pasta_pode(c.organizacao, c.pasta, 'editar')
           end
    from (select x.p[1]::uuid as organizacao, x.p[2]::uuid as temporada, x.p[3] as pasta
          from (select public.fn_producao_caminho_partes(p_nome) as p) x
          where x.p is not null) c
  ), false);
$$;

revoke execute on function public.auth_producao_arquivo_pode(text, text) from public, anon;
grant execute on function public.auth_producao_arquivo_pode(text, text) to authenticated;

comment on function public.auth_producao_arquivo_pode(text, text) is
  'A pessoa logada pode a ação (ler ou editar) no arquivo do bucket documentos de caminho {org}/producoes/{temporada}/{pasta}/{uuid}.{ext}? Junta o recorte da temporada e a regra da pasta (pessoas pede dinheiro). Caminho fora do formato nega.';

-- ─── 2. As regras do bucket ─────────────────────────────────────────────────

do $$
begin
  -- Restritivas: o que as regras de hoje liberam em producoes/ só vale para quem tem a produção.
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'documentos: producoes restrita (le)') then
    create policy "documentos: producoes restrita (le)" on storage.objects
      as restrictive for select to authenticated
      using (bucket_id <> 'documentos' or coalesce((storage.foldername(name))[2], '') <> 'producoes'
             or public.auth_producao_arquivo_pode(name, 'ler'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'documentos: producoes restrita (insere)') then
    create policy "documentos: producoes restrita (insere)" on storage.objects
      as restrictive for insert to authenticated
      with check (bucket_id <> 'documentos' or coalesce((storage.foldername(name))[2], '') <> 'producoes'
                  or public.auth_producao_arquivo_pode(name, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'documentos: producoes restrita (altera)') then
    create policy "documentos: producoes restrita (altera)" on storage.objects
      as restrictive for update to authenticated
      using (bucket_id <> 'documentos' or coalesce((storage.foldername(name))[2], '') <> 'producoes'
             or public.auth_producao_arquivo_pode(name, 'editar'))
      with check (bucket_id <> 'documentos' or coalesce((storage.foldername(name))[2], '') <> 'producoes'
                  or public.auth_producao_arquivo_pode(name, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'documentos: producoes restrita (apaga)') then
    create policy "documentos: producoes restrita (apaga)" on storage.objects
      as restrictive for delete to authenticated
      using (bucket_id <> 'documentos' or coalesce((storage.foldername(name))[2], '') <> 'producoes'
             or public.auth_producao_arquivo_pode(name, 'editar'));
  end if;

  -- Permissivas: o acesso da produção, pela organização do caminho.
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'documentos: producoes le') then
    create policy "documentos: producoes le" on storage.objects
      for select to authenticated
      using (bucket_id = 'documentos' and coalesce((storage.foldername(name))[2], '') = 'producoes'
             and public.auth_producao_arquivo_pode(name, 'ler'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'documentos: producoes insere') then
    create policy "documentos: producoes insere" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'documentos' and coalesce((storage.foldername(name))[2], '') = 'producoes'
                  and public.auth_producao_arquivo_pode(name, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'documentos: producoes altera') then
    create policy "documentos: producoes altera" on storage.objects
      for update to authenticated
      using (bucket_id = 'documentos' and coalesce((storage.foldername(name))[2], '') = 'producoes'
             and public.auth_producao_arquivo_pode(name, 'editar'))
      with check (bucket_id = 'documentos' and coalesce((storage.foldername(name))[2], '') = 'producoes'
                  and public.auth_producao_arquivo_pode(name, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'documentos: producoes apaga') then
    create policy "documentos: producoes apaga" on storage.objects
      for delete to authenticated
      using (bucket_id = 'documentos' and coalesce((storage.foldername(name))[2], '') = 'producoes'
             and public.auth_producao_arquivo_pode(name, 'editar'));
  end if;
end
$$;
