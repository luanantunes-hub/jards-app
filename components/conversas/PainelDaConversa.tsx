"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AcoesDaTriagem } from "@/components/conversas/AcoesDaTriagem";
import { EtiquetaDeSituacao, EtiquetaSoEuVejo } from "@/components/email/EtiquetaDeConversa";
import { AcoesDaConversa, BOTAO_DA_CONVERSA, FioDaConversa, type Pessoa } from "@/components/email/FioDaConversa";
import { AvatarDaPessoa } from "@/components/ui/AvatarDaPessoa";
import { enderecoDoOutroLado, estadoDoItem, quemNaConversa, type ItemDaLista } from "@/lib/conversas/lista";
import type { EstadoDoAvatar } from "@/lib/conversas/avatar";
import type { RemetenteDaTriagem } from "@/app/api/email/triagem/route";

function Cabecalho({ titulo, abaixo, voltar, pessoa }: { titulo: string; abaixo: string; voltar: () => void; pessoa?: { nome: string; endereco: string | null; estado: EstadoDoAvatar | null } }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <button type="button" onClick={voltar} aria-label="Voltar para a lista" className="-ml-1 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded text-black/40 transition hover:bg-black/[.05] hover:text-black/70 lg:hidden">
        <ArrowLeft size={15} aria-hidden="true" />
      </button>
      {pessoa && <AvatarDaPessoa nome={pessoa.nome} endereco={pessoa.endereco} estado={pessoa.estado} comDesenho tamanho="maior" className="-mt-1.5" />}
      <div className="min-w-0">
        <h2 className="text-[1.0625rem] font-bold leading-snug text-[#282525] [text-wrap:balance]">{titulo}</h2>
        <p className="mt-0.5 text-[0.75rem] text-black/45">{abaixo}</p>
      </div>
    </div>
  );
}

/** A conversa aberta, ao lado da lista: o fio do e-mail ou o e-mail que ainda não saiu. */
export function PainelDaConversa({ item, meuId, nomesDosContatos, remetenteDaTriagem, onMudou, onVoltar }: {
  item: ItemDaLista;
  meuId: string | null;
  nomesDosContatos: readonly string[];
  /** Quando a conversa é de quem ainda não é contato, o que a triagem sabe dessa pessoa. */
  remetenteDaTriagem: RemetenteDaTriagem | null;
  onMudou: () => void;
  onVoltar: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const membros: Pessoa[] = [];

  async function cancelarAgendado(id: string) {
    setCancelando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/email/agendados/cancelar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const json = (await resposta.json().catch(() => ({}))) as { error?: string };
      if (!resposta.ok) throw new Error(json.error || "Não foi possível cancelar.");
      onMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cancelar.");
    } finally {
      setCancelando(false);
    }
  }

  const aviso = erro && <p role="alert" className="mb-4 rounded border border-[#D94E4E]/20 px-3 py-2 text-[0.75rem] text-[#D94E4E]">{erro}</p>;

  if (item.tipo === "agendado") {
    const { agendado } = item;
    return (
      <>
        <Cabecalho titulo={agendado.assunto} abaixo={`Para ${agendado.para.join(", ")}`} voltar={onVoltar} />
        {aviso}
        <p className="text-[0.8125rem] text-black/60">
          {agendado.estado === "falhou"
            ? <span className="text-[#B23B3B]">Não saiu: {agendado.erro ?? "erro ao enviar"}</span>
            : agendado.estado === "enviando"
              ? "Enviando agora…"
              : <>Sai da sua caixa em <span className="font-medium text-[#282525]">{new Date(agendado.enviar_em).toLocaleString("pt-BR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}</span>.</>}
        </p>
        <div className="mt-5">
          <button type="button" onClick={() => void cancelarAgendado(agendado.id)} disabled={cancelando || agendado.estado === "enviando"} className={BOTAO_DA_CONVERSA}>
            {cancelando ? "Cancelando…" : agendado.estado === "falhou" ? "Descartar" : "Cancelar envio"}
          </button>
        </div>
      </>
    );
  }

  const { conversa } = item;
  const total = conversa.mensagens.length;
  const ehMinha = meuId !== null && conversa.mensagens.some((mensagem) => mensagem.user_id === meuId);

  return (
    <>
      <Cabecalho
        titulo={conversa.assunto}
        abaixo={`${quemNaConversa(conversa, nomesDosContatos)} · ${total} ${total === 1 ? "mensagem" : "mensagens"}`}
        voltar={onVoltar}
        pessoa={{ nome: quemNaConversa(conversa, nomesDosContatos), endereco: enderecoDoOutroLado(conversa), estado: estadoDoItem(item, nomesDosContatos) }}
      />
      {(conversa.situacao || conversa.privada) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {conversa.situacao && <EtiquetaDeSituacao situacao={conversa.situacao} />}
          {conversa.privada && <EtiquetaSoEuVejo />}
        </div>
      )}
      {aviso}
      {remetenteDaTriagem && <AcoesDaTriagem remetente={remetenteDaTriagem} onMudou={onMudou} />}
      <FioDaConversa conversa={conversa} meuId={meuId} membros={membros} />
      {ehMinha && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <AcoesDaConversa conversa={conversa} meuId={meuId} onMudou={onMudou} onErro={setErro} />
        </div>
      )}
    </>
  );
}
