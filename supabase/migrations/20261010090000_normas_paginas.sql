-- P6.1: o vigia normativo passa a acompanhar páginas e arquivos dos órgãos.
--
-- Além do Diário Oficial (P1.10), normas_fontes guarda páginas e arquivos: a
-- lei compilada no Planalto, a instrução normativa consolidada no site do
-- órgão, a página de manuais e modelos, o PDF de um manual. Todo dia a rotina
-- jards-agente-paginas chama a função agente-normativo no modo "paginas", que
-- coleta as fontes vencidas pela frequência de cada uma
-- (supabase/functions/_shared/vigia-paginas.ts). Quando o texto ou a lista de
-- arquivos muda, a versão nova entra em normas_documentos com a cópia do que
-- foi baixado no bucket normas e a ligação com a versão anterior, para a
-- diferença lado a lado em /admin/normas.
--
-- A primeira coleta de uma fonte, ou a seguinte a uma troca de recorte, é a
-- referência: fica guardada sem pedir conferência. Fonte sem resposta em 3
-- coletas seguidas vira aviso ao super admin.

-- ─── Fontes ─────────────────────────────────────────────────────────────────

alter table public.normas_fontes drop constraint if exists normas_fontes_tipo_check;
alter table public.normas_fontes
  add constraint normas_fontes_tipo_check check (tipo in ('dou_inlabs', 'pagina', 'arquivo'));

alter table public.normas_fontes
  add column if not exists orgao text check (char_length(orgao) <= 200),
  add column if not exists area text check (area in ('cultura', 'esporte', 'audiovisual', 'saude', 'outro')),
  -- Códigos dos regimes (prestacao_regimes.codigo) que a fonte sustenta.
  add column if not exists regimes text[] not null default '{}',
  add column if not exists frequencia_dias integer not null default 7 check (frequencia_dias between 1 and 90),
  add column if not exists ultimo_hash text,
  add column if not exists ultima_mudanca_em timestamptz,
  add column if not exists ultimo_erro text check (char_length(ultimo_erro) <= 1000),
  add column if not exists falhas_seguidas integer not null default 0 check (falhas_seguidas >= 0),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists normas_fontes_url_idx on public.normas_fontes (url) where tipo <> 'dou_inlabs';

-- ─── Versões guardadas ──────────────────────────────────────────────────────

-- Uma lei compilada passa de 200 mil caracteres; acima de 1 milhão, a fonte
-- precisa de recorte (a PRC 5 inteira tem 4,4 milhões).
alter table public.normas_documentos drop constraint if exists normas_documentos_texto_check;
alter table public.normas_documentos
  add constraint normas_documentos_texto_check check (char_length(texto) <= 1000000);

alter table public.normas_documentos drop constraint if exists normas_documentos_situacao_check;
alter table public.normas_documentos
  add constraint normas_documentos_situacao_check check (situacao in ('novo', 'conferido', 'descartado', 'referencia'));

alter table public.normas_documentos
  add column if not exists formato text,
  -- Caminho da cópia no bucket normas: <fonte>/<data>-<hash>.<extensão>.
  add column if not exists arquivo text,
  -- Arquivos ligados à página: [{ nome, url }].
  add column if not exists arquivos jsonb not null default '[]'::jsonb,
  add column if not exists anterior_id uuid references public.normas_documentos(id) on delete set null,
  add column if not exists execucao_id uuid references public.agente_execucoes(id) on delete set null,
  -- Data de atualização que a página mostra; não entra no hash.
  add column if not exists atualizado_na_fonte text check (char_length(atualizado_na_fonte) <= 100);

create index if not exists normas_documentos_fonte_idx on public.normas_documentos (fonte_id, created_at desc);
create index if not exists normas_documentos_execucao_idx on public.normas_documentos (execucao_id) where execucao_id is not null;

-- ─── Coletas ────────────────────────────────────────────────────────────────

alter table public.agente_execucoes drop constraint if exists agente_execucoes_agente_check;
alter table public.agente_execucoes
  add constraint agente_execucoes_agente_check check (agente in ('vigia_dou', 'vigia_paginas'));

