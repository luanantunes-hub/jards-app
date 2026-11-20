// A programação pública de um espaço, pelo link. Sem login: o servidor confere o código do link no banco (só o hash fica
// guardado) e mostra só as sessões das pautas confirmadas: dia, hora, título e sala.

import type { Metadata } from "next";
import { ProgramacaoPublicaView } from "@/components/producao/ProgramacaoPublicaView";
import { carregarProgramacaoPublica, type ResultadoDaProgramacao } from "@/lib/producao/programacao-publica";
import { createAdminClient } from "@/lib/supabase/admin";
import { filtroDoEndereco } from "@/lib/producao/programacao-vistas";

export const metadata: Metadata = {
  title: "Programação",
  robots: { index: false, follow: false },
};

// A programação muda a cada sessão marcada: nunca vem pronta do cache.
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

export default async function ProgramacaoPeloLink({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ sala?: string | string[]; dia?: string | string[] }> }) {
  const { token } = await params;
  const filtro = filtroDoEndereco(await searchParams);
  let resultado: ResultadoDaProgramacao | null = null;
  try {
    resultado = await carregarProgramacaoPublica(createAdminClient(), token);
  } catch {
    resultado = null;
  }
  if (resultado === null) return <Aviso titulo="Não foi possível abrir a programação" texto="Tente de novo em instantes." />;
  if (resultado.situacao === "revogado") return <Aviso titulo="Esta programação foi desativada" texto="Peça o endereço novo a quem enviou." />;
  if (resultado.situacao !== "valido") return <Aviso titulo="Programação não encontrada" texto="Confira o endereço que você recebeu." />;
  return <ProgramacaoPublicaView programacao={resultado.programacao} embutida={false} codigo={token} filtro={filtro} />;
}
