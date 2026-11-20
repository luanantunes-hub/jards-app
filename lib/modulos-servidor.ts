// Bloqueio por módulo nos layouts de servidor (prestação e produção).
//
// Só entra quem usa o módulo em alguma organização (ou é super admin). A
// organização aberta fica no navegador, então o servidor olha todas; o
// isolamento entre organizações e entre módulos continua nas regras do banco.
// Quem não entra vai para a página de entrada dela: a da captação para quem a
// usa, a do módulo que usa para quem não a usa (destinoDeQuemNaoUsa).

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INICIO_DO_MODULO, type ModuloId } from "@/lib/modulos";
import { destinoDeQuemNaoUsa, lerAcessoAosModulos } from "@/lib/modulos-acesso";

export async function exigirModulo(modulo: ModuloId): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${INICIO_DO_MODULO[modulo]}`);

  const destino = destinoDeQuemNaoUsa(modulo, await lerAcessoAosModulos(supabase, user.id));
  if (destino) redirect(destino);
}