-- Fontes que chegaram a 3 falhas seguidas nesta coleta (uma vez por sequência).
alter table public.agente_execucoes
  add column if not exists fontes_sem_resposta text[] not null default '{}';

-- ─── Cópias ─────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit)
values ('normas', 'normas', false, 41943040)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'normas: super admin le') then
    create policy "normas: super admin le" on storage.objects
      for select to authenticated
      using (bucket_id = 'normas' and public.is_jards_super_admin());
  end if;
end
$$;

-- ─── Cadastro das fontes ────────────────────────────────────────────────────
-- O super admin inclui e edita páginas e arquivos. Fonte não se apaga (as
-- versões guardadas iriam junto): pausa. Do Diário Oficial, só pausa.
-- Trocar o recorte zera o hash: a coleta seguinte vira a nova referência.

create or replace function public.fn_normas_fonte_salvar(p_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fonte public.normas_fontes%rowtype;
  v_nome text := btrim(coalesce(p_dados->>'nome', ''));
  v_url text := btrim(coalesce(p_dados->>'url', ''));
  v_tipo text := coalesce(p_dados->>'tipo', 'pagina');
  v_orgao text := nullif(btrim(coalesce(p_dados->>'orgao', '')), '');
  v_area text := nullif(p_dados->>'area', '');
  v_frequencia integer := coalesce((p_dados->>'frequencia_dias')::integer, 7);
  v_ativa boolean := coalesce((p_dados->>'ativa')::boolean, true);
  v_regimes text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_dados->'regimes', '[]'::jsonb))), '{}');
  v_recorte jsonb := case when nullif(btrim(coalesce(p_dados->>'recorte_de', '')), '') is null then null
                          else jsonb_strip_nulls(jsonb_build_object(
                            'de', btrim(p_dados->>'recorte_de'),
                            'ate', nullif(btrim(coalesce(p_dados->>'recorte_ate', '')), ''))) end;
  v_configuracao jsonb;
  v_id uuid;
begin
  if not public.is_jards_super_admin() then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  if p_id is not null then
    select * into v_fonte from public.normas_fontes where id = p_id for update;
    if not found then raise exception 'fonte_inexistente' using errcode = 'P0002'; end if;
    if v_fonte.tipo = 'dou_inlabs' then
      update public.normas_fontes set ativa = v_ativa, updated_at = now() where id = p_id;
      return p_id;
    end if;
  end if;

  if char_length(v_nome) not between 3 and 200 then raise exception 'nome_invalido' using errcode = '22023'; end if;
  if v_url !~ '^https?://[^\s/]+\.[^\s]+$' or char_length(v_url) > 1000 then raise exception 'url_invalida' using errcode = '22023'; end if;
  if v_tipo not in ('pagina', 'arquivo') then raise exception 'tipo_invalido' using errcode = '22023'; end if;
  if v_area is not null and v_area not in ('cultura', 'esporte', 'audiovisual', 'saude', 'outro') then
    raise exception 'area_invalida' using errcode = '22023';
  end if;
  if v_frequencia not between 1 and 90 then raise exception 'frequencia_invalida' using errcode = '22023'; end if;
  if char_length(coalesce(v_orgao, '')) > 200
     or char_length(coalesce(v_recorte->>'de', '')) > 200 or char_length(coalesce(v_recorte->>'ate', '')) > 200 then
    raise exception 'texto_longo' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_regimes) r(codigo)
             where not exists (select 1 from public.prestacao_regimes pr where pr.codigo = r.codigo)) then
    raise exception 'regime_inexistente' using errcode = '22023';
  end if;

  begin
    if p_id is null then
      insert into public.normas_fontes (codigo, nome, tipo, url, ativa, configuracao, orgao, area, regimes, frequencia_dias)
      values (v_tipo || '_' || left(md5(v_url || clock_timestamp()::text), 10), v_nome, v_tipo, v_url, v_ativa,
              case when v_recorte is null then '{}'::jsonb else jsonb_build_object('recorte', v_recorte) end,
              v_orgao, v_area, v_regimes, v_frequencia)
      returning id into v_id;
    else
      v_configuracao := case when v_recorte is null then v_fonte.configuracao - 'recorte'
                             else v_fonte.configuracao || jsonb_build_object('recorte', v_recorte) end;
      update public.normas_fontes
      set nome = v_nome, tipo = v_tipo, url = v_url, ativa = v_ativa, configuracao = v_configuracao,
          orgao = v_orgao, area = v_area, regimes = v_regimes, frequencia_dias = v_frequencia,
          ultimo_hash = case when v_configuracao->'recorte' is distinct from v_fonte.configuracao->'recorte' then null else ultimo_hash end,
          falhas_seguidas = case when v_url <> v_fonte.url then 0 else falhas_seguidas end,
          ultimo_erro = case when v_url <> v_fonte.url then null else ultimo_erro end,
          updated_at = now()
      where id = p_id
      returning id into v_id;
    end if;
  exception when unique_violation then
    raise exception 'url_repetida' using errcode = '23505';
  end;
  return v_id;
