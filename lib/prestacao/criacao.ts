// Criação guiada da prestação (P1.4): passos, sugestões e validação.
//
// O componente (components/modals/NovaPrestacaoModal.tsx) cria o rascunho no
// primeiro passo e grava cada passo seguinte; aqui fica o que dá para testar
// sem tela.

import { formatarValorBRL, lerValorBRL } from "../valor";
import { prazoFinalCalculado } from "./prazo-final";
import type { RegimeNormativo } from "./regimes";

export const PASSOS = [
  { id: "origem", titulo: "Origem" },
  { id: "regime", titulo: "Regime" },
  { id: "dados", titulo: "Dados oficiais" },
  { id: "importacao", titulo: "Orçamento" },
  { id: "marcos", titulo: "Marcos e prazo" },
] as const;

export type PassoId = (typeof PASSOS)[number]["id"];

export type CaptacaoParaCriacao = {
  id: string;
  titulo: string | null;
  lei: string | null;
  valor_aprovado: number | null;
  valor_solicitado: number | null;
  projeto_id: string | null;
};

export type ProjetoParaCriacao = { id: string; nome: string; proponente_id: string | null };

/** Título sugerido: o da captação, senão o nome do projeto. */
export function tituloSugerido(captacao: CaptacaoParaCriacao | null, projeto: ProjetoParaCriacao | null): string {
  const base = captacao?.titulo?.trim() || projeto?.nome?.trim() || "";
  return base ? `Prestação de contas — ${base}` : "";
}

/** Valor aprovado inicial, como o campo mostra: o aprovado da captação, senão o solicitado. */
export function valorInicial(captacao: CaptacaoParaCriacao | null): string {
  const valor = captacao?.valor_aprovado ?? captacao?.valor_solicitado ?? null;
  return valor ? formatarValorBRL(valor) : "";
}

export type DadosCriacao = {
  titulo: string;
  regimeId: string;
  valorAprovado: string;
  inicioExecucao: string;
  fimExecucao: string;
  prazoInformado: string;
  justificativa: string;
};

/** Prazo que o banco vai calcular, para mostrar antes de salvar. */
export function previaDoPrazo(regime: RegimeNormativo | null, fimExecucao: string): string | null {
  return prazoFinalCalculado(regime, { data_fim_execucao: fimExecucao || null })?.data ?? null;
}

/** Mensagem do que falta no passo, ou null quando dá para seguir. */
export function validarPasso(passo: PassoId, dados: DadosCriacao, regime: RegimeNormativo | null): string | null {
  switch (passo) {
    case "origem":
      return dados.titulo.trim().length >= 3 ? null : "Dê um título à prestação.";
    case "regime":
      return dados.regimeId ? null : "Escolha o regime.";
    case "dados": {
      const { valido } = lerValorBRL(dados.valorAprovado);
      return valido ? null : "Valor aprovado inválido.";
    }
    case "importacao":
      return null;
    case "marcos": {
      if (dados.inicioExecucao && dados.fimExecucao && dados.fimExecucao < dados.inicioExecucao) {
        return "O fim da execução vem antes do início.";
      }
      const calculado = previaDoPrazo(regime, dados.fimExecucao);
      if (dados.prazoInformado && calculado && dados.prazoInformado !== calculado && dados.justificativa.trim().length < 3) {
        return "Explique por que o prazo é diferente do calculado pelo regime.";
      }
      return null;
    }
  }
}
