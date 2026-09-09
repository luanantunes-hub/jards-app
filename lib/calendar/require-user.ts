import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  }
  return { user, response: null };
}

export async function resolveAuthorizedOrganizationId(requestedId: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("auth_org_ids");
  if (error) throw new Error("Não foi possível validar a organização do usuário");

  const organizationIds = (data as unknown as string[] | null) ?? [];
  if (requestedId) {
    return organizationIds.includes(requestedId)
      ? { authorized: true as const, organizationId: requestedId }
      : { authorized: false as const, organizationId: null };
  }

  return {
    authorized: organizationIds.length > 0,
    organizationId: organizationIds[0] ?? null,
  };
}