end;
$$;
revoke all on function public.fn_normas_fonte_salvar(uuid, jsonb) from public, anon;
grant execute on function public.fn_normas_fonte_salvar(uuid, jsonb) to authenticated;

-- ─── Aviso ao super admin ───────────────────────────────────────────────────
-- Igual ao da P1.10 para o Diário; para as páginas, as mudanças da coleta e
-- as fontes que pararam de responder.

create or replace function public.fn_normas_avisar(p_execucao_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_execucao public.agente_execucoes%rowtype;
  v_titulo text;
  v_mensagem text;
  v_prioridade text := 'normal';
  v_sem_resposta integer;
  v_avisos integer := 0;
  v_pessoa record;
begin
  select * into v_execucao from public.agente_execucoes where id = p_execucao_id;
  if not found then return 0; end if;
  v_sem_resposta := coalesce(array_length(v_execucao.fontes_sem_resposta, 1), 0);

  if v_execucao.agente = 'vigia_paginas' then
    if v_execucao.situacao = 'falhou' then
      v_titulo := 'Vigia das páginas dos órgãos falhou';
      v_mensagem := 'A coleta de ' || to_char(v_execucao.referencia, 'DD/MM/YYYY') || ' não terminou: '
        || coalesce(v_execucao.detalhe, 'sem detalhe') || '.';
      v_prioridade := 'alta';
    elsif v_execucao.novos > 0 then
      v_titulo := 'Páginas dos órgãos: ' || v_execucao.novos
        || case when v_execucao.novos = 1 then ' mudança para conferir' else ' mudanças para conferir' end;
      select string_agg(d.nome, '; ' order by d.created_at) into v_mensagem
      from (select f.nome, doc.created_at from public.normas_documentos doc
            join public.normas_fontes f on f.id = doc.fonte_id
            where doc.execucao_id = p_execucao_id and doc.situacao = 'novo'
            order by doc.created_at limit 3) d;
      v_mensagem := coalesce(v_mensagem, 'Páginas que podem mudar uma regra dos regimes.');
      if v_sem_resposta > 0 then
        v_mensagem := v_mensagem || '. Sem resposta há 3 coletas: ' || array_to_string(v_execucao.fontes_sem_resposta, '; ');
      end if;
    elsif v_sem_resposta > 0 then
      v_titulo := case when v_sem_resposta = 1 then 'Uma fonte vigiada não responde'
                       else v_sem_resposta || ' fontes vigiadas não respondem' end;
      v_mensagem := array_to_string(v_execucao.fontes_sem_resposta, '; ') || ': sem resposta há 3 coletas seguidas.';
    else
      return 0;
    end if;
  elsif v_execucao.situacao = 'falhou' then
    v_titulo := 'Vigia do Diário Oficial falhou';
    v_mensagem := 'A coleta de ' || to_char(v_execucao.referencia, 'DD/MM/YYYY') || ' não terminou: '
      || coalesce(v_execucao.detalhe, 'sem detalhe') || '.';
    v_prioridade := 'alta';
  elsif v_execucao.novos > 0 then
    v_titulo := 'Diário Oficial de ' || to_char(v_execucao.referencia, 'DD/MM') || ': '
      || v_execucao.novos || case when v_execucao.novos = 1 then ' ato para conferir' else ' atos para conferir' end;
    select string_agg(coalesce(nullif(d.titulo, ''), d.tipo_ato || ' de ' || split_part(d.orgao, '/', 1)), '; ' order by d.created_at)
      into v_mensagem
    from (select * from public.normas_documentos
          where publicado_em = v_execucao.referencia and situacao = 'novo' and fonte_id = v_execucao.fonte_id
          order by created_at limit 3) d;
    v_mensagem := coalesce(v_mensagem, 'Atos que podem mudar uma regra dos regimes.');
  else
    return 0;
  end if;

  for v_pessoa in
    select p.id,
           (select m.organization_id from public.organization_members m
            where m.user_id = p.id order by m.created_at limit 1) as organizacao
    from public.profiles p
    where p.jards_super_admin
  loop
    perform public.fn_emit_notification(
      'normas_vigia', v_pessoa.organizacao, v_pessoa.id,
      v_titulo, left(v_mensagem, 240), '/admin/normas', 'sistema', v_prioridade,
      'agente_execucao', v_execucao.id, null,
      'normas_vigia:' || v_execucao.id || ':' || v_pessoa.id,
      jsonb_build_object('novos', v_execucao.novos, 'situacao', v_execucao.situacao, 'agente', v_execucao.agente), null);
    v_avisos := v_avisos + 1;
  end loop;
  return v_avisos;
end;
$$;
revoke all on function public.fn_normas_avisar(uuid) from public, anon, authenticated;
grant execute on function public.fn_normas_avisar(uuid) to service_role;

-- ─── Rotina diária ──────────────────────────────────────────────────────────
-- Mesmo endereço e segredo do cofre da P1.10, com {"modo": "paginas"}.

create or replace function public.fn_agente_paginas_disparar()
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
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-agente-segredo', v_segredo),
    body := jsonb_build_object('modo', 'paginas'),
    timeout_milliseconds := 300000);
