// Porte progressivo (plano do módulo de produção, PD0.12): a página da data
// mostra só o que se aplica. O artista solo com cinco datas e o teatro municipal
// usam o mesmo motor, mas painel que não serve não aparece. Este arquivo decide
// quais painéis aparecem; ele não sabe de banco nem de tela.

import { tipoDeProducao, type PainelId, type TipoProducao } from "@/lib/producao/vocabulario";

export type ContextoDaData = {
  tipo: TipoProducao;
  /** Alguém da equipe se desloca para esta data. */
  alguemViaja: boolean;
  /** A data tem cota de convidados ou cortesias. */
  temCotaDeConvidados: boolean;
  /** A pessoa que olha pode ver cachês e o dinheiro da produção. */
  podeVerDinheiro: boolean;
  /** A data acontece num espaço de outra organização, com quem se faz o acerto técnico. */
  recebidaPorOutroEspaco: boolean;
  /** Já existe algo registrado no painel: o que tem conteúdo nunca some. */
  comConteudo?: readonly PainelId[];
};

/** Sempre aparecem: o essencial da data. */
const SEMPRE: readonly PainelId[] = ["dia", "equipe"];

/** Painéis da data, na ordem do catálogo do tipo. */
export function paineisDaData(contexto: ContextoDaData): PainelId[] {
  const sugeridos = tipoDeProducao(contexto.tipo).paineis;
  const comConteudo = new Set(contexto.comConteudo ?? []);
  const seAplica = (painel: PainelId): boolean => {
    if (SEMPRE.includes(painel) || comConteudo.has(painel)) return true;
    switch (painel) {
      case "viagem":
      case "hospedagem":
        return contexto.alguemViaja;
      case "convidados":
        return contexto.temCotaDeConvidados;
      case "dinheiro":
      case "bordero":
        return contexto.podeVerDinheiro;
      case "acerto":
        return contexto.recebidaPorOutroEspaco;
      default:
        return true;
    }
  };
  const lista = sugeridos.filter(seAplica);
  // O dinheiro nunca aparece sem permissão, mesmo com conteúdo.
  const semDinheiro = contexto.podeVerDinheiro ? lista : lista.filter(p => p !== "dinheiro" && p !== "bordero");
  for (const painel of SEMPRE) if (!semDinheiro.includes(painel)) semDinheiro.unshift(painel);
  return semDinheiro;
}
