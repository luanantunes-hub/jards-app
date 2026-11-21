"use client";

import { UsersRound } from "lucide-react";
import { FILTROS_DO_PUBLICO, whatsappEmTexto, type ContatoDoPublico, type FiltroDoPublico, type NovidadesDoContato, type ResumoDoPublico } from "@/lib/ticketeria/publico";
import { CAMPO } from "@/components/ticketeria/FolhasDosEventos";

// O Público (a tela do produtor): quem comprou ou entrou na lista de espera, com o aceite de novidades. Só desenho: os dados e as ações chegam por props.
// Segue o DESIGN.md da Ticketeria: rótulos pequenos em caixa alta, valores em tinta e tabulares, etiquetas de borda leve, cantos de 12px, sem texto explicativo.

const BORDA = "rgba(13,13,13,.08)";
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-3 text-[0.8125rem] text-[#282525]";
const ROTULO_PEQUENO = "text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45";

const ETIQUETA: Record<NovidadesDoContato, { texto: string; cor: string }> = {
  aceitou: { texto: "ACEITOU", cor: "#2E8932" }, sem_aceite: { texto: "SEM ACEITE", cor: "#B07A14" }, so_espera: { texto: "SÓ AVISO DA ESPERA", cor: "#B07A14" }, saiu: { texto: "SAIU DA LISTA", cor: "#6b6767" }, declarado: { texto: "DECLARADO POR VOCÊ", cor: "#2E8932" },
};

function Etiqueta({ texto, cor }: { texto: string; cor: string }) {
  return <span className="inline-flex shrink-0 rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={{ borderColor: cor + "47", color: cor }}>{texto}</span>;
}

function Indicador({ rotulo, valor, apoio }: { rotulo: string; valor: string; apoio?: string }) {
  return (
    <div className="min-w-0 rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
      <p className={ROTULO_PEQUENO}>{rotulo}</p>
      <p className="mt-1.5 text-[1.5rem] font-medium tabular-nums tracking-[-.02em] text-[#282525]">{valor}</p>
      {apoio && <p className="mt-1 text-[0.6875rem] text-black/40">{apoio}</p>}
    </div>
  );
}

/** "12/11", no fuso de Brasília. */
const diaEMes = (iso: string) => { try { return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(iso)); } catch { return iso; } };

export function PublicoDaLoja({ resumo, contatos, filtro, busca, onFiltrar, onBuscar }: {
  resumo: ResumoDoPublico; contatos: ContatoDoPublico[]; filtro: FiltroDoPublico; busca: string; onFiltrar?: (f: FiltroDoPublico) => void; onBuscar?: (texto: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador rotulo="Contatos" valor={resumo.contatos.toLocaleString("pt-BR")} />
        <Indicador rotulo="Aceitaram novidades" valor={resumo.aceitaram.toLocaleString("pt-BR")} apoio={resumo.contatos > 0 ? `${resumo.aceitaram_porcento}% dos contatos` : undefined} />
        <Indicador rotulo="Com WhatsApp" valor={resumo.com_whatsapp.toLocaleString("pt-BR")} />
        <Indicador rotulo="Saíram da lista" valor={resumo.sairam.toLocaleString("pt-BR")} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar contatos">
          {FILTROS_DO_PUBLICO.map(([id, rotulo]) => (
            <button key={id} type="button" aria-pressed={filtro === id} onClick={() => onFiltrar?.(id)} className={`h-8 rounded-xl border px-3 text-[0.75rem] font-normal transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${filtro === id ? "border-[#7259B5]/40 text-[#7259B5]" : "border-black/[.12] text-black/55 hover:bg-black/[.04]"}`}>{rotulo}</button>
          ))}
        </div>
        <div className="ml-auto w-full sm:w-64"><input aria-label="Buscar por nome ou e-mail" className={CAMPO} value={busca} onChange={e => onBuscar?.(e.target.value)} placeholder="Buscar por nome ou e-mail" /></div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        {contatos.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-20 text-center">
            <UsersRound size={28} className="mb-3 text-black/15" aria-hidden="true" />
            <p className="text-[0.875rem] font-medium text-black/55">{resumo.contatos === 0 ? "Nenhum contato ainda" : "Nenhum contato aqui"}</p>
          </div>
        ) : (
          <table className="w-full min-w-[46rem] border-collapse">
            <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Contato</th><th className={CABECALHO}>Veio de</th><th className={`${CABECALHO} text-right`}>Ingressos</th><th className={CABECALHO}>Última compra</th><th className={CABECALHO}><span className="sr-only">Novidades</span></th></tr></thead>
            <tbody className="divide-y divide-black/[.08]">
              {contatos.map(c => (
                <tr key={c.email}>
                  <td className={CELULA}><p>{c.nome}</p><p className="text-[0.6875rem] text-black/45">{c.email}{c.whatsapp ? ` · ${whatsappEmTexto(c.whatsapp)}` : ""}</p></td>
                  <td className={CELULA}>{c.veio_de === "compra" ? "Compra" : c.veio_de === "espera" ? "Lista de espera" : "Importado"}{c.evento ? ` · ${c.evento}` : ""}</td>
                  <td className={`${CELULA} text-right tabular-nums ${c.ingressos === 0 ? "text-black/30" : ""}`}>{c.ingressos}</td>
                  <td className={`${CELULA} tabular-nums text-black/70`}>{c.ultima_compra ? diaEMes(c.ultima_compra) : "—"}</td>
                  <td className={`${CELULA} text-right`}><Etiqueta {...ETIQUETA[c.novidades]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
