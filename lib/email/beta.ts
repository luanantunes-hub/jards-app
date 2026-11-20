/**
 * Quem pode conectar o e-mail (Gmail ou Microsoft) enquanto o recurso está em beta.
 *
 * O Gmail pede uma trava de verdade: sem a verificação do Google, só 100 pessoas podem autorizar o app,
 * no total e para sempre (o limite não zera). Por isso o botão Conectar só aparece para quem a variável
 * EMAIL_BETA_LIBERADO libera. Sem a variável, ninguém; `todos`, qualquer pessoa; senão, uma lista separada
 * por vírgula de e-mails, ids de pessoa ou ids de organização. Super admin do Jards sempre pode, para testar.
 *
 * Só vale para novas conexões: quem já conectou continua sincronizando (e se desconecta pela tela).
 */
export function emailLiberadoPara(
  pessoa: { id: string; email?: string | null; superAdmin?: boolean },
  organizationId: string | null,
  configurada: string | undefined = process.env.EMAIL_BETA_LIBERADO,
): boolean {
  if (pessoa.superAdmin) return true;
  const itens = (configurada ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (itens.length === 0) return false;
  if (itens.includes("todos")) return true;
  return (
    itens.includes(pessoa.id.toLowerCase()) ||
    (!!pessoa.email && itens.includes(pessoa.email.toLowerCase())) ||
    (!!organizationId && itens.includes(organizationId.toLowerCase()))
  );
}
