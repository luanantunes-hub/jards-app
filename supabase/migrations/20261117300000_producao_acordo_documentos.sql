-- PD4.8 (segundo corte): os documentos de habilitação de um acordo.
--
-- producao_acordo_documentos: liga um acordo a um documento da pasta de documentos (producao_documentos) da ORGANIZAÇÃO: o contrato social, as
-- certidões e a carta de exclusividade que a contraparte pede para assinar. A tela do acordo mostra a lista com a validade de cada um. Só documento
-- da organização se anexa (o de uma pessoa é dado pessoal e não vai para o acordo). O documento fica na pasta: anexar não o copia, então a validade
-- que se renova na pasta vale para todos os acordos. Tirar da lista não apaga o documento.
--
-- Acesso: o do acordo (dinheiro): lê quem pode `dinheiro`; escreve quem pode `editar` e `dinheiro`; a produção só para leitura lê pela regra "sem assinatura".
-- Sem histórico (o acordo não tem: as condições são valores).
--
-- Regras no banco: o acordo e o documento são da mesma organização (`acordo_de_outra_organizacao`, `documento_de_outra_organizacao`); só se anexa documento
-- da organização (`documento_so_da_organizacao`); não se anexa a acordo encerrado (`acordo_encerrado`); a ligação não muda (`ligacao_nao_muda`: tire e anexe de
-- novo); o mesmo documento entra uma vez por acordo. Tirar vale em qualquer situação do acordo. Apagar o acordo ou o documento leva a ligação junto.
--
-- Expansão: uma tabela nova e vazia e uma função de gatilho nova. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_acordo_documentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  acordo_id uuid not null references public.producao_acordos (id) on delete cascade,
  documento_id uuid not null references public.producao_documentos (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint producao_acordo_documentos_key unique (acordo_id, documento_id)
);

create index if not exists producao_acordo_documentos_org_idx on public.producao_acordo_documentos (organization_id);
create index if not exists producao_acordo_documentos_documento_idx on public.producao_acordo_documentos (documento_id);

create or replace function public.fn_producao_acordo_documento_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_situacao text;
  v_escopo text;
begin
  if tg_op = 'UPDATE' and (new.organization_id is distinct from old.organization_id or new.acordo_id is distinct from old.acordo_id
                           or new.documento_id is distinct from old.documento_id) then
    raise exception 'ligacao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  select a.situacao into v_situacao from public.producao_acordos a where a.id = new.acordo_id and a.organization_id = new.organization_id;
  if not found then
    raise exception 'acordo_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  select d.escopo into v_escopo from public.producao_documentos d where d.id = new.documento_id and d.organization_id = new.organization_id;
  if not found then
    raise exception 'documento_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if v_escopo <> 'organizacao' then
    raise exception 'documento_so_da_organizacao' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' and v_situacao = 'encerrado' then
    raise exception 'acordo_encerrado' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_acordo_documentos_coerencia
  before insert or update on public.producao_acordo_documentos
  for each row execute function public.fn_producao_acordo_documento_coerencia();

alter table public.producao_acordo_documentos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acordo_documentos' and policyname = 'producao_acordo_documentos: le') then
    create policy "producao_acordo_documentos: le" on public.producao_acordo_documentos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro') and exists (select 1 from public.producao_acordos a where a.id = producao_acordo_documentos.acordo_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acordo_documentos' and policyname = 'producao_acordo_documentos: leitura sem assinatura') then
    create policy "producao_acordo_documentos: leitura sem assinatura" on public.producao_acordo_documentos for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id) and exists (select 1 from public.producao_acordos a where a.id = producao_acordo_documentos.acordo_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acordo_documentos' and policyname = 'producao_acordo_documentos: insere') then
    create policy "producao_acordo_documentos: insere" on public.producao_acordo_documentos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_acordos a where a.id = producao_acordo_documentos.acordo_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acordo_documentos' and policyname = 'producao_acordo_documentos: edita') then
    create policy "producao_acordo_documentos: edita" on public.producao_acordo_documentos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_acordos a where a.id = producao_acordo_documentos.acordo_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_acordos a where a.id = producao_acordo_documentos.acordo_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acordo_documentos' and policyname = 'producao_acordo_documentos: apaga') then
    create policy "producao_acordo_documentos: apaga" on public.producao_acordo_documentos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_acordos a where a.id = producao_acordo_documentos.acordo_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_acordo_documento_coerencia() from public, anon, authenticated;
revoke all on public.producao_acordo_documentos from anon, authenticated;
grant select, insert, update, delete on public.producao_acordo_documentos to authenticated;

comment on table public.producao_acordo_documentos is
  'Os documentos de habilitação de um acordo: liga o acordo a um documento da organização da pasta de documentos. Anexar não copia o documento; tirar não o apaga.';
