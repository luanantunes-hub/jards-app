// Quem pede e o banco das rotas de admin com contrato de módulo (/api/admin/modulos
// e /api/admin/piloto), e o módulo que o pedido escolhe.
//
// As rotas conferem o super admin com a sessão de quem pede e só depois usam a
// chave de serviço. As duas pontas ficam aqui, num objeto que os testes trocam por
// versões falsas, no molde de lib/equipe-servidor.ts. Em produção são sempre as de
// verdade.

import { MODULOS_COM_CONTRATO } from "@/lib/equipe-modulos";
import type { ModuloId } from "@/lib/modulos";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dependenciasDeAdmin = { createClient, createAdminClient };

/**
 * Módulo pedido numa rota de admin. Sem o campo (undefined) vale a prestação, como
 * sempre foi; qualquer outro valor que não seja um módulo com contrato (inclusive
 * null, texto vazio e a captação, que usa o plano e não tem contrato) é recusado
 * (null), nunca tratado como prestação.
 */
export function lerModuloDoContrato(valor: unknown): ModuloId | null {
  if (valor === undefined) return "prestacao";
  return MODULOS_COM_CONTRATO.find(modulo => modulo === valor) ?? null;
}