end;
$$;
revoke all on function public.fn_agente_paginas_disparar() from public, anon, authenticated;

-- 9h37 em Brasília, longe da coleta do Diário (8h07 e 11h07).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'jards-agente-paginas') then
      perform cron.unschedule('jards-agente-paginas');
    end if;
    perform cron.schedule('jards-agente-paginas', '37 12 * * *', 'select public.fn_agente_paginas_disparar();');
  end if;
end
$$;

-- ─── Fontes iniciais ────────────────────────────────────────────────────────
-- As páginas e arquivos que os regimes citam (lib/prestacao/regimes), mais as
-- leis de base compiladas no Planalto. Os atos do Diário Oficial ficam com a
-- fonte dou_secao1: não mudam depois de publicados.

insert into public.normas_fontes (codigo, nome, tipo, url, orgao, area, regimes, frequencia_dias, configuracao)
values
  ('planalto_lei_8313', 'Lei 8.313/1991 (Lei Rouanet), compilada', 'pagina',
   'https://www.planalto.gov.br/ccivil_03/leis/l8313cons.htm', 'Presidência da República', 'cultura',
   array['rouanet_in29_2026'], 7, '{}'),
  ('minc_in_29_2026', 'IN MinC 29/2026, com as alterações', 'pagina',
   'https://www.gov.br/cultura/pt-br/acesso-a-informacao/legislacao-e-normativas/instrucao-normativa-minc-no-29-de-29-de-janeiro-de-2026',
   'Ministério da Cultura', 'cultura', array['rouanet_in29_2026'], 7, '{}'),
  ('planalto_lc_222', 'LC 222/2025 (incentivo ao esporte), compilada', 'pagina',
   'https://www.planalto.gov.br/ccivil_03/leis/lcp/Lcp222.htm', 'Presidência da República', 'esporte',
   array['lie_p10_2026', 'lie_p424_2020'], 7, '{}'),
  ('planalto_decreto_12861', 'Decreto 12.861/2026 (regulamenta a LC 222)', 'pagina',
   'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/D12861.htm', 'Presidência da República', 'esporte',
   array['lie_p10_2026'], 7, '{}'),
  ('mesp_lie_modelos_manuais', 'Modelos e manuais da LIE', 'pagina',
   'https://www.gov.br/esporte/pt-br/acoes-e-programas-1/lei-de-incentivo-ao-esporte/modelos-e-manuais-3',
   'Ministério do Esporte', 'esporte', array['lie_p10_2026', 'lie_p424_2020'], 7, '{}'),
  ('saude_prc5_anexo_lxxxvi', 'PRC GM/MS 5/2017, Anexo LXXXVI e LXXXVI-A (Pronon e Pronas/PCD)', 'pagina',
   'https://bvsms.saude.gov.br/bvs/saudelegis/gm/2017/prc0005_03_10_2017_comp.html', 'Ministério da Saúde', 'saude',
   array['pronon_pronas_lxxxvi_a_2025', 'pronon_pronas_lxxxvi_2017'], 7,
   '{"recorte": {"de": "ANEXO LXXXVI", "ate": "ANEXO LXXXVII"}}'),
  ('planalto_lei_12715', 'Lei 12.715/2012 (Pronon e Pronas/PCD), compilada', 'pagina',
   'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12715.htm', 'Presidência da República', 'saude',
   array['pronon_pronas_lxxxvi_a_2025', 'pronon_pronas_lxxxvi_2017'], 7, '{}'),
  ('planalto_decreto_7988', 'Decreto 7.988/2013 (regulamenta o Pronon e o Pronas/PCD)', 'pagina',
   'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7988.htm', 'Presidência da República', 'saude',
   array['pronon_pronas_lxxxvi_a_2025'], 14, '{}'),
  ('saude_edital_pronon_3_2025', 'Edital 3/2025 do Pronon, com a minuta do Termo de Compromisso', 'arquivo',
   'https://www.gov.br/saude/pt-br/acesso-a-informacao/participacao-social/chamamentos-publicos/2025/chamamento-publico-no-03-2025-se-pronon/edital',
   'Ministério da Saúde', 'saude', array['pronon_pronas_lxxxvi_a_2025'], 14, '{}'),
  ('ancine_in_159', 'IN ANCINE 159/2021, consolidada', 'pagina',
   'https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-159',
   'ANCINE', 'audiovisual', array['ancine_in159_2021', 'ancine_in150_2019'], 7, '{}'),
  ('ancine_manuais_prestacao', 'Manuais de prestação de contas da ANCINE', 'pagina',
   'https://www.gov.br/ancine/pt-br/assuntos/atribuicoes-ancine/fomento/prestacao-de-contas/manuais',
   'ANCINE', 'audiovisual', array['ancine_in159_2021', 'ancine_in150_2019'], 7, '{}'),
  ('ancine_manual_str', 'Manual do STR (planilhas)', 'arquivo',
   'https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/ManualdoSTRVerso2.2v_30_09_2025.pdf/@@display-file/file',
   'ANCINE', 'audiovisual', array['ancine_in159_2021'], 14, '{}'),
  ('ancine_manual_logomarca', 'Manual de Aplicação da Logomarca da ANCINE', 'arquivo',
   'https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/ManualdeAplicacaodeLogomarcav.0324agosto22.pdf/@@display-file/file',
   'ANCINE', 'audiovisual', array['ancine_in159_2021'], 30, '{}'),
  ('ancine_faq_spr', 'Perguntas frequentes da Superintendência de Prestação de Contas', 'pagina',
   'https://www.gov.br/ancine/pt-br/acesso-a-informacao/perguntas-frequentes1/superintendencia-de-prestacao-de-contas-spr',
   'ANCINE', 'audiovisual', array['ancine_in159_2021'], 14, '{}'),
  ('planalto_mp_2228', 'MP 2.228-1/2001 (ANCINE e fomento ao audiovisual), compilada', 'pagina',
   'https://www.planalto.gov.br/ccivil_03/mpv/2228-1.htm', 'Presidência da República', 'audiovisual',
   array['ancine_in159_2021', 'ancine_in150_2019'], 14, '{}'),
  ('planalto_lei_8685', 'Lei 8.685/1993 (Lei do Audiovisual), compilada', 'pagina',
   'https://www.planalto.gov.br/ccivil_03/leis/l8685.htm', 'Presidência da República', 'audiovisual',
   array['ancine_in159_2021', 'ancine_in150_2019'], 14, '{}')
on conflict (codigo) do nothing;

update public.normas_fontes set orgao = 'Imprensa Nacional', area = null
where codigo = 'dou_secao1' and orgao is null;
