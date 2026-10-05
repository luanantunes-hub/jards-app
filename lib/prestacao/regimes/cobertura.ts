// Cobertura dos regimes (P1.11): cada regime diz, em cada dimensão da
// prestação, quais são as regras ou por que não há (não se aplica, a norma não
// trata). Daqui saem o teste de cobertura e a matriz em
// docs/acoes-futuras/estudos/matriz-cobertura-regimes.md, gerada por
// scripts/prestacao-gerar-matriz-regimes.ts.

import { REGIMES } from "./index";
import {
  DIMENSOES,
  ehLacuna,
  PRAZOS_ESSENCIAIS,
  type ChaveDimensao,
  type Fonte,
  type Lacuna,
  type RegimeNormativo,
} from "./tipos";

export const ARQUIVO_MATRIZ = "docs/acoes-futuras/estudos/matriz-cobertura-regimes.md";

export type SituacaoDimensao = "definida" | "nao_se_aplica" | "norma_silente" | "ausente";

export type CelulaCobertura = {
  chave: ChaveDimensao;
  rotulo: string;
  situacao: SituacaoDimensao;
  resumo: string;
  /** Regras e valores com fonte dentro da dimensão. */
  fontes: number;
  /** Quantas dessas fontes estão marcadas "a confirmar". */
  aConfirmar: number;
};

/** Todas as fontes dentro de um valor, em qualquer profundidade. */
export function fontesEm(valor: unknown): Fonte[] {
  const achadas: Fonte[] = [];
  const visitar = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(visitar); return; }
    if (!v || typeof v !== "object") return;
    for (const [chave, filho] of Object.entries(v)) {
      if (chave === "fonte" && filho && typeof filho === "object") achadas.push(filho as Fonte);
      else visitar(filho);
    }
  };
  visitar(valor);
  return achadas;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dataCurta = (d: string) => `${d.slice(8, 10)}/${MESES[Number(d.slice(5, 7)) - 1]}/${d.slice(0, 4)}`;
const pct = (n: number) => `${String(n).replace(".", ",")}%`;
const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const UNIDADE: Record<string, [string, string]> = {
  dias_corridos: ["dia", "dias"],
  dias_uteis: ["dia útil", "dias úteis"],
  meses: ["mês", "meses"],
  anos: ["ano", "anos"],
};

const MARCO: Record<string, string> = {
  fim_vigencia: "do fim da execução",
  conclusao_objeto: "da conclusão do objeto",
  fim_exercicio: "do fim do exercício",
  fim_captacao: "do fim da captação",
  envio_prestacao: "do envio",
  ciencia_diligencia: "da diligência",
  registro_decisao: "da decisão",
  ciencia_decisao: "da decisão",
  submissao_peca: "da submissão",
  protocolo_alteracao: "do pedido",
  assinatura_termo: "do termo",
  liberacao_recursos: "da liberação",
};

function quanto(regra: { quantidade: number; unidade: string }): string {
  const [um, varios] = UNIDADE[regra.unidade] ?? [regra.unidade, regra.unidade];
  return `${regra.quantidade} ${regra.quantidade === 1 ? um : varios}`;
}

