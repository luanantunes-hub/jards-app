-- PD0.14: arquivos da produção no banco (a tabela, as regras de acesso e o histórico).
--
-- Rider técnico, planta de palco, acordo assinado, documento de uma pessoa, passagem,
-- voucher de hotel, o que um parceiro enviou: o arquivo mora no bucket "documentos", no
-- caminho {organização}/producoes/{temporada}/{pasta}/{uuid}.{ext}, e tem uma linha em
-- producao_arquivos (a temporada, a data se houver, a pasta, o nome original, o tipo, o
-- tamanho, a impressão digital sha256 e quem enviou). As regras do bucket vêm na migration
-- seguinte, producao_arquivos_armazenamento, que precisa desta na frente. A forma do caminho,
-- a lista das nove pastas e a das extensões aceitas têm uma única definição para o app e para
-- as edge functions, em supabase/functions/_shared/producao-caminho.ts; esta migration a
-- repete em fn_producao_caminho_partes e nas restrições da tabela, e
-- tests/producao-arquivos-sql.test.ts compara as duas pontas.
--
-- Expansão: cria uma tabela, três funções, três gatilhos, cinco regras de acesso e quatro
-- índices, e acrescenta o ramo da tabela a auth_producao_ve_historico (create or replace, a
-- mesma assinatura, o resto do texto igual). Nada do que existe para a captação e a prestação
-- muda. Aditiva, reaplicável e sem DROP. Nenhuma organização tem a produção ainda (0 contratos
-- e 0 vínculos em 15/10/2026) e o módulo segue escondido no app: hoje ninguém passa a ver nem
-- a escrever nada.
--
-- ─── Acesso (receita da PD0.7a) ─────────────────────────────────────────────
--   ler        auth_producao_pasta_pode(org, pasta, 'ler') ou 'ler_sem_assinatura' (duas
--              regras de leitura, a normal e a da produção só para leitura, como nas outras
--              tabelas) e o recorte auth_producao_ve_temporada(org, temporada)
--   escrever   auth_producao_pasta_pode(org, pasta, 'editar') e o mesmo recorte; vale para
--              inserir, alterar e apagar. O leitor e o módulo só para leitura não escrevem;
--              captador, proponente, quem não tem o módulo, outra organização e o visitante
--              não leem nem escrevem
-- A pasta `pessoas` (documento de uma pessoa: passaporte, RG, saúde...) é dado pessoal e só
-- se abre a quem pode `dinheiro` (auth_producao_pode(org, 'dinheiro'): o admin e quem tem a
-- função "vê o dinheiro"): ler pede `dinheiro`, escrever pede `editar` e `dinheiro`, e na
-- leitura sem assinatura vale auth_producao_dinheiro_sem_assinatura. Essa regra mora numa
-- função só, auth_producao_pasta_pode, que as regras desta tabela e as do bucket chamam: a
-- tabela e o arquivo não podem discordar.
--
-- ─── O que o navegador altera ───────────────────────────────────────────────
-- Só o nome (renomear) e a data a que o arquivo se liga (a mesma temporada, ou nenhuma). O
-- resto descreve os bytes que estão no bucket e não muda: troque o arquivo apagando e enviando
-- outro. O privilégio de alterar é por coluna (nome, data_id) e o gatilho de coerência repete a
-- trava, para valer também para a chave de serviço. `enviado_por` é quem está logado
-- (padrão auth.uid(), e o gatilho recusa outro valor); só some, se a conta for apagada.
--
-- ─── Apagar ─────────────────────────────────────────────────────────────────
-- Temporada e data com arquivo não se apagam: as duas chaves recusam (23503), conferidas no
-- fim da transação (deferrable initially deferred) para o apagamento da organização inteira,
-- que apaga o pai antes do filho, passar. Apagar a data ou a temporada em cascata deixaria no
-- bucket arquivos sem registro, e desligar a data (set null) alteraria a linha do arquivo
-- no meio do apagamento da organização, quando o histórico já não tem onde gravar. Primeiro se
-- apagam os arquivos (a linha e o objeto), depois a data. A organização apaga as linhas, mas
-- não os objetos do bucket: quem apaga uma organização limpa o caminho dela no bucket.
-- Uma data não muda de temporada hoje, e nada confere o contrário: se a PD1.x passar a mover
-- datas, solte ou recuse antes os arquivos ligados a ela.
--
-- ─── Histórico (PD0.10) ─────────────────────────────────────────────────────
-- Liga o gatilho fn_producao_historico à tabela e acrescenta o ramo em
-- auth_producao_ve_historico: quem lê o arquivo lê o histórico dele (um arquivo da pasta
-- pessoas, só quem pode `dinheiro`). Ficam fora do histórico o nome (na pasta pessoas pode ser
-- o de uma pessoa), o caminho, a impressão digital e quem enviou (o quem da linha "criou" já
-- diz); o rótulo de criar e apagar é a pasta. Sobra o que importa: enviou, ligou a outra data,
-- apagou. O histórico de um arquivo apagado segue guardado e a retenção dele é decisão do dono
-- (política de dados pessoais).

