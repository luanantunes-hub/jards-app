"use client";

import { useState } from "react";
import { Check, Link2, UserRound } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso, CAMPO, ROTULO, Rodape } from "@/components/ticketeria/FolhasDosEventos";
import type { BilheteiroParaLista } from "@/lib/ticketeria/bilheteria";

// Quem vende na porta (a tela do produtor): a lista de contas da bilheteria e a folha de cadastrar ou editar. Só desenho: os dados e as ações chegam por props.

const BORDA = "rgba(13,13,13,.08)";
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-3 text-[0.8125rem] text-[#282525]";

function Etiqueta({ texto, cor }: { texto: string; cor: string }) {
  return <span className="inline-flex shrink-0 rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={{ borderColor: cor + "47", color: cor }}>{texto}</span>;
}

/** O endereço por onde a equipe entra, com o botão de copiar. `endereco` vem do navegador; nas imagens e nos testes, passado à mão. */
export function EnderecoDaBilheteria({ endereco }: { endereco: string }) {
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState(false);
  async function copiar() {
    try { await navigator.clipboard.writeText(endereco); setErro(false); setCopiado(true); setTimeout(() => setCopiado(false), 3000); } catch { setErro(true); }
  }
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-white px-4 py-3" style={{ borderColor: BORDA }}>
      <p className="text-[0.8125rem] text-black/60">Quem vende entra em <span className="text-[#282525]">{endereco}</span></p>
      <button type="button" onClick={() => void copiar()} aria-live="polite" className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[0.6875rem] font-normal text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
        {copiado ? <Check size={12} aria-hidden="true" className="text-[#2E8932]" /> : <Link2 size={12} aria-hidden="true" />}
        {erro ? "Não foi possível copiar" : copiado ? "Endereço copiado" : "Copiar endereço"}
      </button>
    </div>
  );
}

/** As contas da bilheteria da loja: nome, e-mail, desde quando e se o acesso está ligado. */
export function BilheteirosDaLoja({ bilheteiros, onEditar }: { bilheteiros: BilheteiroParaLista[]; onEditar?: (id: string) => void }) {
  if (bilheteiros.length === 0) {
    return (
      <div className="rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        <div className="flex flex-col items-center px-4 py-20 text-center">
          <UserRound size={28} className="mb-3 text-black/15" aria-hidden="true" />
          <p className="text-[0.875rem] font-medium text-black/55">Ninguém cadastrado ainda</p>
          <p className="mt-1.5 max-w-sm text-[0.75rem] leading-relaxed text-black/35">Cadastre quem vai vender ingressos na porta. A pessoa só vende e confere ingressos: não vê relatórios, repasses nem configurações.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
      <table className="w-full min-w-[36rem] border-collapse">
        <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Nome</th><th className={CABECALHO}>E-mail</th><th className={CABECALHO}>Cadastrada em</th><th className={`${CABECALHO} text-right`}>Acesso</th></tr></thead>
        <tbody className="divide-y divide-black/[.08]">
          {bilheteiros.map(b => (
            <tr key={b.id}>
              <td className={CELULA}><button type="button" onClick={() => onEditar?.(b.id)} className="rounded-xl font-normal underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{b.nome}</button></td>
              <td className={`${CELULA} text-black/70`}>{b.email ?? "—"}</td>
              <td className={`${CELULA} tabular-nums text-black/70`}>{b.criadoEm ? new Date(b.criadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}</td>
              <td className={`${CELULA} text-right`}>{b.ativo ? <Etiqueta texto="LIGADO" cor="#2E8932" /> : <Etiqueta texto="DESLIGADO" cor="#6b6767" />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type FormularioDoBilheteiro = { nome: string; email: string };

/**
 * A folha de cadastrar ou editar. Ao cadastrar: nome e e-mail (quem ainda não tem conta no Jards recebe um e-mail para criar a senha). Ao editar: só o nome, e o botão de ligar
 * ou desligar o acesso (o e-mail não muda: é o login da pessoa).
 */
export function BilheteiroSheet({ editando, valores, ativo, erro, salvando, onMudar, onClose, onSalvar, onAlternar }: {
  editando: boolean; valores: FormularioDoBilheteiro; ativo?: boolean; erro?: string | null; salvando?: boolean;
  onMudar?: <K extends keyof FormularioDoBilheteiro>(campo: K, valor: FormularioDoBilheteiro[K]) => void; onClose: () => void; onSalvar?: () => void; onAlternar?: () => void;
}) {
  return (
    <TopSheet titulo={editando ? "Editar bilheteira" : "Nova bilheteira"} onClose={onClose}
      footer={fechar => <Rodape fechar={fechar} salvando={!!salvando} rotulo={editando ? "Salvar" : "Cadastrar"} onSalvar={() => onSalvar?.()} onApagar={editando ? onAlternar : undefined} rotuloApagar={ativo ? "Desligar acesso" : "Ligar acesso"} arquivar={!ativo} />}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <div><label className={ROTULO} htmlFor="bl-nome">Nome</label><input id="bl-nome" className={CAMPO} value={valores.nome} onChange={e => onMudar?.("nome", e.target.value)} disabled={salvando} autoComplete="off" /></div>
        <div><label className={ROTULO} htmlFor="bl-email">E-mail</label><input id="bl-email" type="email" className={CAMPO} value={valores.email} onChange={e => onMudar?.("email", e.target.value)} disabled={salvando || editando} autoComplete="off" /></div>
        <p className="text-[0.75rem] leading-relaxed text-black/50">
          {editando
            ? ativo ? "Desligar o acesso tira a pessoa da bilheteria na próxima tela que ela abrir. Os ingressos que ela já vendeu continuam valendo." : "O acesso está desligado: a pessoa não consegue entrar na bilheteria."
            : "A pessoa só vende e confere ingressos: não vê relatórios, repasses nem configurações. Se ainda não tiver conta no Jards, recebe um e-mail para criar a senha."}
        </p>
      </div>
    </TopSheet>
  );
}
