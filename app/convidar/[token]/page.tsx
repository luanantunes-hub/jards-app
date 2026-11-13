// O pedido de convidados pelo link que a pessoa recebeu. Sem login: o servidor confere o código do link no banco (só o hash fica
// guardado) e o corte; se vale, a pessoa vê o nome da produção, a sessão e os tipos de credencial com o saldo, e pede o convidado pelo
// nome. Aqui não aparece quem já foi convidado, dinheiro nem equipe.

import type { Metadata } from "next";
import { AVISO_DO_LINK_DE_PEDIDOS, carregarPedidoPublico, conferirLinkDePedidos, type PedidoPublico } from "@/lib/producao/pedido-publico";
import { createAdminClient } from "@/lib/supabase/admin";
import { PedidoDeConvidados } from "./PedidoDeConvidados";

export const metadata: Metadata = {
  title: "Pedir convidados",
  robots: { index: false, follow: false },
};

// O saldo muda a cada pedido: nunca vem pronto do cache.
export const dynamic = "force-dynamic";

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAF9] px-4">
      <div className="max-w-[28rem] rounded border bg-white px-6 py-8 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <h1 className="text-[1.0625rem] font-semibold text-[#282525]">{titulo}</h1>
        <p className="mt-2 text-[0.8125rem] text-black/55">{texto}</p>
      </div>
    </main>
  );
}

export default async function PedirPeloLink({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let pedido: PedidoPublico | null = null;
  let aviso: { titulo: string; texto: string } | null = null;
  try {
    const admin = createAdminClient();
    const conferido = await conferirLinkDePedidos(admin, token);
    if (conferido.situacao !== "valido" || !conferido.link) aviso = AVISO_DO_LINK_DE_PEDIDOS[conferido.situacao === "valido" ? "inexistente" : conferido.situacao];
    else pedido = await carregarPedidoPublico(admin, conferido.link);
  } catch {
    aviso = { titulo: "Não foi possível abrir o link", texto: "Tente de novo em instantes." };
  }
  if (aviso || !pedido) return <Aviso titulo={aviso?.titulo ?? "Link não encontrado"} texto={aviso?.texto ?? "Confira o endereço que você recebeu."} />;
  return <PedidoDeConvidados codigo={token} pedido={pedido} />;
}
