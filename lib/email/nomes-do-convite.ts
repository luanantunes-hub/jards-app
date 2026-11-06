import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Os dois nomes que um convite por e-mail cita: a organização e quem convida. Lidos com a sessão de quem convida
// (as regras de acesso do banco valem). As tabelas ainda estão fora do tipo gerado, daí a leitura solta aqui.

type Cliente = SupabaseClient;

export async function nomeDaOrganizacao(supabase: Cliente, organizationId: string): Promise<string | null> {
  const { data } = await supabase.from("organizations").select("nome").eq("id", organizationId).maybeSingle();
  return (data as { nome?: string | null } | null)?.nome ?? null;
}

export async function nomeDeQuemConvida(supabase: Cliente, userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return (data as { full_name?: string | null } | null)?.full_name ?? null;
}
