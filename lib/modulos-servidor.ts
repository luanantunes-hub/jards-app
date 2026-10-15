// Módulos da pessoa vistos pelo servidor: os layouts de bloqueio (prestação,
// produção) e a entrada no app (proxy.ts). Sem next/headers, para o proxy
// poder usar; quem chama passa o cliente do Supabase com a sessão.

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { destinoDoBloqueio, INICIO_DO_MODULO, vinculoDaLinha, type LinhaVinculo, type ModuloId, type VinculosLidos } from "@/lib/modulos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- colunas fora do tipo Database até a P0.5
type Cliente = SupabaseClient<any>;

/** Perfil e vínculos da pessoa em todas as organizações, lidos com as regras do banco. */
export async function lerVinculos(supabase: Cliente, userId: string): Promise<VinculosLidos> {
  try {
    const [perfil, membros] = await Promise.all([
      supabase.from("profiles").select("jards_super_admin").eq("id", userId).maybeSingle(),
      supabase
        .from("organization_members")
        .select("papel, modulos_acesso, organizations(modulos_ativos, modulos_leitura)")
        .eq("user_id", userId),
    ]);
    const linhas = membros.error ? [] : ((membros.data ?? []) as LinhaVinculo[]);
    return {
      superAdmin: perfil.data?.jards_super_admin === true,
      vinculos: linhas.map(vinculoDaLinha),
      captador: linhas.some(linha => linha.papel === "captador"),
      erro: Boolean(perfil.error || membros.error),
    };
  } catch {
    return { superAdmin: false, vinculos: [], captador: false, erro: true };
  }
}

/**
 * Bloqueio de um módulo no layout de servidor: só entra quem usa o módulo em
 * alguma organização (ou é super admin). A organização aberta fica no
 * navegador, então o isolamento entre organizações continua nas regras do banco.
 */
export async function exigirModulo(supabase: Cliente, modulo: ModuloId): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${INICIO_DO_MODULO[modulo]}`);
  const destino = destinoDoBloqueio(modulo, await lerVinculos(supabase, user.id));
  if (destino) redirect(destino);
}
