"use client";

// Dados pessoais e descarte (P9.5): até quando a prestação guarda as fotos,
// os vídeos, as listas de presença e a relação de beneficiados, e, vencida a
// guarda, o descarte por quem decide, com o registro em PDF.

import { useEffect, useMemo, useState } from "react";
import { FileDown, ShieldCheck, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { blocosDoRegistro, erroDoDescarte, situacaoDoDescarte, textoDoQueSai, type PreviaDoDescarte } from "@/lib/prestacao/descarte";
import type { EnvioDaLista } from "@/lib/prestacao/envios";
import { pedirVerificacao } from "@/lib/prestacao/verificar-cliente";
import type { PrestacaoContas } from "@/lib/supabase/types";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const ROTULO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const VALOR = (n: number) => `font-semibold tabular-nums ${n ? "text-[#282525]" : "text-black/30"}`;
const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type Prestacao = Pick<PrestacaoContas, "id" | "titulo" | "identificador_oficial" | "dados_pessoais_descartados_em" | "dados_pessoais_descarte">;

export function DadosPessoaisDaPrestacao({ prestacao, regime, saude, envios, podeDecidir, onMudou }: {
  prestacao: Prestacao;
  regime: string | null;
  saude: boolean;
  envios: readonly EnvioDaLista[] | null;
  podeDecidir: boolean;
  onMudou: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { confirmDelete } = useDeleteConfirm();
  const [previa, setPrevia] = useState<{ chave: string; dados: PreviaDoDescarte | null } | null>(null);
  const [erro, setErro] = useState("");
  const [baixando, setBaixando] = useState(false);

  const situacao = envios ? situacaoDoDescarte(envios, hojeIso()) : null;
  const descarte = prestacao.dados_pessoais_descarte ?? null;
  const liberado = situacao?.fase === "liberado";
  // A prévia muda quando a guarda vence e depois de cada descarte.
  const chave = `${prestacao.id}|${liberado}|${prestacao.dados_pessoais_descartados_em ?? ""}`;

  useEffect(() => {
    if (!liberado || !podeDecidir) return;
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
    (supabase as any).rpc("fn_prestacao_descarte_previa", { p_prestacao_id: prestacao.id }).then(({ data, error }: { data: PreviaDoDescarte | null; error: { message: string } | null }) => {
      if (!ativo) return;
      setPrevia({ chave, dados: error ? null : data });
      if (error) setErro(erroDoDescarte(error.message));
    });
    return () => { ativo = false; };
  }, [chave, liberado, podeDecidir, prestacao.id, supabase]);

  const dados = previa?.chave === chave ? previa.dados : null;
  const aDescartar = dados ? dados.evidencias + dados.beneficiarios : 0;

  function descartar() {
    if (!dados) return;
    confirmDelete({
      title: descarte ? "Descartar o que entrou depois?" : "Descartar os dados pessoais?",
      description: `${textoDoQueSai(dados).join(" ")} Não dá para desfazer.`,
      confirmLabel: "Descartar",
      onConfirm: async () => {
        const resposta = await fetch(`/api/prestacoes/${prestacao.id}/descarte`, { method: "POST" });
        const corpo = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(erroDoDescarte(corpo.error));
        setErro("");
        pedirVerificacao(prestacao.id);
        onMudou();
      },
    });
  }

  async function baixarRegistro() {
    if (!descarte || !prestacao.dados_pessoais_descartados_em) return;
    setBaixando(true);
    setErro("");
    try {
      const { data: perfil } = await supabase.from("profiles").select("full_name").eq("id", descarte.ultimo.por).maybeSingle();
      const { relatorioEmPdf } = await import("@/lib/prestacao/relatorio-pdf");
      const geradoEm = new Date();
      const pdf = await relatorioEmPdf(
        blocosDoRegistro({
          prestacao: { titulo: prestacao.titulo, identificador: prestacao.identificador_oficial ?? null, regime },
          saude,
          descarte,
          descartadoEm: prestacao.dados_pessoais_descartados_em,
          por: (perfil as { full_name?: string | null } | null)?.full_name ?? null,
          geradoEm,
        }),
        `${prestacao.titulo} · registro do descarte de dados pessoais`,
      );
      const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `descarte-de-dados-pessoais-${prestacao.dados_pessoais_descartados_em.slice(0, 10)}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setErro("Não foi possível gerar o registro do descarte.");
    }
    setBaixando(false);
  }

  if (!situacao) return null;
  const botao = "inline-flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] transition focus-visible:outline-2 focus-visible:outline-offset-1 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section className="rounded border bg-white" style={BORDA} aria-labelledby="dados-pessoais-titulo">
      <div className="border-b px-4 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <h3 id="dados-pessoais-titulo" className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-black/50">
          <ShieldCheck size={13} aria-hidden /> Dados pessoais
        </h3>
      </div>
      <div className="space-y-3 px-4 py-3 text-[0.6875rem] text-black/55">
        {descarte && prestacao.dados_pessoais_descartados_em && (
          <div className="space-y-2">
            <p className="text-black/70">Descartados em {dataBr(prestacao.dados_pessoais_descartados_em)}.</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              <dt className={ROTULO}>Fotos e listas</dt><dd className={VALOR(descarte.ultimo.evidencias)}>{descarte.ultimo.evidencias}</dd>
              <dt className={ROTULO}>Beneficiados</dt><dd className={VALOR(descarte.ultimo.beneficiarios)}>{descarte.ultimo.beneficiarios}</dd>
              <dt className={ROTULO}>Envios</dt><dd className={VALOR(descarte.ultimo.envios)}>{descarte.ultimo.envios}</dd>
            </dl>
            <button type="button" onClick={baixarRegistro} disabled={baixando} className={`${botao} text-black/70 hover:bg-black/[.04] focus-visible:outline-[#7259B5]`} style={{ borderColor: "rgba(13,13,13,.12)" }}>
              <FileDown size={13} aria-hidden /> Registro do descarte (PDF)
            </button>
          </div>
        )}

        {!descarte && situacao.fase === "sem_final" && (
          <p>A guarda começa com a decisão sobre a prestação final. Vencida a guarda, as fotos, os vídeos, as listas de presença e os nomes dos beneficiados são descartados.</p>
        )}
        {!descarte && situacao.fase === "aguarda_decisao" && (
          <p>Guardados até a decisão final e o prazo de guarda do regime. Registre a decisão em Após o envio para a guarda ter data.</p>
        )}
        {situacao.fase === "em_guarda" && (
          <p>Em guarda até <span className="tabular-nums text-black/75">{dataBr(situacao.ate)}</span>. Depois, quem decide descarta as fotos, os vídeos, as listas de presença e os nomes dos beneficiados.</p>
        )}
        {liberado && !descarte && <p>A guarda terminou em <span className="tabular-nums text-black/75">{dataBr(situacao.guardaAte)}</span>: os dados pessoais já podem sair.</p>}

        {liberado && podeDecidir && dados && (aDescartar > 0 || !descarte) && (
          <div className="space-y-2">
            {descarte && <p>Entraram dados pessoais depois do descarte.</p>}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              <dt className={ROTULO}>Fotos e listas</dt><dd className={VALOR(dados.evidencias)}>{dados.evidencias}</dd>
              <dt className={ROTULO}>Com nome</dt><dd className={VALOR(dados.beneficiarios)}>{dados.beneficiarios}</dd>
            </dl>
            <button type="button" onClick={descartar} className={`${botao} text-[#B23B3B] hover:bg-black/[.04] focus-visible:outline-[#D94A4A]`} style={{ borderColor: "#D94A4A47" }}>
              <Trash2 size={13} aria-hidden /> {descarte ? "Descartar o que entrou depois" : "Descartar dados pessoais"}
            </button>
          </div>
        )}
        {liberado && !podeDecidir && !descarte && <p className="text-black/45">O responsável pela prestação ou um administrador faz o descarte.</p>}

        {erro && <p role="alert" className="text-[#B23B3B]">{erro}</p>}
      </div>
    </section>
  );
}
