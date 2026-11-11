// O acerto técnico pelo link que a produção mandou. Sem login: o servidor confere o código do link no banco (só o hash fica
// guardado) e, se vale, a casa vê só os campos que a produção deixou à vista e responde. Nada chega à ficha sem a produção
// aprovar. Aqui não aparece dinheiro, equipe, outras datas nem dado pessoal.

import type { Metadata } from "next";
import { AVISO_DO_LINK, carregarAcertoPublico, conferirLinkDoAcerto } from "@/lib/producao/acerto-publico";
import { createAdminClient } from "@/lib/supabase/admin";
import { RespostaDoAcerto } from "./RespostaDoAcerto";

export const metadata: Metadata = {
  title: "Acerto técnico",
  robots: { index: false, follow: false },
};

// A situação muda a cada resposta e a cada revisão: nunca vem pronta do cache.
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

export default async function AcertoPeloLink({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let acerto = null;
  let aviso: { titulo: string; texto: string } | null = null;
  try {
    const admin = createAdminClient();
    const link = await conferirLinkDoAcerto(admin, token);
    if (link.situacao !== "valido" || !link.acerto) aviso = AVISO_DO_LINK[link.situacao === "valido" ? "inexistente" : link.situacao];
    else acerto = await carregarAcertoPublico(admin, link.acerto);
  } catch {
    aviso = { titulo: "Não foi possível abrir o link", texto: "Tente de novo em instantes." };
  }
  if (aviso || !acerto) return <Aviso titulo={aviso?.titulo ?? "Link não encontrado"} texto={aviso?.texto ?? "Confira o endereço que você recebeu."} />;
  return <RespostaDoAcerto codigo={token} acerto={acerto} />;
}
