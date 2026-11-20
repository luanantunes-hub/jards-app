// Envio de arquivos pelo link que o assistente (Claude ou ChatGPT) deu. Sem login: o servidor confere o código do link no
// banco (só o hash fica guardado) e, se vale, a pessoa manda as notas, os comprovantes ou as fotos direto para o Storage.
// Nada da prestação aparece aqui além do nome da organização e do projeto, e só enquanto o link vale.

import type { Metadata } from "next";
import { AVISO_DO_LINK, conferirLink } from "@/lib/mcp/prestacao/envio-publico";
import { dependenciasDaRota } from "@/lib/mcp/rota";
import { EnvioDeArquivos } from "./EnvioDeArquivos";

export const metadata: Metadata = {
  title: "Enviar arquivos",
  robots: { index: false, follow: false },
};

// O link muda de situação a cada envio e a cada minuto: nunca vem pronto do cache.
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

export default async function EnvioPeloLink({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let link;
  try {
    link = await conferirLink(dependenciasDaRota.criarAdmin(), token);
  } catch {
    return <Aviso titulo="Não foi possível abrir o link" texto="Tente de novo em instantes." />;
  }
  if (link.situacao !== "valido" || !link.sessao || !link.prestacao) {
    const aviso = AVISO_DO_LINK[link.situacao === "valido" ? "inexistente" : link.situacao];
    return <Aviso titulo={aviso.titulo} texto={aviso.texto} />;
  }

  return (
    <EnvioDeArquivos
      codigo={token}
      destino={link.sessao.destino}
      organizacao={link.prestacao.organizacao}
      titulo={link.prestacao.titulo}
      restantes={Math.max(link.sessao.max_arquivos - link.sessao.enviados, 0)}
      expiraEm={link.sessao.expira_em}
    />
  );
}
