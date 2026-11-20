import { Lock } from "lucide-react";
import { rotuloAguardando, type SituacaoDaConversa } from "@/lib/email/conversas";

const CLASSE = "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium";

/** Quem está esperando a vez: âmbar quando a equipe aguarda o contato, verde quando o contato já respondeu. */
export function EtiquetaDeSituacao({ situacao }: { situacao: SituacaoDaConversa }) {
  const aguardando = situacao.tipo === "aguardando";
  const cor = aguardando ? "#B07A14" : "#2E8932";
  return (
    <span className={CLASSE} style={{ borderColor: `${cor}47`, color: cor }}>
      {aguardando ? rotuloAguardando(situacao.dias) : "Respondeu"}
    </span>
  );
}

/** A conversa só aparece para quem a sincronizou. */
export function EtiquetaSoEuVejo({ rotulo = "Só você vê" }: { rotulo?: string }) {
  return (
    <span className={CLASSE} style={{ borderColor: "rgba(13,13,13,.14)", color: "rgba(13,13,13,.5)" }}>
      <Lock size={10} aria-hidden="true" />
      {rotulo}
    </span>
  );
}
