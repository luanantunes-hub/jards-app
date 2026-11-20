"use client";

import { useState } from "react";
import { Check, Megaphone } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { CANAIS_DE_DIVULGACAO, ROTULO_SEM_ORIGEM, SEM_ORIGEM, enderecoDeDivulgacao, resumirDivulgacao, type LinhaDaDivulgacao, type SessaoParaDivulgar } from "@/lib/ticketeria/divulgacao";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import { CAMPO, ROTULO } from "@/components/ticketeria/FolhasDosEventos";

// O painel Divulgação (a tela do produtor): de onde vieram as vendas, por canal, e a folha de criar um link de divulgação. Só desenho: os dados e as ações chegam por props.
// Segue o DESIGN.md da Ticketeria: rótulos pequenos em caixa alta, valores em tinta e tabulares, cantos de 12px, sem cor fora de estado e de gráfico.

const BORDA = "rgba(13,13,13,.08)";
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-3 text-[0.8125rem] text-[#282525]";
const ROTULO_PEQUENO = "text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45";
const BOTAO_FINAL = "rounded-xl acao-principal px-4 py-2.5 text-[0.75rem] font-normal text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]";
const CANCELAR = "rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

function Indicador({ rotulo, valor, apoio }: { rotulo: string; valor: string; apoio?: string }) {
  return (
    <div className="min-w-0 rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
      <p className={ROTULO_PEQUENO}>{rotulo}</p>
      <p className="mt-1.5 text-[1.5rem] font-medium tabular-nums tracking-[-.02em] text-[#282525]">{valor}</p>
      {apoio && <p className="mt-1 text-[0.6875rem] text-black/40">{apoio}</p>}
    </div>
  );
}

/** O painel: o filtro de sessão, os três números e a tabela por canal. `sessaoId` nulo é "todas as sessões". */
export function DivulgacaoDaLoja({ linhas, sessoes, sessaoId, onSessao, onCriarLink }: {
  linhas: LinhaDaDivulgacao[]; sessoes: SessaoParaDivulgar[]; sessaoId: string | null; onSessao?: (id: string | null) => void; onCriarLink?: () => void;
}) {
  const resumo = resumirDivulgacao(linhas, sessaoId);
  const maior = Math.max(1, ...resumo.canais.map(c => c.porcento));
  const total = resumo.canais.length;
  return (
    <div className="space-y-4">
      <div className="w-full max-w-sm">
        <Dropdown ariaLabel="Sessão" value={sessaoId ?? ""} onChange={v => onSessao?.(v === "" ? null : v)} options={[{ value: "", label: "Todas as sessões" }, ...sessoes.map(s => ({ value: s.id, label: `${s.evento} · ${s.quando}` }))]} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Indicador rotulo="Ingressos vendidos" valor={String(resumo.ingressos)} />
        <Indicador rotulo="Vendido" valor={formatarMoeda(resumo.vendido_centavos)} apoio="já com os descontos de cupom" />
        <Indicador rotulo={ROTULO_SEM_ORIGEM} valor={`${resumo.sem_origem_porcento}%`} apoio="quem entrou por um link sem identificação" />
      </div>
      {total === 0 ? (
        <div className="rounded-xl border bg-white" style={{ borderColor: BORDA }}>
          <div className="flex flex-col items-center px-4 py-16 text-center">
            <Megaphone size={28} className="mb-3 text-black/15" aria-hidden="true" />
            <p className="text-[0.875rem] font-medium text-black/55">Nenhuma venda ainda</p>
            <p className="mt-1.5 max-w-sm text-[0.75rem] leading-relaxed text-black/35">Crie um link de divulgação e cole onde for divulgar. Quando alguém comprar por ele, o canal aparece aqui.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
          <table className="w-full min-w-[40rem] border-collapse">
            <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Canal</th><th className={`${CABECALHO} text-right`}>Ingressos</th><th className={`${CABECALHO} text-right`}>Vendido</th><th className={CABECALHO}><span className="sr-only">Parte do total</span></th><th className={`${CABECALHO} text-right`}>Do total</th></tr></thead>
            <tbody className="divide-y divide-black/[.08]">
              {resumo.canais.map(c => (
                <tr key={c.chave}>
                  <td className={`${CELULA} ${c.chave === SEM_ORIGEM ? "text-black/50" : ""}`}>{c.rotulo}</td>
                  <td className={`${CELULA} text-right tabular-nums`}>{c.ingressos}</td>
                  <td className={`${CELULA} text-right tabular-nums`}>{formatarMoeda(c.vendido_centavos)}</td>
                  <td className={CELULA}><div className="h-2 w-44 rounded bg-[#EFECF6]" aria-hidden="true"><div className="h-2 rounded" style={{ width: `${(c.porcento / maior) * 100}%`, background: c.chave === SEM_ORIGEM ? "#CFCAD9" : "#7259B5" }} /></div></td>
                  <td className={`${CELULA} text-right tabular-nums`}>{c.porcento}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3.5" style={{ borderColor: "rgba(176,122,20,.25)", background: "#FFFBF2" }}>
        <p className="max-w-2xl text-[0.8125rem] text-black/60">Sempre que divulgar, use um link criado aqui. Assim cada venda chega com o nome do canal e você vê o que realmente trouxe gente.</p>
        <button type="button" onClick={onCriarLink} className="rounded-xl border bg-white px-3.5 py-2 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]" style={{ borderColor: BORDA }}>Criar link</button>
      </div>
    </div>
  );
}

/** A folha de criar o link: a sessão, onde vai divulgar, um nome para a ação (opcional) e o link pronto para copiar. `origem` é o endereço do Jards (do navegador; nos testes, à mão). */
export function LinkDeDivulgacaoSheet({ sessoes, origem, sessaoInicial = null, canalInicial = "instagram", acaoInicial = "", copiadoDeInicio = false, onClose }: {
  sessoes: SessaoParaDivulgar[]; origem: string; sessaoInicial?: string | null; canalInicial?: string; acaoInicial?: string; copiadoDeInicio?: boolean; onClose: () => void;
}) {
  const abertas = sessoes.filter(s => s.a_venda);
  const [sessao, setSessao] = useState(sessaoInicial && abertas.some(s => s.id === sessaoInicial) ? sessaoInicial : abertas[0]?.id ?? "");
  const [canal, setCanal] = useState(canalInicial);
  const [acao, setAcao] = useState(acaoInicial);
  const [copiado, setCopiado] = useState(copiadoDeInicio);
  const [erro, setErro] = useState(false);
  const endereco = sessao ? enderecoDeDivulgacao(origem, sessao, canal, acao) : "";

  async function copiar() {
    try { await navigator.clipboard.writeText(endereco); setErro(false); setCopiado(true); setTimeout(() => setCopiado(false), 3000); } catch { setErro(true); }
  }

  return (
    <TopSheet titulo="Criar link de divulgação" onClose={onClose} footer={fechar => (
      <>
        <button type="button" onClick={fechar} className={CANCELAR}>Cancelar</button>
        <button type="button" onClick={() => void copiar()} disabled={!sessao} className={`${BOTAO_FINAL} inline-flex items-center gap-1.5 disabled:opacity-50`} aria-live="polite">
          {copiado && <Check size={13} aria-hidden="true" />}{erro ? "Não foi possível copiar" : copiado ? "Link copiado" : "Copiar link"}
        </button>
      </>
    )}>
      <div className="space-y-4">
        <p className="text-[0.8125rem] text-black/55">Um link para colar onde você for divulgar. Quem comprar por ele fica registrado nesse canal.</p>
        {abertas.length === 0 ? (
          <p className="rounded-xl border bg-white px-3 py-2 text-[0.75rem] text-black/55" style={{ borderColor: BORDA }}>Nenhuma sessão à venda. Crie uma sessão no evento para gerar o link.</p>
        ) : (
          <>
            <div><span className={ROTULO}>Sessão</span><Dropdown ariaLabel="Sessão do link" value={sessao} onChange={setSessao} options={abertas.map(s => ({ value: s.id, label: `${s.evento} · ${s.quando}` }))} /></div>
            <div>
              <span className={ROTULO}>Onde você vai divulgar</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Onde você vai divulgar">
                {CANAIS_DE_DIVULGACAO.map(c => (
                  <button key={c.valor} type="button" onClick={() => setCanal(c.valor)} aria-pressed={canal === c.valor}
                    className={`rounded-xl border px-3 py-1.5 text-[0.8125rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${canal === c.valor ? "border-[#7259B5] bg-[#F5F2FB] font-normal text-[#1C0E33]" : "bg-white text-black/60 hover:bg-black/[.03]"}`}
                    style={canal === c.valor ? undefined : { borderColor: BORDA }}>{c.rotulo}</button>
                ))}
              </div>
            </div>
            <div><label className={ROTULO} htmlFor="dv-acao">Nome da ação (opcional)</label><input id="dv-acao" className={CAMPO} value={acao} onChange={e => setAcao(e.target.value)} placeholder="Stories do lote 2" maxLength={60} /></div>
            <div className="break-all rounded-xl bg-[#F6F5F8] px-4 py-3 text-[0.75rem] leading-relaxed text-black/60" aria-label="Link de divulgação">{endereco}</div>
          </>
        )}
      </div>
    </TopSheet>
  );
}
