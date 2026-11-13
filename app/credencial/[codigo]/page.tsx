// A credencial do convidado pelo link que ele recebeu. Sem login: o servidor confere o código no banco (só o hash fica guardado) e,
// se vale, mostra o nome, a sessão, quantas pessoas o convite admite e o QR com o código para ler na porta.

import type { Metadata } from "next";
import QRCode from "qrcode";
import { AVISO_DA_CREDENCIAL, carregarCredencialPublica, type CredencialPublica } from "@/lib/producao/credencial-publica";
import { formatarCodigo } from "@/lib/producao/credenciais";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Credencial",
  robots: { index: false, follow: false },
};

// As entradas mudam a cada leitura na porta: nunca vem pronta do cache.
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

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const quando = (dia: string) => {
  const data = new Date(`${dia}T12:00:00`);
  return `${DIAS[data.getDay()]}, ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
};

async function Credencial({ credencial }: { credencial: CredencialPublica }) {
  // O QR leva só o código (16 letras e números), que a leitura na porta entende; fundo branco e margem para a câmera ler.
  const qr = await QRCode.toString(credencial.codigo, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#282525", light: "#FFFFFF" } });
  return (
    <main className="min-h-screen bg-[#FAFAF9] px-4 py-8">
      <div className="mx-auto max-w-[24rem]">
        <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{credencial.organizacao}</p>
        <h1 className="mt-1 text-[1.375rem] font-semibold tracking-[-.01em] text-[#282525]">{credencial.nome}</h1>
        <p className="mt-0.5 text-[0.8125rem] text-black/60">{[credencial.afiliacao, credencial.tipo].filter(Boolean).join(" · ")}</p>

        <div className="mt-5 rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.1)" }}>
          <div role="img" aria-label={`QR da credencial de ${credencial.nome}`} className="mx-auto w-full max-w-[16rem] [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="mt-3 text-[1.125rem] font-semibold tabular-nums tracking-[.06em] text-[#282525]">{formatarCodigo(credencial.codigo)}</p>
          <p className="mt-1 text-[0.75rem] text-black/55">Mostre este QR na entrada. Se a câmera falhar, dite o código.</p>
        </div>

        <dl className="mt-5 space-y-2 text-[0.8125rem]">
          <div className="flex justify-between gap-4"><dt className="text-black/55">Sessão</dt><dd className="text-right font-medium text-[#282525]">{credencial.sessao}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-black/55">Quando</dt><dd className="text-right tabular-nums text-[#282525]">{quando(credencial.dia)}, {credencial.inicio} às {credencial.fim}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-black/55">Vale para</dt><dd className="text-right tabular-nums text-[#282525]">{credencial.lugares} {credencial.lugares === 1 ? "pessoa" : "pessoas"}{credencial.entradas > 0 ? ` (${credencial.entradas} já ${credencial.entradas === 1 ? "entrou" : "entraram"})` : ""}</dd></div>
        </dl>
      </div>
    </main>
  );
}

export default async function CredencialPeloLink({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  let credencial: CredencialPublica | null = null;
  let aviso: { titulo: string; texto: string } | null = null;
  try {
    const leitura = await carregarCredencialPublica(createAdminClient(), codigo);
    if (leitura.situacao === "valida") credencial = leitura.credencial;
    else aviso = AVISO_DA_CREDENCIAL[leitura.situacao];
  } catch {
    aviso = { titulo: "Não foi possível abrir a credencial", texto: "Tente de novo em instantes." };
  }
  if (aviso || !credencial) return <Aviso titulo={aviso?.titulo ?? "Credencial não encontrada"} texto={aviso?.texto ?? "Confira o endereço que você recebeu."} />;
  return <Credencial credencial={credencial} />;
}
