import { NextRequest, NextResponse } from "next/server";
import { requireUser, resolveAuthorizedOrganizationId } from "@/lib/calendar/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { motivoDeNaoSemear } from "@/lib/exemplos/elegibilidade";

const TABELAS_DA_ORGANIZACAO = ["projetos_crm", "empresas_crm", "captacoes", "atividades", "contatos", "proponentes"] as const;

/**
 * Cria os exemplos da Captação para quem acabou de se cadastrar. Chamada pelo pop-up de boas-vindas, depois de
 * salvo. O servidor decide: quem foi convidado, quem já tem equipe ou dados e contas antigas nunca recebem.
 */
export async function POST(request: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const corpo = await request.json().catch(() => null) as { organizationId?: unknown } | null;
  const organizationId = typeof corpo?.organizationId === "string" ? corpo.organizationId : null;
  if (!organizationId) return NextResponse.json({ error: "Organização ausente" }, { status: 400 });

  try {
    const { authorized } = await resolveAuthorizedOrganizationId(organizationId);
    if (!authorized) return NextResponse.json({ error: "Sem acesso a esta organização" }, { status: 403 });

    const admin = createAdminClient();
    const email = (user.email ?? "").toLowerCase();

    const [membro, membros, convites, perfil, ...registros] = await Promise.all([
      admin.from("organization_members").select("papel").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle(),
      admin.from("organization_members").select("user_id", { count: "exact", head: true }).eq("organization_id", organizationId),
      admin.from("organization_invitations").select("id", { count: "exact", head: true })
        .or(email ? `invited_user_id.eq.${user.id},email.ilike.${email.replace(/[,()]/g, "")}` : `invited_user_id.eq.${user.id}`),
      admin.from("profiles").select("created_at").eq("id", user.id).maybeSingle(),
      ...TABELAS_DA_ORGANIZACAO.map(tabela =>
        admin.from(tabela).select("id", { count: "exact", head: true }).eq("organization_id", organizationId)),
    ]);

    const motivo = motivoDeNaoSemear({
      papelNaOrganizacao: (membro.data?.papel as string | undefined) ?? null,
      membrosDaOrganizacao: membros.count ?? 0,
      convitesRecebidos: convites.count ?? 0,
      registrosDaOrganizacao: registros.reduce((soma, r) => soma + (r.count ?? 0), 0),
      contaCriadaEm: (perfil.data?.created_at as string | undefined) ?? null,
      agora: Date.now(),
    });
    if (motivo) return NextResponse.json({ semeado: false, motivo });

    const { data, error } = await admin.rpc("fn_semear_exemplos", { p_org: organizationId, p_user: user.id });
    if (error) return NextResponse.json({ semeado: false, motivo: "falha" });
    return NextResponse.json({ semeado: data === 1 });
  } catch {
    return NextResponse.json({ semeado: false, motivo: "falha" });
  }
}
