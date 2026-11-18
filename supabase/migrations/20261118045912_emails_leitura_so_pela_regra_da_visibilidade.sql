-- E-mails do CRM: a leitura passa a obedecer só à regra da visibilidade ("Só eu vejo").
--
-- A política "emails_read_org" deixava qualquer pessoa da organização ler TODOS os e-mails da organização,
-- inclusive os marcados "Só eu vejo" (visibility = 'private'), porque as políticas permissivas se somam.
-- A regra certa já existe: "emails: select own or crm organization" (a própria pessoa lê os seus, e a equipe lê
-- os que estão visíveis à organização). Sem a política antiga, só ela vale.
--
-- A tabela estava vazia (0 linhas) quando esta migration foi escrita, e a sincronização está desligada:
-- nenhum e-mail ficou exposto. A escrita continua só pelo servidor (a role authenticated só tem SELECT).

drop policy if exists "emails_read_org" on public.emails;
