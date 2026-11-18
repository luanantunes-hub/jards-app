// Quem edita a Ticketeria, pelo papel na organização: o espelho, na tela, de auth_ticketeria_pode(org, 'editar') do banco
// (supabase/migrations/*_ticketeria_lojas_site.sql): quem não é leitor, captador nem proponente. Quem decide é o banco; a tela só
// esconde o que a pessoa não pode fazer.

const PAPEIS_QUE_EDITAM = new Set(["admin", "colaborador", "visualizador"]);

export function podeEditarATicketeria(papel: string | null): boolean {
  return papel !== null && PAPEIS_QUE_EDITAM.has(papel);
}
