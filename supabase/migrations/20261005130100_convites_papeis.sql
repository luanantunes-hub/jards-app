-- P0.6: convites aceitam os mesmos papéis que os vínculos.
--
-- Em produção, organization_members aceita admin, captador, visualizador,
-- proponente, colaborador e leitor, mas organization_invitations só aceita
-- admin, captador e visualizador: convidar um e-mail novo como colaborador,
-- leitor ou proponente falha ao gravar o convite. A regra precisa ser trocada,
-- e o conector do Supabase não roda DROP; aplicar no editor SQL do projeto.
-- O restante da reconciliação dos papéis (leitor só lê, colaborador escreve)
-- continua na tarefa própria.

alter table public.organization_invitations
  drop constraint if exists organization_invitations_role_check;

alter table public.organization_invitations
  add constraint organization_invitations_role_check
  check (role in ('admin', 'captador', 'visualizador', 'proponente', 'colaborador', 'leitor'));
