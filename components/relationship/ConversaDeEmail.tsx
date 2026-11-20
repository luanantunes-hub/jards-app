"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { EtiquetaDeSituacao, EtiquetaSoEuVejo } from "@/components/email/EtiquetaDeConversa";
import { AcoesDaConversa, FioDaConversa, nomeDe, type Pessoa } from "@/components/email/FioDaConversa";
import type { Conversa } from "@/lib/email/conversas";

type Props = {
  conversa: Conversa;
  /** Quem está com o Jards aberto: só o dono da caixa pode responder, abrir no Gmail/Outlook e mudar quem vê. */
  meuId: string | null;
  contatos: Pessoa[];
  membros: Pessoa[];
  onClose: () => void;
  /** A visibilidade mudou (ou saiu uma resposta): quem abriu a conversa recarrega a lista. */
  onMudou: () => void;
};

/** A conversa aberta como folha, a partir do histórico da empresa. A tela de Conversas mostra o mesmo fio ao lado da lista. */
export function ConversaDeEmail({ conversa, meuId, contatos, membros, onClose, onMudou }: Props) {
  const ehMinha = meuId !== null && conversa.mensagens.some((mensagem) => mensagem.user_id === meuId);
  const donoDaCaixa = conversa.donoIds[0] ? nomeDe(membros, conversa.donoIds[0]) : null;
  const nomesDosContatos = conversa.contatoIds.map((id) => nomeDe(contatos, id)).filter(Boolean).join(", ");
  const total = conversa.mensagens.length;

  return (
    <BottomSheet
      titulo={conversa.assunto}
      subtitulo={[nomesDosContatos, `${total} ${total === 1 ? "mensagem" : "mensagens"}`].filter(Boolean).join(" · ")}
      onClose={onClose}
      footer={(close) => ehMinha ? (
        <AcoesDaConversa conversa={conversa} meuId={meuId} onMudou={onMudou} />
      ) : (
        <button type="button" onClick={close} className="px-3 py-2 text-[0.75rem] font-semibold text-black/35 transition hover:text-black/55">Fechar</button>
      )}
    >
      {(conversa.situacao || conversa.privada || (!ehMinha && donoDaCaixa)) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {conversa.situacao && <EtiquetaDeSituacao situacao={conversa.situacao} />}
          {conversa.privada && <EtiquetaSoEuVejo />}
          {!ehMinha && donoDaCaixa && <span className="text-[0.6875rem] text-black/40">Caixa de {donoDaCaixa}</span>}
        </div>
      )}
      <FioDaConversa conversa={conversa} meuId={meuId} membros={membros} />
    </BottomSheet>
  );
}
