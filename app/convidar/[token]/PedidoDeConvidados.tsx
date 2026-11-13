"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import type { PedidoPublico } from "@/lib/producao/pedido-publico";

const CAMPO = "h-11 w-full rounded border border-black/[.14] bg-white px-3 text-[0.875rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/50 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.75rem] font-medium text-black/60";
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const quando = (dia: string) => `${DIAS[new Date(`${dia}T12:00:00`).getDay()]}, ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/** O pedido de convidados: quem pede, o tipo de credencial (com o saldo), o nome do convidado e os lugares. Sem conta. */
export function PedidoDeConvidados({ codigo, pedido }: { codigo: string; pedido: PedidoPublico }) {
  const [solicitante, setSolicitante] = useState("");
  const [nome, setNome] = useState("");
  const [afiliacao, setAfiliacao] = useState("");
  const [tipoId, setTipoId] = useState(pedido.tipos.length === 1 ? pedido.tipos[0].id : "");
  const [quantidade, setQuantidade] = useState("1");
  const [site, setSite] = useState(""); // campo escondido: gente de verdade não preenche
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviados, setEnviados] = useState<string[]>([]);
  const corte = new Date(pedido.corteEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/convidar/${encodeURIComponent(codigo)}/pedir`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ solicitante, nome, afiliacao, tipo_id: tipoId, quantidade, site }),
      });
      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };
      if (!resposta.ok) { setErro(corpo.error ?? "Não foi possível enviar agora. Tente de novo."); return; }
      setEnviados(atual => [nome.trim(), ...atual]);
      setNome(""); setAfiliacao(""); setQuantidade("1");
    } catch {
      setErro("Sem conexão. Confira a internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAFAF9] px-4 py-8">
      <div className="mx-auto max-w-[30rem]">
        <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{pedido.organizacao}</p>
        <h1 className="mt-1 text-[1.375rem] font-semibold tracking-[-.01em] text-[#282525]">{pedido.titulo ?? "Pedir convidados"}</h1>
        <p className="mt-1 text-[0.875rem] text-black/60"><strong className="font-medium text-[#282525]">{pedido.sessao}</strong>, {quando(pedido.dia)}, {pedido.inicio} às {pedido.fim}. Pedidos até {corte}. Não precisa de conta; a produção confirma depois.</p>

        {pedido.tipos.length === 0 ? (
          <p className="mt-6 rounded border bg-white px-5 py-6 text-center text-[0.8125rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.1)" }}>Ainda não há tipos de credencial para esta sessão. Fale com quem enviou o link.</p>
        ) : (
          <form onSubmit={event => { event.preventDefault(); void enviar(); }} className="mt-6 space-y-4">
            {enviados.length > 0 && (
              <div role="status" className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.1)" }}>
                <p className="flex items-center gap-2 text-[0.875rem] font-medium text-[#2E8932]"><Check size={16} aria-hidden="true" /> {enviados.length === 1 ? "Pedido enviado" : `${enviados.length} pedidos enviados`}</p>
                <p className="mt-1 text-[0.75rem] text-black/55">{enviados.join(", ")}. Pode pedir mais um convidado abaixo.</p>
              </div>
            )}
            <div>
              <label className={ROTULO} htmlFor="solicitante">Seu nome</label>
              <input id="solicitante" className={CAMPO} value={solicitante} maxLength={120} autoComplete="name" onChange={event => setSolicitante(event.target.value)} disabled={enviando} required />
            </div>
            <div>
              <span className={ROTULO}>Tipo de credencial</span>
              <Dropdown ariaLabel="Tipo de credencial" value={tipoId} onChange={setTipoId} disabled={enviando}
                options={[{ value: "", label: "Escolha o tipo" }, ...pedido.tipos.map(tipo => ({ value: tipo.id, label: `${tipo.nome}${tipo.livres === null ? "" : tipo.livres === 0 ? " (cota cheia)" : ` (${tipo.livres} ${tipo.livres === 1 ? "lugar" : "lugares"})`}` }))]} />
            </div>
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <div>
                <label className={ROTULO} htmlFor="nome">Nome do convidado</label>
                <input id="nome" className={CAMPO} value={nome} maxLength={120} onChange={event => setNome(event.target.value)} disabled={enviando} required />
              </div>
              <div>
                <label className={ROTULO} htmlFor="quantidade">Lugares</label>
                <input id="quantidade" inputMode="numeric" className={CAMPO} value={quantidade} onChange={event => setQuantidade(event.target.value.replace(/\D/g, ""))} disabled={enviando} />
              </div>
            </div>
            <div>
              <label className={ROTULO} htmlFor="afiliacao">Afiliação (opcional)</label>
              <input id="afiliacao" className={CAMPO} value={afiliacao} maxLength={120} onChange={event => setAfiliacao(event.target.value)} disabled={enviando} placeholder="Veículo, empresa ou grupo" />
              <p className="mt-1 text-[0.6875rem] text-black/45">Lugares incluem o convidado e os acompanhantes. Não escreva documento, telefone ou dados de saúde.</p>
            </div>

            {/* Armadilha para robôs: escondido de quem usa a tela e de leitor de tela. */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: "1px", height: "1px", overflow: "hidden" }}>
              <label htmlFor="site">Não preencha este campo</label>
              <input id="site" tabIndex={-1} autoComplete="off" value={site} onChange={event => setSite(event.target.value)} />
            </div>

            {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.8125rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}

            <button type="submit" disabled={enviando} className="h-12 w-full rounded bg-[#2E8932] text-[0.9375rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.99] disabled:opacity-50">
              {enviando ? "Enviando…" : "Enviar pedido"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
