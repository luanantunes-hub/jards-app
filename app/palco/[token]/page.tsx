// A tela de palco pelo link (PD7.1). Sem login: o servidor confere o código do link no banco (só o hash fica guardado), a revogação e a
// validade, e mostra só o roteiro do dia que todos veem; depois a tela se atualiza sozinha.

import type { Metadata } from "next";
import { PalcoAoVivo } from "@/components/producao/PalcoAoVivo";
import { carregarPalco, type ResultadoDoPalco } from "@/lib/producao/palco-publico";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Tela de palco",
  robots: { index: false, follow: false },
};

// O roteiro muda a cada começo e fim marcado: nunca vem pronto do cache.
export const dynamic = "force-dynamic";

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#282525] px-4 text-center text-white">
      <div className="max-w-[28rem]">
        <h1 className="text-[1.25rem] font-semibold">{titulo}</h1>
        <p className="mt-2 text-[0.9375rem] text-white/60">{texto}</p>
      </div>
    </main>
  );
}

export default async function TelaDePalcoPeloLink({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let resultado: ResultadoDoPalco | null = null;
  try {
    resultado = await carregarPalco(createAdminClient(), token);
  } catch {
    resultado = null;
  }
  if (resultado === null) return <Aviso titulo="Não foi possível abrir a tela" texto="Tente de novo em instantes." />;
  if (resultado.situacao === "revogado") return <Aviso titulo="Esta tela foi desativada" texto="Peça o endereço novo a quem enviou." />;
  if (resultado.situacao === "expirado") return <Aviso titulo="Este endereço venceu" texto="Peça um endereço novo a quem enviou." />;
  if (resultado.situacao !== "valido") return <Aviso titulo="Tela não encontrada" texto="Confira o endereço que você recebeu." />;
  return <PalcoAoVivo token={token} inicial={resultado.palco} />;
}