set local lock_timeout = '10s';

-- ─── 1. O caminho, lido pelo banco ──────────────────────────────────────────
-- {organização, temporada, pasta, arquivo, extensão} de um caminho no formato do bucket, ou
-- nulo para qualquer outro. A mesma expressão de PADRAO_DO_CAMINHO, do código.

create or replace function public.fn_producao_caminho_partes(p_nome text)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select regexp_match(p_nome, '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/producoes/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/(datas|pessoas|acordos|plantas|itens|documentos|deslocamentos|hospedagem|recebidos)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(pdf|doc|docx|odt|rtf|txt|xls|xlsx|ods|csv|ppt|pptx|odp|jpg|jpeg|png|webp|gif|heic|heif|tif|tiff|dwg|dxf|mp3|wav|m4a|mp4|mov|zip)$');
$$;

-- ─── 2. A tabela ────────────────────────────────────────────────────────────

create table if not exists public.producao_arquivos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- O arquivo é de uma temporada. Temporada com arquivo não se apaga (ver "Apagar").
  temporada_id uuid not null references public.producao_temporadas (id) deferrable initially deferred,
  -- Opcional: o arquivo de uma data (o rider, o mapa de palco). Tem de ser da mesma temporada.
  data_id uuid references public.producao_datas (id) deferrable initially deferred,
  -- Uma das nove pastas fixas (PASTAS_DE_ARQUIVO); a pasta pessoas só abre a quem pode `dinheiro`.
  pasta text not null,
  -- O caminho no bucket "documentos": {organização}/producoes/{temporada}/{pasta}/{uuid}.{ext}.
  storage_path text not null,
  -- O nome que o arquivo tinha quando a pessoa o enviou (só para mostrar; nunca vai para o caminho).
  nome text not null,
  -- O tipo MIME, em minúsculas; o app manda application/octet-stream quando o navegador não diz.
  tipo text not null,
  tamanho bigint not null,
  -- A impressão digital do conteúdo (SHA-256, em hexadecimal minúsculo), calculada por quem envia.
  sha256 text not null,
  -- Quem enviou. Apagar a conta só zera o campo.
  enviado_por uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_arquivos_storage_path_key unique (storage_path),
  constraint producao_arquivos_pasta_check check (pasta in ('datas', 'pessoas', 'acordos', 'plantas', 'itens', 'documentos', 'deslocamentos', 'hospedagem', 'recebidos')),
  constraint producao_arquivos_storage_path_check check (public.fn_producao_caminho_partes(storage_path) is not null),
  constraint producao_arquivos_nome_check check (char_length(btrim(nome)) between 1 and 255 and nome !~ '[/\\]' and nome !~ '[[:cntrl:]]'),
  constraint producao_arquivos_tipo_check check (tipo ~ '^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$'),
  constraint producao_arquivos_tamanho_check check (tamanho > 0),
  constraint producao_arquivos_sha256_check check (sha256 ~ '^[0-9a-f]{64}$')
);

create index if not exists producao_arquivos_org_idx on public.producao_arquivos (organization_id);
create index if not exists producao_arquivos_temporada_idx on public.producao_arquivos (temporada_id, pasta, created_at desc);
create index if not exists producao_arquivos_data_idx on public.producao_arquivos (data_id) where data_id is not null;
create index if not exists producao_arquivos_enviado_por_idx on public.producao_arquivos (enviado_por) where enviado_por is not null;

-- ─── 3. Quem pode, numa pasta ───────────────────────────────────────────────
-- Ações: ler (módulo em vigor), ler_sem_assinatura (módulo só para leitura) e editar. Pasta ou
-- ação desconhecida nega. Não confere o recorte da temporada: quem chama junta
-- auth_producao_ve_temporada.

create or replace function public.auth_producao_pasta_pode(p_org uuid, p_pasta text, p_acao text)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(case
    when p_pasta = 'pessoas' then case p_acao
      when 'ler' then public.auth_producao_pode(p_org, 'dinheiro')
      when 'ler_sem_assinatura' then public.auth_producao_dinheiro_sem_assinatura(p_org)
      when 'editar' then public.auth_producao_pode(p_org, 'editar') and public.auth_producao_pode(p_org, 'dinheiro')
    end
    when p_pasta in ('datas', 'acordos', 'plantas', 'itens', 'documentos', 'deslocamentos', 'hospedagem', 'recebidos') then case p_acao
      when 'ler' then public.auth_producao_pode(p_org, 'ler')
      when 'ler_sem_assinatura' then public.auth_producao_le_sem_assinatura(p_org)
      when 'editar' then public.auth_producao_pode(p_org, 'editar')
    end
  end, false);
