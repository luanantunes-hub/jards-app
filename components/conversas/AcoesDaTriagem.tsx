"use client";

import { useState } from "react";
import { BriefcaseBusiness, Check, UserPlus } from "lucide-react";
import { NovaCaptacaoModal } from "@/components/modals/NovaCaptacaoModal";
import { NovoContatoModal } from "@/components/modals/NovoContatoModal";
import type { RemetenteDaTriagem } from "@/app/api/email/triagem/route";

const VERDE = "#3DA86A";
const BOTAO = "flex h-8 items-center gap-1.5 rounded border border-black/12 bg-white px-3 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white";

/**
 * Os três passos para quem ainda não é contato, dentro da conversa aberta: criar o contato (com a empresa sugerida
 * pelo domínio), registrar a conversa para a equipe e abrir a negociação. Nenhum é obrigatório, e "Dispensar" apaga
 * as cópias guardadas. Até registrar, a conversa é só sua.
 */
export function AcoesDaTriagem({ remetente, onMudou }: { remetente: RemetenteDaTriagem; onMudou: () => void }) {
  const [tratando, setTratando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novoContato, setNovoContato] = useState(false);
  const [novaNegociacao, setNovaNegociacao] = useState(false);
  const contato = remetente.contato;

  async function tratar(acao: "registrar" | "dispensar") {
    setTratando(acao);
    setErro(null);
    try {
      const resposta = await fetch(`/api/email/triagem/${acao}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: remetente.organizationId, endereco: remetente.endereco }),
      });
      const json = (await resposta.json().catch(() => ({}))) as { error?: string };
      if (!resposta.ok) throw new Error(json.error || "Não foi possível concluir.");
      onMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setTratando(null);
    }
  }

  return (
    <div className="mb-4 rounded border bg-[#FBFAFA] px-4 py-3.5" style={{ borderColor: "rgba(13,13,13,.09)" }}>
      {novoContato && (
        <NovoContatoModal
          initialNome={remetente.nomeSugerido}
          initialEmail={remetente.endereco}
          empresaPreId={remetente.sugestaoDeEmpresa?.id}
          onClose={() => setNovoContato(false)}
          onSaved={() => { setNovoContato(false); onMudou(); }}
        />
      )}
      {novaNegociacao && contato?.empresaId && (
        <NovaCaptacaoModal empresaPreId={contato.empresaId} onClose={() => setNovaNegociacao(false)} onSaved={() => { setNovaNegociacao(false); onMudou(); }} />
      )}

      {contato
        ? <p className="flex items-center gap-1.5 text-[0.75rem] font-medium" style={{ color: VERDE }}><Check size={12} aria-hidden="true" />Contato criado{contato.empresaNome ? ` em ${contato.empresaNome}` : " sem empresa"}</p>
        : <p className="text-[0.75rem] text-black/55">
            {remetente.sugestaoDeEmpresa
              ? <>Parece ser da <span className="font-medium text-[#282525]">{remetente.sugestaoDeEmpresa.nome}</span>{remetente.sugestaoDeEmpresa.motivo === "site" ? ", pelo site da empresa" : ", pelos outros contatos dela"}.</>
              : "Essa pessoa ainda não está nos seus contatos."}
          </p>}

      {erro && <p role="alert" className="mt-2 text-[0.75rem] text-[#B23B3B]">{erro}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!contato && <button type="button" onClick={() => setNovoContato(true)} className={BOTAO}><UserPlus size={13} aria-hidden="true" />Criar contato</button>}
        <button type="button" onClick={() => void tratar("registrar")} disabled={!contato || tratando !== null} title={contato ? undefined : "Crie o contato primeiro"} className={BOTAO}>
          <Check size={13} aria-hidden="true" />{tratando === "registrar" ? "Registrando…" : "Registrar conversa"}
        </button>
        <button type="button" onClick={() => setNovaNegociacao(true)} disabled={!contato?.empresaId || tratando !== null} title={contato?.empresaId ? undefined : "Crie o contato em uma empresa primeiro"} className={BOTAO}>
          <BriefcaseBusiness size={13} aria-hidden="true" />Criar negociação
        </button>
        <button type="button" onClick={() => void tratar("dispensar")} disabled={tratando !== null} className="h-8 rounded px-2 text-[0.75rem] font-medium text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-40">
          {tratando === "dispensar" ? "Dispensando…" : "Dispensar"}
        </button>
      </div>
    </div>
  );
}
