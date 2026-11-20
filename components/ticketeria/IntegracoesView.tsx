"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso, Rodape } from "@/components/ticketeria/FolhasDosEventos";
import { chaveResumida, codigoDoWidget } from "@/lib/ticketeria/integracao";

// A tela Integrações: a chave pública da loja (para os sites que mostram os ingressos) e o código do widget para colar no site. Desenho aprovado pelo dono em 20/11/2026.

const LINK = "rounded-xl text-[0.8125rem] text-black/55 underline-offset-2 transition hover:text-black/75 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const CARTAO = "rounded-xl border border-black/[.1] bg-white px-5 py-4";

export type ChaveDaLoja = { chave: string; ativa: boolean };

function Etiqueta({ cor, texto }: { cor: string; texto: string }) {
  return <span className="shrink-0 rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={{ borderColor: cor + "47", color: cor }}>{texto}</span>;
}

/** Copia um texto e mostra "copiado" por 3 segundos; sem permissão do navegador, diz que não foi possível. */
function BotaoCopiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [estado, setEstado] = useState<"parado" | "copiado" | "erro">("parado");
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("copiado");
      setTimeout(() => setEstado("parado"), 3000);
    } catch {
      setEstado("erro");
    }
  }
  return (
    <button type="button" onClick={() => void copiar()} className={`inline-flex items-center gap-1.5 ${LINK}`} aria-live="polite">
      {estado === "copiado" && <Check size={12} aria-hidden="true" className="text-[#2E8932]" />}
      {estado === "erro" ? "Não foi possível copiar" : estado === "copiado" ? "Copiado" : rotulo}
    </button>
  );
}

export function CartaoDaChave({ chave, podeEditar = false, trabalhando = false, onLigar, onGirar }: { chave: ChaveDaLoja; podeEditar?: boolean; trabalhando?: boolean; onLigar?: (ligada: boolean) => void; onGirar?: () => void }) {
  return (
    <section aria-label="Chave da loja" className={CARTAO}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[0.9375rem] font-normal text-[#282525]">Chave da loja</h2>
          <p className="mt-1 max-w-xl text-[0.8125rem] text-black/60">Identifica a sua loja nos sites que mostram os seus ingressos. Não dá acesso a vendas nem a dados de quem comprou.</p>
        </div>
        {chave.ativa ? <Etiqueta cor="#2E8932" texto="LIGADA" /> : <Etiqueta cor="#B07A14" texto="DESLIGADA" />}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-black/[.1] px-3 py-2">
        <span className="font-mono text-[0.75rem] text-[#282525]">{chaveResumida(chave.chave)}</span>
        <BotaoCopiar texto={chave.chave} rotulo="Copiar" />
      </div>
      {!chave.ativa && <p className="mt-2 text-[0.75rem] text-black/55">Enquanto estiver desligada, os sites que usam a chave não mostram os seus ingressos.</p>}
      {podeEditar && (
        <div className="mt-2 flex items-center gap-4">
          <button type="button" disabled={trabalhando} onClick={() => onLigar?.(!chave.ativa)} className={LINK}>{chave.ativa ? "Desligar" : "Ligar"}</button>
          <button type="button" disabled={trabalhando} onClick={onGirar} className={LINK}>Gerar outra chave</button>
        </div>
      )}
    </section>
  );
}

export function CartaoDoCodigo({ chave, origem }: { chave: string; origem: string }) {
  const codigo = codigoDoWidget(origem, chave);
  return (
    <section aria-label="Mostrar os ingressos no seu site" className={`${CARTAO} mt-4`}>
      <h2 className="text-[0.9375rem] font-normal text-[#282525]">Mostrar os ingressos no seu site</h2>
      <p className="mt-1 max-w-xl text-[0.8125rem] text-black/60">Cole este código onde os ingressos devem aparecer: WordPress, Wix, Webflow, Squarespace e outros.</p>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-black/[.04] px-3 py-2 font-mono text-[0.6875rem] leading-relaxed text-[#282525]">{codigo}</pre>
      <div className="mt-2 flex items-center justify-between gap-3">
        <BotaoCopiar texto={codigo} rotulo="Copiar código" />
        <span className="text-[0.75rem] text-black/45">Em breve: plugins do WordPress, Wix e Webflow</span>
      </div>
    </section>
  );
}

/** A confirmação de gerar outra chave: a antiga deixa de valer na hora, e os sites que a usam param de mostrar os ingressos até receberem o código novo. */
export function GirarChaveSheet({ onClose, onGirar }: { onClose: () => void; onGirar: () => Promise<string | null> }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function girar(fechar: () => void) {
    setSalvando(true);
    setErro(null);
    const falha = await onGirar();
    setSalvando(false);
    if (falha) { setErro(falha); return; }
    fechar();
  }
  return (
    <TopSheet titulo="Gerar outra chave" onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo="Gerar outra chave" onSalvar={() => void girar(fechar)} />}>
      <div className="space-y-3">
        {erro && <Aviso texto={erro} />}
        <p className="text-[0.8125rem] text-black/70">A chave atual deixa de valer na hora. Os sites que a usam param de mostrar os seus ingressos até você colar o código novo.</p>
        <p className="text-[0.75rem] text-black/55">Use isto se a chave foi parar onde não devia. Ela só mostra eventos e preços públicos, mas você pode trocá-la quando quiser.</p>
      </div>
    </TopSheet>
  );
}