/** Resumo de uma linha da dimensão definida, para a matriz. */
function resumir(regime: RegimeNormativo, chave: ChaveDimensao): string {
  switch (chave) {
    case "aplicabilidade": {
      const a = regime.aplicabilidade as Exclude<RegimeNormativo["aplicabilidade"], Lacuna>;
      const periodo = a.desde && a.ate ? `de ${dataCurta(a.desde)} a ${dataCurta(a.ate)}` : a.desde ? `desde ${dataCurta(a.desde)}` : a.ate ? `até ${dataCurta(a.ate)}` : "sem data";
      const criterio = { protocolo_projeto: "protocolo", aprovacao_projeto: "aprovação", assinatura_termo: "termo", ato_praticado: "atos" }[a.criterio];
      return `${criterio} ${periodo}`;
    }
    case "prazos": {
      const definidos = Object.values(regime.prazos).filter(p => !ehLacuna(p));
      const final = regime.prazos.prestacaoFinal;
      if (definidos.length === 0) return "nenhum prazo de lei; os essenciais dizem por quê";
      const envio = final && !ehLacuna(final) ? `; envio em ${quanto(final)} ${MARCO[final.marco] ?? final.marco}` : "";
      const lacunas = Object.values(regime.prazos).length - definidos.length;
      return `${definidos.length} prazos${envio}${lacunas ? `; ${lacunas} sem prazo na norma` : ""}`;
    }
    case "prestacaoParcial": {
      const p = regime.prestacaoParcial as Exclude<RegimeNormativo["prestacaoParcial"], Lacuna>;
      const nomes = { continua: "contínua", periodica: "periódica", por_parcela: "por parcela", a_criterio_do_orgao: "a pedido do órgão" };
      return p.modalidades.map(m => nomes[m]).join(", ");
    }
    case "orcamento": {
      const o = regime.orcamento as Exclude<RegimeNormativo["orcamento"], Lacuna>;
      return `${o.grupos.length} grupos, ${o.tetos.length} ${o.tetos.length === 1 ? "teto" : "tetos"}${o.tetos.length ? ` (${o.tetos.map(t => `${t.descricao.split(",")[0].toLowerCase()} ${pct(t.percentual)}`).slice(0, 2).join(", ")}${o.tetos.length > 2 ? "…" : ""})` : ""}`;
    }
    case "alteracoes": {
      const a = regime.alteracoes as Exclude<RegimeNormativo["alteracoes"], Lacuna>;
      const r = a.tipos.remanejamento;
      const rem = !r.permitido ? "remanejamento vedado" : r.classificacao === "formal" ? "remanejamento com pedido" : r.condicoes.length ? "remanejamento livre com condições" : "remanejamento livre";
      return `${rem}; ${a.silencioAprova ? "silêncio aprova" : "silêncio não aprova"}`;
    }
    case "fornecedores": {
      const f = regime.fornecedores as Exclude<RegimeNormativo["fornecedores"], Lacuna>;
      return f.limites.length
        ? f.limites.map(l => `${l.escopo === "fornecedor" ? "fornecedor" : "proponente"} ${pct(l.faixas[0].percentual)}`).join(", ")
        : `${f.regras.length} regras, sem limite percentual`;
    }
    case "contas": {
      const c = regime.contas as Exclude<RegimeNormativo["contas"], Lacuna>;
      const liberacao = c.liberacao.percentualMinimo !== null ? `liberação com ${pct(c.liberacao.percentualMinimo)}` : "liberação sem percentual";
      return `${c.contas.length} contas (${c.bancos.join(" ou ") || "banco livre"}), ${liberacao}`;
    }
    case "pagamentos": {
      const p = regime.pagamentos as Exclude<RegimeNormativo["pagamentos"], Lacuna>;
      const permitidos = p.meiosPermitidos ? p.meiosPermitidos.join(", ") : "qualquer meio bancário";
      return `${permitidos}${p.meiosVedados.length ? `; vedado: ${p.meiosVedados.join(", ")}` : ""}`;
    }
    case "despesas": {
      const d = regime.despesas as Exclude<RegimeNormativo["despesas"], Lacuna>;
      return `${d.vedadas.length} vedações, ${d.regras.length} regras`;
    }
    case "porte": {
      const p = regime.porte as Exclude<RegimeNormativo["porte"], Lacuna>;
      return p.faixas.map(f => (f.ate === null ? f.nome : `${f.nome} até ${reais(f.ate)}`)).join(", ");
    }
    case "objeto": {
      const o = regime.objeto as Exclude<RegimeNormativo["objeto"], Lacuna>;
      return `${o.regras.length} regras`;
    }
    case "divulgacao": {
      const d = regime.divulgacao as Exclude<RegimeNormativo["divulgacao"], Lacuna>;
      return `${d.marcas.length} marcas${d.aprovacaoPrevia.exigida ? ", aprovação prévia" : ""}${d.defeso ? ", defeso" : ""}`;
    }
    case "envio": {
      const e = regime.envio as Exclude<RegimeNormativo["envio"], Lacuna>;
      return `${e.sistema}; ${e.documentos.length} documentos, ${e.modelos.length} ${e.modelos.length === 1 ? "modelo" : "modelos"}`;
    }
    case "posEnvio": {
      const p = regime.posEnvio as Exclude<RegimeNormativo["posEnvio"], Lacuna>;
      return `${p.resultados.length} resultados${p.devolucao.gru.length ? `, GRU ${p.devolucao.gru.map(g => g.codigo).join("/")}` : ""}`;
    }
    case "guarda": {
      const g = regime.guarda as Exclude<RegimeNormativo["guarda"], Lacuna>;
      return `${quanto(g)} ${MARCO[g.marco] ?? g.marco}`;
    }
  }
}

export function coberturaDoRegime(regime: RegimeNormativo): CelulaCobertura[] {
  return DIMENSOES.map(({ chave, rotulo }) => {
    const valor = (regime as Record<string, unknown>)[chave];
    const fontes = fontesEm(valor);
    const base = { chave, rotulo, fontes: fontes.length, aConfirmar: fontes.filter(f => f.aConfirmar).length };
    if (valor === undefined || valor === null) return { ...base, situacao: "ausente", resumo: "Sem regra nem lacuna" };
    if (ehLacuna(valor)) return { ...base, situacao: valor.lacuna, resumo: valor.motivo };
    return { ...base, situacao: "definida", resumo: resumir(regime, chave) };
  });
}

