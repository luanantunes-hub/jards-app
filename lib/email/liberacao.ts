import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailLiberadoPara } from "./beta";

/** A pessoa pode conectar o e-mail agora? Vale a lista do beta (EMAIL_BETA_LIBERADO) e o super admin do Jards. */
export async function podeConectarEmail(
  pessoa: { id: string; email?: string | null },
  organizationId: string | null,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("jards_super_admin").eq("id", pessoa.id).maybeSingle();
  return emailLiberadoPara({ ...pessoa, superAdmin: data?.jards_super_admin === true }, organizationId);
}