$$;

-- ─── 4. Coerência ───────────────────────────────────────────────────────────
-- Roda com a permissão do dono para enxergar a temporada e a data mesmo quando a regra delas
-- não deixaria a pessoa vê-las; só diz se existe na mesma organização, e a mesma recusa serve
-- para "não existe" e "é de outra". Ao inserir: o caminho tem a forma do bucket e bate com a
-- organização, a temporada e a pasta da linha; a temporada e a data são da organização; a data
-- é da mesma temporada; quem envia é quem está logado. Ao alterar: só o nome e a data mudam, e
-- a data nova segue a regra de cima. Erros (check_violation): organizacao_nao_muda,
-- temporada_do_arquivo_nao_muda, arquivo_nao_muda, enviado_por_nao_muda, caminho_invalido,
-- caminho_de_outra_organizacao, caminho_de_outra_temporada, caminho_de_outra_pasta,
-- enviado_por_invalido, temporada_de_outra_organizacao, data_de_outra_organizacao,
-- data_de_outra_temporada.

create or replace function public.fn_producao_arquivo_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_partes text[];
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
    end if;
    if new.temporada_id is distinct from old.temporada_id then
      raise exception 'temporada_do_arquivo_nao_muda' using errcode = 'check_violation';
    end if;
    if new.pasta is distinct from old.pasta or new.storage_path is distinct from old.storage_path
       or new.tipo is distinct from old.tipo or new.tamanho is distinct from old.tamanho
       or new.sha256 is distinct from old.sha256 then
      raise exception 'arquivo_nao_muda' using errcode = 'check_violation';
    end if;
    -- Quem enviou só some (a conta foi apagada), nunca vira outra pessoa.
    if new.enviado_por is distinct from old.enviado_por and new.enviado_por is not null then
      raise exception 'enviado_por_nao_muda' using errcode = 'check_violation';
    end if;
    if new.data_id is not distinct from old.data_id then
      return new;
    end if;
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if tg_op = 'INSERT' then
    v_partes := public.fn_producao_caminho_partes(new.storage_path);
    if v_partes is null then
      raise exception 'caminho_invalido' using errcode = 'check_violation';
    end if;
    if v_partes[1]::uuid is distinct from new.organization_id then
      raise exception 'caminho_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if v_partes[2]::uuid is distinct from new.temporada_id then
      raise exception 'caminho_de_outra_temporada' using errcode = 'check_violation';
    end if;
    if v_partes[3] is distinct from new.pasta then
      raise exception 'caminho_de_outra_pasta' using errcode = 'check_violation';
    end if;
    -- Sem usuário (a chave de serviço, uma rotina), quem envia é o que a rotina disser.
    if auth.uid() is not null and new.enviado_por is distinct from auth.uid() then
      raise exception 'enviado_por_invalido' using errcode = 'check_violation';
    end if;
    if not exists (
      select 1 from public.producao_temporadas t where t.id = new.temporada_id and t.organization_id = new.organization_id
    ) then
      raise exception 'temporada_de_outra_organizacao' using errcode = 'check_violation';
    end if;
  end if;
  if new.data_id is not null then
    if not exists (
      select 1 from public.producao_datas d where d.id = new.data_id and d.organization_id = new.organization_id
    ) then
      raise exception 'data_de_outra_organizacao' using errcode = 'check_violation';
    end if;
    if not exists (
      select 1 from public.producao_datas d where d.id = new.data_id and d.temporada_id = new.temporada_id
    ) then
      raise exception 'data_de_outra_temporada' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- ─── 5. Gatilhos ────────────────────────────────────────────────────────────

create or replace trigger producao_arquivos_coerencia
  before insert or update on public.producao_arquivos
  for each row execute function public.fn_producao_arquivo_coerencia();
create or replace trigger producao_arquivos_updated_at
  before update on public.producao_arquivos
  for each row execute function public.fn_producao_updated_at();

-- ─── 6. Histórico (PD0.10) ──────────────────────────────────────────────────
-- A lista de exclusão leva o nome, o caminho, a impressão digital e quem enviou; o rótulo é a pasta.

create or replace trigger producao_arquivos_historico
  after insert or update or delete on public.producao_arquivos
  for each row execute function public.fn_producao_historico('enviado_por,nome,sha256,storage_path', 'pasta');

