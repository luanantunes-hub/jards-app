// A programação pública para embutir no site da casa (iframe). Mesmo conteúdo da página /programacao/[código], sem o nome da
// organização. É a única página que o navegador deixa abrir dentro de outro site (veja next.config.ts).

import type { Metadata } from "next";
import { ProgramacaoPublicaView } from "@/components/producao/ProgramacaoPublicaView";
import { carregarProgramacaoPublica, type ResultadoDaProgramacao } from "@/lib/producao/programacao-publica";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Programação",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProgramacaoParaEmbutir({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let resultado: ResultadoDaProgramacao | null = null;
  try {
    resultado = await carregarProgramacaoPublica(createAdminClient(), token);
  } catch {
    resultado = null;
  }
  if (resultado === null || resultado.situacao !== "valido") {
    return <main className="bg-white px-4 py-5"><p className="text-[0.875rem] text-black/55">{resultado === null ? "Não foi possível carregar a programação agora." : "Programação indisponível."}</p></main>;
  }
  return <ProgramacaoPublicaView programacao={resultado.programacao} embutida />;
}
