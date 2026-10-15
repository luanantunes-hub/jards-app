import { createAdminClient } from "@/lib/supabase/admin";

/* O schema ainda não foi regenerado com a tabela de auditoria. */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type AdminAuditInput = {
  actorUserId: string;
  organizationId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  targetUserId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

/**
 * A auditoria nunca deve interromper a operação principal.
 * As rotas já validam o administrador antes de chamar esta função.
 * `cliente` é o banco com a chave de serviço que a rota já abriu (os testes das
 * rotas passam um falso); sem ele, a função abre o dela.
 */
export async function writeAdminAuditLog(input: AdminAuditInput, cliente?: any): Promise<void> {
  try {
    const admin = cliente ?? createAdminClient();
    await admin.from("admin_audit_logs").insert({
      actor_user_id: input.actorUserId,
      organization_id: input.organizationId ?? null,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId ?? null,
      target_user_id: input.targetUserId ?? null,
      summary: input.summary.slice(0, 500),
      metadata: input.metadata ?? {},
    });
  } catch {
    // Falha na auditoria não pode derrubar uma ação administrativa válida.
  }
}