-- O texto da PD0.10 (20261015125431_producao_historico.sql) com o ramo novo no fim; a função
-- roda com a permissão de quem consulta, então o histórico de um arquivo da pasta pessoas só
-- aparece a quem lê o arquivo.
create or replace function public.auth_producao_ve_historico(p_org uuid, p_entidade text, p_entidade_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(case p_entidade
    when 'producao_obras' then exists (select 1 from public.producao_obras x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_temporadas' then exists (select 1 from public.producao_temporadas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_datas' then exists (select 1 from public.producao_datas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_blocos' then exists (select 1 from public.producao_blocos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_espacos' then exists (select 1 from public.producao_espacos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_salas' then exists (select 1 from public.producao_salas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_funcoes' then exists (select 1 from public.producao_funcoes x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_arquivos' then exists (select 1 from public.producao_arquivos x where x.id = p_entidade_id and x.organization_id = p_org)
  end, false);
$$;

-- ─── 7. Regras de acesso ────────────────────────────────────────────────────

alter table public.producao_arquivos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_arquivos'
                 and policyname = 'producao_arquivos: le') then
    create policy "producao_arquivos: le" on public.producao_arquivos for select to authenticated
      using (public.auth_producao_pasta_pode(organization_id, pasta, 'ler') and public.auth_producao_ve_temporada(organization_id, temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_arquivos'
                 and policyname = 'producao_arquivos: leitura sem assinatura') then
    create policy "producao_arquivos: leitura sem assinatura" on public.producao_arquivos for select to authenticated
      using (public.auth_producao_pasta_pode(organization_id, pasta, 'ler_sem_assinatura') and public.auth_producao_ve_temporada(organization_id, temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_arquivos'
                 and policyname = 'producao_arquivos: insere') then
    create policy "producao_arquivos: insere" on public.producao_arquivos for insert to authenticated
      with check (public.auth_producao_pasta_pode(organization_id, pasta, 'editar') and public.auth_producao_ve_temporada(organization_id, temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_arquivos'
                 and policyname = 'producao_arquivos: edita') then
    create policy "producao_arquivos: edita" on public.producao_arquivos for update to authenticated
      using (public.auth_producao_pasta_pode(organization_id, pasta, 'editar') and public.auth_producao_ve_temporada(organization_id, temporada_id))
      with check (public.auth_producao_pasta_pode(organization_id, pasta, 'editar') and public.auth_producao_ve_temporada(organization_id, temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_arquivos'
                 and policyname = 'producao_arquivos: apaga') then
    create policy "producao_arquivos: apaga" on public.producao_arquivos for delete to authenticated
      using (public.auth_producao_pasta_pode(organization_id, pasta, 'editar') and public.auth_producao_ve_temporada(organization_id, temporada_id));
  end if;
end
$$;

-- ─── 8. Quem executa e quem acessa ──────────────────────────────────────────
-- As regras da tabela e a restrição do caminho chamam as duas funções com a permissão de quem
-- está logado, então authenticated precisa executá-las; o visitante nunca. O gatilho roda sem
-- que a pessoa precise de execute. auth_producao_ve_historico mantém os privilégios que tinha.

revoke execute on function public.fn_producao_caminho_partes(text) from public, anon;
revoke execute on function public.auth_producao_pasta_pode(uuid, text, text) from public, anon;
revoke execute on function public.fn_producao_arquivo_coerencia() from public, anon, authenticated;
grant execute on function public.fn_producao_caminho_partes(text) to authenticated;
grant execute on function public.auth_producao_pasta_pode(uuid, text, text) to authenticated;

-- O visitante não toca na tabela; quem está logado só passa pelas regras, e altera só o nome e a data.
revoke all on public.producao_arquivos from anon, authenticated;
grant select, insert, delete on public.producao_arquivos to authenticated;
grant update (nome, data_id) on public.producao_arquivos to authenticated;

comment on table public.producao_arquivos is
  'Um arquivo da produção no bucket documentos ({organização}/producoes/{temporada}/{pasta}/{uuid}.{ext}): a temporada, a data se houver, a pasta, o nome original, o tipo, o tamanho e o sha256. A pasta pessoas só abre a quem pode dinheiro. Temporada e data com arquivo não se apagam. O navegador altera só o nome e a data.';
comment on function public.fn_producao_caminho_partes(text) is
  'Organização, temporada, pasta, arquivo e extensão de um caminho do bucket documentos no formato da produção, ou nulo. A mesma expressão de PADRAO_DO_CAMINHO, em supabase/functions/_shared/producao-caminho.ts.';
comment on function public.auth_producao_pasta_pode(uuid, text, text) is
  'A pessoa logada pode a ação (ler, ler_sem_assinatura, editar) na pasta de arquivos da produção da organização? A pasta pessoas pede dinheiro. Não confere o recorte da temporada.';