/** O que falta para o regime cobrir todas as dimensões; vazio quando está completo. */
export function problemasDeCobertura(regime: RegimeNormativo): string[] {
  const problemas: string[] = [];
  const generico = regime.codigo === "generico";
  for (const celula of coberturaDoRegime(regime)) {
    if (celula.situacao === "ausente") problemas.push(`${celula.chave}: sem regras nem lacuna`);
    const valor = (regime as Record<string, unknown>)[celula.chave];
    if (ehLacuna(valor) && (!valor.motivo?.trim() || !valor.fonte?.documento || !valor.fonte?.dispositivo)) {
      problemas.push(`${celula.chave}: lacuna sem motivo ou sem fonte`);
    }
    if (celula.situacao === "definida" && celula.fontes === 0) problemas.push(`${celula.chave}: regras sem fonte`);
  }
  for (const chave of PRAZOS_ESSENCIAIS) {
    if (!regime.prazos[chave]) problemas.push(`prazos.${chave}: sem prazo nem lacuna`);
  }
  // Uma lei sempre diz a que projetos se aplica e como é o orçamento.
  if (!generico) {
    if (ehLacuna(regime.aplicabilidade)) problemas.push("aplicabilidade: toda lei diz a que projetos se aplica");
    if (ehLacuna(regime.orcamento)) problemas.push("orcamento: toda lei tem estrutura e grupos de orçamento");
    if (ehLacuna(regime.envio)) problemas.push("envio: toda lei diz como a prestação é entregue");
    if (ehLacuna(regime.posEnvio)) problemas.push("posEnvio: toda lei diz os resultados possíveis");
  }
  return problemas;
}

const SITUACAO: Record<SituacaoDimensao, string> = {
  definida: "",
  nao_se_aplica: "Não se aplica: ",
  norma_silente: "A norma não trata: ",
  ausente: "FALTA: ",
};

function celulaCurta(c: CelulaCobertura): string {
  const texto = c.situacao === "definida" ? c.resumo : c.situacao === "nao_se_aplica" ? "não se aplica" : c.situacao === "norma_silente" ? "a norma não trata" : "FALTA";
  return `${texto}${c.aConfirmar ? ` (${c.aConfirmar} a confirmar)` : ""}`.replace(/\|/g, "/");
}

/** A matriz dimensão × regime em Markdown, com o detalhe de cada regime. */
export function gerarMatrizCobertura(regimes: readonly RegimeNormativo[] = REGIMES): string {
  const coberturas = regimes.map(r => ({ regime: r, celulas: coberturaDoRegime(r) }));
  const linhas: string[] = [
    "# Matriz de cobertura dos regimes",
    "",
    "> Gerada por `scripts/prestacao-gerar-matriz-regimes.ts` a partir de `lib/prestacao/regimes`. Não edite à mão: mude o regime e gere de novo. O teste `tests/prestacao-regimes-cobertura.test.ts` falha se este arquivo ficar diferente do código ou se um regime deixar uma dimensão sem regras e sem lacuna explicada.",
    "",
    "Cada célula resume o que o regime traz na dimensão. \"Não se aplica\" e \"a norma não trata\" vêm com o motivo e a fonte no detalhe abaixo. \"A confirmar\" conta as regras que vieram de fonte secundária ou ambígua: a checagem só alerta.",
    "",
    `| Dimensão | ${regimes.map(r => `${r.nome} (v${r.versao})`).join(" | ")} |`,
    `|---|${regimes.map(() => "---").join("|")}|`,
    ...DIMENSOES.map((d, i) => `| ${d.rotulo} | ${coberturas.map(c => celulaCurta(c.celulas[i])).join(" | ")} |`),
    `| **Regras com fonte** | ${coberturas.map(c => String(c.celulas.reduce((s, x) => s + x.fontes, 0))).join(" | ")} |`,
    `| **A confirmar** | ${coberturas.map(c => String(c.celulas.reduce((s, x) => s + x.aConfirmar, 0))).join(" | ")} |`,
    "",
  ];

  for (const { regime, celulas } of coberturas) {
    linhas.push(`## ${regime.nome} (v${regime.versao})`, "");
    linhas.push(`- Código: \`${regime.codigo}\`. Órgão: ${regime.orgao}. Sistema: ${regime.sistemaOficial ?? "nenhum"}.`);
    linhas.push(`- Norma: ${regime.normaReferencia}.`);
    linhas.push("");
    linhas.push("| Dimensão | Situação | Fontes | A confirmar |");
    linhas.push("|---|---|---|---|");
    for (const c of celulas) {
      linhas.push(`| ${c.rotulo} | ${`${SITUACAO[c.situacao]}${c.resumo}`.replace(/\|/g, "/")} | ${c.fontes} | ${c.aConfirmar} |`);
    }
    const aConfirmar = DIMENSOES.flatMap(d => fontesEm((regime as Record<string, unknown>)[d.chave])
      .filter(f => f.aConfirmar)
      .map(f => `${d.rotulo}: ${f.documento}, ${f.dispositivo}${f.nota ? ` (${f.nota})` : ""}`));
    if (aConfirmar.length) {
      linhas.push("", "A confirmar:", "", ...[...new Set(aConfirmar)].map(t => `- ${t}`));
    }
    linhas.push("");
  }
  return linhas.join("\n");
}
