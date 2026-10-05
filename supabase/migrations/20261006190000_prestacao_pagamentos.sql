-- P2.5: pagamentos da despesa.
--
-- Cada despesa (prestacao_comprovantes, P2.4) tem um ou mais pagamentos:
-- forma (PIX, TED, boleto…), data, valor, favorecido e o número do
-- documento de pagamento, que o Salic compara com o do extrato. A prestação
-- vem da despesa (gatilho), nunca de quem envia. lancamento_id liga o
-- pagamento ao lançamento do extrato e fica para a conciliação (P2.6); o
-- gatilho só aceita lançamento da mesma prestação.
--
-- Acesso igual ao das contas bancárias: lê quem acessa a prestação; cria,
-- altera e apaga quem tem o papel de editar.
-- Idempotente; sem DROP.

create table if not exists public.prestacao_pagamentos (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  despesa_id uuid not null references public.prestacao_comprovantes(id) on delete cascade,
  lancamento_id uuid references public.prestacao_lancamentos(id) on delete set null,
  forma text not null check (forma in ('pix', 'ted', 'doc', 'boleto', 'cheque', 'saque', 'cartao', 'debito_automatico', 'cambio')),
  data date not null,
  valor numeric(14, 2) not null check (valor > 0),
  -- Só letras e algarismos, como o documento do fornecedor.
  favorecido_documento text check (favorecido_documento is null or favorecido_documento ~ '^[0-9A-Z]+$'),
  favorecido_nome text,
  numero_documento text,
  observacao text,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prestacao_pagamentos_despesa_idx on public.prestacao_pagamentos (despesa_id);
create index if not exists prestacao_pagamentos_prestacao_idx on public.prestacao_pagamentos (prestacao_id, data);
create index if not exists prestacao_pagamentos_lancamento_idx
  on public.prestacao_pagamentos (lancamento_id) where lancamento_id is not null;

-- A prestação vem da despesa; o lançamento, quando houver, é da mesma prestação.
create or replace function public.fn_prestacao_pagamento_da_despesa()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select c.prestacao_id into new.prestacao_id
    from public.prestacao_comprovantes c
   where c.id = new.despesa_id;
  if new.prestacao_id is null then
    raise exception 'despesa_inexistente' using errcode = 'no_data_found';
  end if;
  if new.lancamento_id is not null and not exists (
    select 1 from public.prestacao_lancamentos l
     where l.id = new.lancamento_id and l.prestacao_id = new.prestacao_id
  ) then
    raise exception 'lancamento_de_outra_prestacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_pagamentos_da_despesa'
                 and tgrelid = 'public.prestacao_pagamentos'::regclass) then
    create trigger prestacao_pagamentos_da_despesa
      before insert or update of despesa_id, lancamento_id, prestacao_id on public.prestacao_pagamentos
      for each row execute function public.fn_prestacao_pagamento_da_despesa();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_pagamentos_updated_at'
                 and tgrelid = 'public.prestacao_pagamentos'::regclass) then
    create trigger prestacao_pagamentos_updated_at
      before update on public.prestacao_pagamentos
      for each row execute function public.set_prestacao_updated_at();
  end if;
end
$$;

-- ─── Acesso ─────────────────────────────────────────────────────────────────

alter table public.prestacao_pagamentos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_pagamentos'
                 and policyname = 'prestacao_pagamentos: acesso pela prestacao') then
    create policy "prestacao_pagamentos: acesso pela prestacao" on public.prestacao_pagamentos
      for all to authenticated
      using (public.can_access_prestacao(prestacao_id))
      with check (public.can_access_prestacao(prestacao_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_pagamentos'
                 and policyname = 'prestacao_pagamentos: papel insere') then
    create policy "prestacao_pagamentos: papel insere" on public.prestacao_pagamentos
      as restrictive for insert to authenticated
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_pagamentos: papel edita" on public.prestacao_pagamentos
      as restrictive for update to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'))
      with check (public.auth_prestacao_pode(prestacao_id, 'editar'));
    create policy "prestacao_pagamentos: papel apaga" on public.prestacao_pagamentos
      as restrictive for delete to authenticated
      using (public.auth_prestacao_pode(prestacao_id, 'editar'));
  end if;
end
$$;
