"use client";

import { Tag } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import type { SituacaoDoCupom } from "@/lib/ticketeria/cupom";
import { Aviso, CAMPO, ROTULO, Rodape } from "@/components/ticketeria/FolhasDosEventos";

// Os cupons de desconto (a tela do produtor): a lista e a folha de criar ou editar. Só desenho: os dados e as ações chegam por props.

const BORDA = "rgba(13,13,13,.08)";
// `relative`: o texto `sr-only` do cabeçalho (posicionado de forma absoluta) fica dentro da célula; solto, contava como parte da página e criava um segundo scroll, com espaço em branco, em listas compridas.
const CABECALHO = "relative px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-3 text-[0.8125rem] text-[#282525]";

export type { SituacaoDoCupom } from "@/lib/ticketeria/cupom";
export type CupomDaLista = { id: string; codigo: string; desconto: string; alcance: string; usos: number; limite: number | null; validade: string | null; situacao: SituacaoDoCupom };

const ETIQUETA: Record<SituacaoDoCupom, { texto: string; cor: string }> = {
  ativo: { texto: "ATIVO", cor: "#2E8932" }, esgotado: { texto: "ESGOTADO", cor: "#B07A14" }, vencido: { texto: "VENCIDO", cor: "#6b6767" }, desativado: { texto: "DESATIVADO", cor: "#6b6767" },
};

function Etiqueta({ texto, cor }: { texto: string; cor: string }) {
  return <span className="inline-flex shrink-0 rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={{ borderColor: cor + "47", color: cor }}>{texto}</span>;
}

/** Os cupons da loja: código, desconto, a que vale, quantas vezes foi usado, até quando e a situação. */
export function CuponsDaLoja({ cupons, onEditar }: { cupons: CupomDaLista[]; onEditar?: (id: string) => void }) {
  if (cupons.length === 0) {
    return (
      <div className="rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        <div className="flex flex-col items-center px-4 py-20 text-center">
          <Tag size={28} className="mb-3 text-black/15" aria-hidden="true" />
          <p className="text-[0.875rem] font-medium text-black/55">Nenhum cupom ainda</p>
          <p className="mt-1.5 max-w-sm text-[0.75rem] leading-relaxed text-black/35">Crie um código de desconto para divulgar. Quem digitar o código na compra paga menos.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
      <table className="w-full min-w-[44rem] border-collapse">
        <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Cupom</th><th className={CABECALHO}>Desconto</th><th className={CABECALHO}>Vale para</th><th className={`${CABECALHO} text-right`}>Usos</th><th className={CABECALHO}>Validade</th><th className={CABECALHO}><span className="sr-only">Situação</span></th></tr></thead>
        <tbody className="divide-y divide-black/[.08]">
          {cupons.map(c => (
            <tr key={c.id}>
              <td className={CELULA}><button type="button" onClick={() => onEditar?.(c.id)} className="rounded-xl font-normal tracking-[.06em] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{c.codigo}</button></td>
              <td className={CELULA}>{c.desconto}</td>
              <td className={`${CELULA} text-black/70`}>{c.alcance}</td>
              <td className={`${CELULA} text-right tabular-nums`}>{c.usos}{c.limite !== null && <span className="text-black/45"> de {c.limite}</span>}</td>
              <td className={`${CELULA} tabular-nums text-black/70`}>{c.validade ?? "Sem prazo"}</td>
              <td className={`${CELULA} text-right`}><Etiqueta {...ETIQUETA[c.situacao]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type FormularioDoCupom = { codigo: string; tipo: "percentual" | "valor"; valor: string; evento: string; ingresso: string; limite: string; ate: string; ativo: boolean };

/** A folha de criar ou editar um cupom. O evento escolhe a lista de ingressos; "Todos os ingressos" vale para o evento inteiro. */
export function CupomSheet({ editando, valores, eventos, ingressos, erro, salvando, onMudar, onClose, onSalvar, onDesativar }: {
  editando: boolean; valores: FormularioDoCupom; eventos: { value: string; label: string }[]; ingressos: { value: string; label: string }[];
  erro?: string | null; salvando?: boolean; onMudar?: <K extends keyof FormularioDoCupom>(campo: K, valor: FormularioDoCupom[K]) => void; onClose: () => void; onSalvar?: () => void; onDesativar?: () => void;
}) {
  return (
    <TopSheet titulo={editando ? "Editar cupom" : "Novo cupom"} onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={!!salvando} rotulo={editando ? "Salvar" : "Criar cupom"} onSalvar={() => onSalvar?.()} onApagar={editando ? onDesativar : undefined} rotuloApagar={valores.ativo ? "Desativar" : "Reativar"} arquivar />}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <div><label className={ROTULO} htmlFor="cp-codigo">Código</label><input id="cp-codigo" className={`${CAMPO} uppercase tracking-[.08em]`} value={valores.codigo} onChange={e => onMudar?.("codigo", e.target.value)} placeholder="AMIGOS20" maxLength={20} autoCapitalize="characters" disabled={salvando || editando} /><p className="mt-1.5 text-[0.75rem] text-black/45">Letras e números, de 3 a 20. O comprador digita assim.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><span className={ROTULO}>Tipo do desconto</span><Dropdown ariaLabel="Tipo do desconto" value={valores.tipo} onChange={v => onMudar?.("tipo", v as FormularioDoCupom["tipo"])} options={[{ value: "percentual", label: "Porcentagem do preço" }, { value: "valor", label: "Valor por ingresso" }]} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="cp-valor">{valores.tipo === "percentual" ? "Porcentagem (1 a 100)" : "Valor em reais"}</label><input id="cp-valor" inputMode="decimal" className={CAMPO} value={valores.valor} onChange={e => onMudar?.("valor", e.target.value)} placeholder={valores.tipo === "percentual" ? "20" : "10,00"} disabled={salvando} /></div>
        </div>
        <div><span className={ROTULO}>Evento</span><Dropdown ariaLabel="Evento do cupom" value={valores.evento} onChange={v => onMudar?.("evento", v)} options={eventos} disabled={salvando || editando} /></div>
        <div><span className={ROTULO}>Ingresso</span><Dropdown ariaLabel="Ingresso do cupom" value={valores.ingresso} onChange={v => onMudar?.("ingresso", v)} options={[{ value: "", label: "Todos os ingressos do evento" }, ...ingressos]} disabled={salvando} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={ROTULO} htmlFor="cp-limite">Limite de usos (opcional)</label><input id="cp-limite" inputMode="numeric" className={CAMPO} value={valores.limite} onChange={e => onMudar?.("limite", e.target.value)} placeholder="Sem limite" disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="cp-ate">Vale até (opcional)</label><input id="cp-ate" type="date" className={CAMPO} value={valores.ate} onChange={e => onMudar?.("ate", e.target.value)} disabled={salvando} /></div>
        </div>
        <p className="text-[0.75rem] text-black/50">O desconto vale em cada ingresso. A taxa do Jards (2,5%) é sobre o que o comprador paga, já com o desconto. Desconto de 100% vira ingresso gratuito.</p>
      </div>
    </TopSheet>
  );
}
