// O convite da produção pelo link que a pessoa recebeu. Sem login: o servidor confere o código do link no banco (só o hash fica
// guardado) e, se vale, a pessoa vê só o nome da produção e responde se vai, quando chega e quando sai. Aqui não aparece dinheiro,
// equipe, outras datas nem dado de outra pessoa.

import type { Metadata } from "next";
import { AVISO_DO_LINK_DO_CONVITE, carregarConvitePublico, conferirLinkDoConvite } from "@/lib/producao/convite-publico";
import { createAdminClient } from "@/lib/supabase/admin";
import { RespostaDePresenca } from "./RespostaDePresenca";

export const metadata: Metadata = {
  title: "Convite",
  robots: { index: false, follow: false },
};

// A resposta muda a cada envio: nunca vem pronta do cache.
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

export default async function ConvitePeloLink({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let convite = null;
  let aviso: { titulo: string; texto: string } | null = null;
  try {
    const admin = createAdminClient();
    const link = await conferirLinkDoConvite(admin, token);
    if (link.situacao !== "valido" || !link.convite) aviso = AVISO_DO_LINK_DO_CONVITE[link.situacao === "valido" ? "inexistente" : link.situacao];
    else convite = await carregarConvitePublico(admin, link.convite);
  } catch {
    aviso = { titulo: "Não foi possível abrir o link", texto: "Tente de novo em instantes." };
  }
  if (aviso || !convite) return <Aviso titulo={aviso?.titulo ?? "Link não encontrado"} texto={aviso?.texto ?? "Confira o endereço que você recebeu."} />;
  return <RespostaDePresenca codigo={token} convite={convite} />;
}
