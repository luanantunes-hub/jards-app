"use client";

import { useId, useMemo, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { montarCaminhoPrestacao } from "@/lib/prestacao/armazenamento";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { prazoDaAnalise, rotuloTipoAlteracao } from "@/lib/prestacao/alteracoes";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";
import type { AlteracaoSalva } from "./EditorAlteracao";

export type AcaoDeDecisao = "aplicar" | "solicitar" | "aprovar" | "negar" | "reabrir";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "w-full rounded border border-black/[.12] px-3 py-2 text-[0.8125rem] outline-none transition focus:border-[#7259B5] focus-visible:ring-2 focus-visible:ring-[#7259B5]/20";
const dataBR = (d: string) => d.split("-").reverse().join("/");

function hojeEmBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

const TITULO: Record<AcaoDeDecisao, string> = {
  aplicar: "Aplicar a alteração",
  solicitar: "Registrar o pedido ao órgão",
  aprovar: "Registrar a aprovação",
  negar: "Registrar a negativa",
  reabrir: "Voltar para rascunho",
};

const BOTAO: Record<AcaoDeDecisao, string> = {
  aplicar: "Aplicar",
  solicitar: "Registrar pedido",
  aprovar: "Registrar e aplicar",
  negar: "Registrar negativa",
  reabrir: "Voltar para rascunho",
};

/**
 * Registra o andamento de uma alteração pela função do banco
 * (fn_prestacao_alteracao_registrar). Aplicar e aprovar mudam o vigente dos
 * itens na hora; o documento da aprovação vai para a pasta da prestação.
 */
export function DecisaoAlteracao({ alteracao, acao, regime, prestacaoId, organizationId, onClose, onDone }: {
  alteracao: AlteracaoSalva;
  acao: AcaoDeDecisao;
  regime: RegimeNormativo | null;
  prestacaoId: string;
  organizationId: string | null;
  onClose: () => void;
  onDone: (mensagem: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const titleId = useId();
  useModalDismiss(onClose);

  const prazo = prazoDaAnalise(regime, alteracao.solicitada_em);
  const hoje = hojeEmBrasilia();
  const [data, setData] = useState(hoje);
  const [texto, setTexto] = useState("");
  const [tacita, setTacita] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const itens = alteracao.movimentos.length;
  const prazoNovo = acao === "solicitar" ? prazoDaAnalise(regime, data || null) : null;

  async function registrar() {
    if (acao === "negar" && !texto.trim()) { setErro("Informe o motivo da negativa."); return; }
    setSalvando(true);
    setErro("");
    let documento: string | null = null;
    if (arquivo) {
      if (!organizationId) { setSalvando(false); setErro("A prestação ainda está carregando. Tente de novo."); return; }
      documento = montarCaminhoPrestacao({ organizationId, prestacaoId, pasta: { tipo: "alteracoes" }, nomeOriginal: arquivo.name });
      const envio = await supabase.storage.from("documentos").upload(documento, arquivo, { upsert: false });
      if (envio.error) { setSalvando(false); setErro("Não foi possível enviar o documento."); return; }
    }
    const ato = acao === "aprovar" ? (texto.trim() || (tacita ? "Sem resposta do órgão no prazo" : "")) : texto.trim();
    const { error } = await supabase.rpc("fn_prestacao_alteracao_registrar" as never, {
      p_alteracao_id: alteracao.id,
      p_acao: acao === "aprovar" ? "aplicar" : acao,
      p_data: acao === "reabrir" ? null : data || null,
      p_texto: ato || null,
      p_documento: documento,
      p_tacita: acao === "aprovar" && tacita,
    } as never);
    setSalvando(false);
    if (error) {
      if (documento) await supabase.storage.from("documentos").remove([documento]);
      setErro(error.message?.includes("sem_permissao")
        ? "Pedir, aplicar e registrar a decisão cabem ao administrador ou ao responsável pela prestação."
        : mensagemErroPrestacao(error, "Não foi possível registrar"));
      return;
    }
    onDone({
      aplicar: `Alteração nº ${alteracao.numero} aplicada: o vigente dos itens mudou.`,
      solicitar: `Pedido nº ${alteracao.numero} registrado.${prazoNovo ? ` O órgão tem até ${dataBR(prazoNovo)}.` : ""}`,
      aprovar: `Alteração nº ${alteracao.numero} aprovada e aplicada.`,
      negar: `Negativa do pedido nº ${alteracao.numero} registrada.`,
      reabrir: `Alteração nº ${alteracao.numero} voltou para rascunho.`,
    }[acao]);
  }

  const vermelho = acao === "negar";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full max-w-[30rem] flex-col overflow-hidden rounded bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div>
            <h2 id={titleId} className="text-[0.875rem] font-semibold text-[#0D0D0D]">{TITULO[acao]}</h2>
            <p className="text-[0.6875rem] text-black/40">Nº {alteracao.numero} · {rotuloTipoAlteracao(alteracao.tipo)} · {itens} {itens === 1 ? "item" : "itens"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded p-1.5 text-black/35 transition hover:bg-black/5 hover:text-black/55 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {(acao === "aplicar" || acao === "aprovar") && (
            <p className="text-[0.75rem] leading-5 text-black/60">
              O vigente dos itens muda agora, pelo remanejado, e a alteração passa a valer na prestação{alteracao.movimentos.some(m => !m.no_id) ? "; os itens novos entram no orçamento" : ""}.
            </p>
          )}
          {acao === "reabrir" && (
            <p className="text-[0.75rem] leading-5 text-black/60">O pedido volta para rascunho e o protocolo registrado sai. Use quando o pedido não foi protocolado ou precisa ser refeito.</p>
          )}

          {acao !== "reabrir" && (
            <label className="block">
              <span className={ROTULO}>{{ aplicar: "Data", solicitar: "Data do protocolo", aprovar: "Data da aprovação", negar: "Data da negativa" }[acao]}</span>
              <input type="date" value={data} max={hoje} onChange={e => setData(e.target.value)} className={CAMPO} />
            </label>
          )}

          {acao === "solicitar" && (
            <>
              <label className="block">
                <span className={ROTULO}>Protocolo ou número da solicitação</span>
                <input value={texto} onChange={e => setTexto(e.target.value)} className={CAMPO} placeholder={regime?.sistemaOficial ? `Ex.: solicitação no ${regime.sistemaOficial}` : "Opcional"} />
              </label>
              {prazoNovo && (
                <p className="text-[0.6875rem] leading-4 text-black/50">O órgão tem até {dataBR(prazoNovo)} para analisar; sem resposta, a alteração pode ser executada.</p>
              )}
            </>
          )}

          {acao === "aprovar" && (
            <>
              <label className="block">
                <span className={ROTULO}>Ato da aprovação</span>
                <input value={texto} onChange={e => setTexto(e.target.value)} className={CAMPO} placeholder="Ex.: Portaria nº 45, parecer, ofício" />
              </label>
              <label className="flex items-start gap-2 text-[0.75rem] text-black/65">
                <input type="checkbox" checked={tacita} onChange={e => setTacita(e.target.checked)} className="mt-0.5 accent-[#7259B5]" />
                <span>
                  O órgão não respondeu no prazo
                  <span className="block text-[0.625rem] text-black/40">
                    {prazo ? `O prazo ${prazo < hoje ? "venceu" : "vence"} em ${dataBR(prazo)}.` : "Confira o prazo na norma."}
                    {regime?.prazos.analiseAlteracao ? ` ${regime.prazos.analiseAlteracao.fonte.documento}, ${regime.prazos.analiseAlteracao.fonte.dispositivo}.` : ""}
                  </span>
                </span>
              </label>
              <div>
                <span className={ROTULO}>Documento da aprovação</span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded border bg-white px-3 text-[0.75rem] text-black/65 transition hover:border-black/25 focus-within:outline-2 focus-within:outline-[#7259B5]" style={{ borderColor: "rgba(13,13,13,.14)" }}>
                    <Paperclip size={13} aria-hidden />
                    {arquivo ? "Trocar arquivo" : "Escolher arquivo"}
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setArquivo(e.target.files?.[0] ?? null)} className="sr-only" />
                  </label>
                  <span className="min-w-0 truncate text-[0.6875rem] text-black/50">{arquivo ? arquivo.name : "PDF ou imagem, opcional"}</span>
                </div>
              </div>
            </>
          )}

          {acao === "negar" && (
            <label className="block">
              <span className={ROTULO}>Motivo *</span>
              <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3} className={`${CAMPO} resize-y`} placeholder="O que o órgão alegou" />
            </label>
          )}

          {erro && (
            <p role="alert" className="rounded border px-3 py-2 text-[0.75rem]" style={{ background: "#fff", borderColor: "#D94A4A30", color: "#B23B3B" }}>{erro}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-4 border-t px-6 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button
            type="button"
            onClick={registrar}
            disabled={salvando}
            className={`flex items-center gap-1.5 rounded px-5 py-2 text-[0.8125rem] font-semibold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 ${vermelho ? "bg-[#D94A4A] hover:bg-[#C03E3E] focus-visible:outline-[#D94A4A]" : "bg-[#2E8932] hover:bg-[#26752A] focus-visible:outline-[#2E8932]"}`}
          >
            {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
            {BOTAO[acao]}
          </button>
        </div>
      </div>
    </div>
  );
}
