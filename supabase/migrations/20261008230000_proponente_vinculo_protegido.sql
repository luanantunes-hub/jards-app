-- P5.4: o vínculo entre o cadastro do proponente e a conta é protegido.
--
-- Com o espaço do proponente, proponentes.user_id passou a dar acesso às
-- prestações do cadastro. As regras de proponentes deixam qualquer membro da
-- organização alterar o cadastro, então um proponente poderia pôr a própria
-- conta no cadastro de outro cliente. Daqui em diante, ligar, trocar ou tirar
-- a conta do cadastro cabe ao admin da organização (ou ao super admin); o
-- convite, que roda no servidor com a chave de serviço, continua ligando.
-- Idempotente.

-- Quem está logado é admin da organização.
create or replace function public.auth_admin_da_organizacao(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_jards_super_admin() or exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id and m.user_id = auth.uid() and m.papel = 'admin'
  );
$$;
revoke all on function public.auth_admin_da_organizacao(uuid) from public, anon;
grant execute on function public.auth_admin_da_organizacao(uuid) to authenticated;

-- Roda com o papel de quem escreve: o servidor (service_role) e o dono do
-- banco passam; uma conta logada só muda o vínculo se for admin.
create or replace function public.fn_proponente_vinculo_protegido()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.user_id is not distinct from old.user_id then
    return new;
  end if;
  if tg_op = 'INSERT' and new.user_id is null then
    return new;
  end if;
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.auth_admin_da_organizacao(new.organization_id)
     and (tg_op = 'INSERT' or public.auth_admin_da_organizacao(old.organization_id)) then
    return new;
  end if;
  raise exception 'vinculo_do_proponente' using errcode = '42501';
end;
$$;

drop trigger if exists trg_proponente_vinculo_protegido on public.proponentes;
create trigger trg_proponente_vinculo_protegido
  before insert or update of user_id on public.proponentes
  for each row execute function public.fn_proponente_vinculo_protegido();
