import { createAdminClient } from "@/lib/supabase/admin";
import type { OrigemCadastro, PrimeiroPagamento, UsuarioComOrigem } from "@/lib/origem-cadastro";

const POR_PAGINA = 1000;

// Contas com origem de campanha gravada, o primeiro pagamento de cada uma e o
// plano atual. Só para o admin: lê todos os usuários com a chave de serviço.
export async function carregarCadastrosComOrigem(): Promise<{
  usuarios: UsuarioComOrigem[];
  pagamentos: PrimeiroPagamento[];
  planos: Record<string, string | null>;
}> {
  const admin = createAdminClient();
  const usuarios: UsuarioComOrigem[] = [];

  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: POR_PAGINA });
    if (error) throw error;
    for (const usuario of data.users) {
      const origem = usuario.user_metadata?.origem_cadastro as OrigemCadastro | undefined;
      if (!origem || typeof origem !== "object") continue;
      usuarios.push({
        id: usuario.id,
        created_at: usuario.created_at,
        email_confirmed_at: usuario.email_confirmed_at ?? null,
        origem,
      });
    }
    if (data.users.length < POR_PAGINA) break;
  }

  if (usuarios.length === 0) return { usuarios, pagamentos: [], planos: {} };

  const ids = usuarios.map((usuario) => usuario.id);
  const [pagamentos, perfis] = await Promise.all([
    admin
      .from("stripe_billing_events")
      .select("user_id, processed_at")
      .in("event_type", ["invoice.paid", "invoice.payment_succeeded"])
      .in("user_id", ids),
    admin.from("profiles").select("id, plano").in("id", ids),
  ]);
  if (pagamentos.error) throw pagamentos.error;
  if (perfis.error) throw perfis.error;

  const planos: Record<string, string | null> = {};
  for (const perfil of (perfis.data ?? []) as { id: string; plano: string | null }[]) planos[perfil.id] = perfil.plano;

  usuarios.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { usuarios, pagamentos: (pagamentos.data ?? []) as PrimeiroPagamento[], planos };
}
