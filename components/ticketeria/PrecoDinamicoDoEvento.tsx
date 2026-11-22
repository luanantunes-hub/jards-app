"use client";

import { useEffect, useState } from "react";
import { SecondaryListAction } from "@/components/list/ListPagePrimitives";
import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso, CAMPO, ROTULO, Rodape } from "@/components/ticketeria/FolhasDosEventos";
import { PONTOS_DO_ACEITE, REGRA_PADRAO, lerRegraDaTela } from "@/lib/ticketeria/preco-dinamico";
import { PrecoDinamicoView, horasDe, pctDe } from "@/components/ticketeria/PrecoDinamicoView";
import type { FatorDaSessao, RegraDoEvento } from "@/lib/ticketeria/preco-dinamico-servidor";

// A adesão do evento ao preço dinâmico (plano da Ticketeria, seção 11, P2b). Só aparece quando a plataforma liberou o recurso (o texto do aceite ainda é um rascunho para o advogado).
// O produtor liga com piso, teto, passo e intervalo, depois de ler e aceitar os pontos; desliga quando quiser (o preço volta ao preço-base). Quem move o preço é o atualizador do servidor.

type RegraOuNada = RegraDoEvento | null;
type Resposta = { liberado: boolean; regra: RegraOuNada; fatores: FatorDaSessao[] };

function AdesaoSheet({ lojaId, eventoId, regra, onClose, onSaved }: { lojaId: string; eventoId: string; regra: RegraOuNada; onClose: () => void; onSaved: () => void }) {
  const inicial = regra ?? { ...REGRA_PADRAO, ativo: false };
  const [piso, setPiso] = useState(pctDe(inicial.pisoBps));
  const [teto, setTeto] = useState(pctDe(inicial.tetoBps));
  const [passo, setPasso] = useState(pctDe(inicial.passoBps));
  const [horas, setHoras] = useState(horasDe(inicial.intervaloMinutos));
  const [aceito, setAceito] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ligado = regra?.ativo === true;

  async function gravar(ativo: boolean, fechar: () => void) {
    const leitura = lerRegraDaTela({ piso, teto, passo, intervaloHoras: horas });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    if (ativo && !aceito) { setErro("Leia os pontos e marque que aceita para ligar."); return; }
    setSalvando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/ticketeria/lojas/${lojaId}/preco-dinamico?evento=${eventoId}`, {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ativo, aceito: ativo ? true : undefined, piso_pct: -leitura.pisoBps / 100 || 0, teto_pct: leitura.tetoBps / 100, passo_pct: leitura.passoBps / 100, intervalo_minutos: leitura.intervaloMinutos }),
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
      onSaved();
      fechar();
    } catch {
      setErro("Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <TopSheet titulo={ligado ? "Preço dinâmico: configurar" : "Aderir ao preço dinâmico"} onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo={ligado ? "Salvar" : "Ligar"} onSalvar={() => void gravar(true, fechar)} onApagar={ligado ? () => void gravar(false, fechar) : undefined} rotuloApagar="Desligar" arquivar />}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <div className="grid grid-cols-2 gap-3">
          <div><label className={ROTULO} htmlFor="pd-piso">Pode baixar até (%)</label><input id="pd-piso" inputMode="decimal" className={CAMPO} value={piso} onChange={e => setPiso(e.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="pd-teto">Pode subir até (%)</label><input id="pd-teto" inputMode="decimal" className={CAMPO} value={teto} onChange={e => setTeto(e.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="pd-passo">Mudança por vez (%)</label><input id="pd-passo" inputMode="decimal" className={CAMPO} value={passo} onChange={e => setPasso(e.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="pd-horas">No máximo a cada (horas)</label><input id="pd-horas" inputMode="decimal" className={CAMPO} value={horas} onChange={e => setHoras(e.target.value)} disabled={salvando} /></div>
        </div>
        <p className="text-[0.75rem] text-black/55">As porcentagens são sobre o preço-base (o do lote, ou o que você pôs para a sessão).</p>
        <div className="rounded-xl border border-black/[.08] px-4 py-3">
          <p className="mb-2 text-[0.75rem] font-normal text-[#282525]">Antes de ligar</p>
          <ul className="list-disc space-y-1.5 pl-4 text-[0.75rem] text-black/60">{PONTOS_DO_ACEITE.map(ponto => <li key={ponto}>{ponto}</li>)}</ul>
        </div>
        <label className="flex items-start gap-2 text-[0.8125rem] text-[#282525]"><input type="checkbox" className="mt-0.5 accent-[#1C0E33]" checked={aceito} onChange={e => setAceito(e.target.checked)} disabled={salvando} /> Li os pontos acima e aceito.</label>
      </div>
    </TopSheet>
  );
}

/** O cartão de um evento: lê da rota (só quem edita a Ticketeria) e some se a plataforma não liberou o recurso. `onMudou` avisa quando liga, desliga ou muda a regra. */
export function PrecoDinamicoDoEvento({ lojaId, eventoId, sessoes, onMudou }: { lojaId: string; eventoId: string; sessoes: { id: string; inicio: string; fuso: string }[]; onMudou?: () => void }) {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [versao, setVersao] = useState(0);
  const [folha, setFolha] = useState(false);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const resposta = await fetch(`/api/ticketeria/lojas/${lojaId}/preco-dinamico?evento=${eventoId}`, { cache: "no-store" });
        if (!resposta.ok) return;
        const corpo = (await resposta.json()) as Resposta;
        if (ativo) setDados(corpo);
      } catch { /* sem o cartão: o resto da página segue */ }
    })();
    return () => { ativo = false; };
  }, [lojaId, eventoId, versao]);

  if (!dados || !dados.liberado || sessoes.length === 0) return null;
  return (
    <>
      <PrecoDinamicoView regra={dados.regra} fatores={dados.fatores} sessoes={sessoes} acao={<SecondaryListAction onClick={() => setFolha(true)}>{dados.regra?.ativo ? "Configurar" : "Aderir"}</SecondaryListAction>} />
      {folha && <AdesaoSheet lojaId={lojaId} eventoId={eventoId} regra={dados.regra} onClose={() => setFolha(false)} onSaved={() => { setVersao(v => v + 1); onMudou?.(); }} />}
    </>
  );
}
