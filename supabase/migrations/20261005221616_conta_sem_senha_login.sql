-- A tela de login precisa separar "senha errada" de "conta ainda sem senha": o Supabase devolve
-- o mesmo erro nos dois casos. Só a rota /api/auth/conta-sem-senha (chave de serviço) chama esta
-- função; e-mail inexistente e conta com senha dão a mesma resposta (false).

create or replace function public.fn_conta_sem_senha(p_email text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth'
as $$
  select exists (
    select 1 from auth.users u
    where lower(u.email) = lower(trim(p_email))
      and u.deleted_at is null
      and coalesce(u.encrypted_password, '') = ''
  );
$$;

revoke all on function public.fn_conta_sem_senha(text) from public, anon, authenticated;
grant execute on function public.fn_conta_sem_senha(text) to service_role;
