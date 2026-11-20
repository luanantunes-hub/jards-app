// Checagens financeiras e de documento (P2.8), escritas a partir do que o
// regime define, a começar pela Rouanet (IN MinC 29/2026): valem para todo
// regime que traga a mesma regra, com a severidade e a fonte dele.
//
//  * período: documento emitido antes da aprovação ou depois do fim da
//    execução; pagamento antes da liberação dos recursos;
//  * orçamento: despesas acima do vigente do item, grupo de custo acima do
//    teto e alteração pedida sem decisão;
//  * concentração: despesas com um mesmo fornecedor (ou grupo) e com o
//    proponente e as partes relacionadas acima do limite do regime.
//
// O valor captado vem dos aportes do extrato (créditos da categoria
// "aporte"). Onde falta dado (datas, captado), o achado é "não calculável" e
// diz o que falta.

import { ehDespesa } from "../despesas";
import { basesDoOrcamento, itensDaArvore, montarArvore, ROTULO_DA_BASE, tetosPorGrupo } from "../orcamento";
import { limparDocumento } from "../fornecedores";
import { limiteDeElaboracao } from "../nivel-esportivo";
import { definida, regraDoRegime } from "../regimes";
import { execucaoTerminou } from "../objeto";
import type { BaseCalculo, LimiteConcentracao } from "../regimes/tipos";
import { rotuloDaForma } from "../pagamentos";
import {
  centavos,
  dataBr,
  justificativaDaDespesa,
  novoAchado,
  reais,
  severidadeDaChecagem,
  type Achado,
  type DespesaDoEstado,
  type EstadoDaPrestacao,
} from "./catalogo";
import type { PrestacaoFornecedor } from "@/lib/supabase/types";

const valida = (d: DespesaDoEstado) => d.status !== "rejeitado" && ehDespesa(d.tipo);

/** Soma dos aportes no extrato, em centavos; é o valor captado que o motor conhece. */
export function captadoDoExtrato(estado: Pick<EstadoDaPrestacao, "lancamentos">): number {
  return estado.lancamentos.filter(l => l.natureza === "credito" && l.categoria === "aporte").reduce((s, l) => s + centavos(l.valor), 0);
}

// ─── Período ────────────────────────────────────────────────────────────────

export function checarPeriodo(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const datas = estado.prestacao ?? {};
  const achados: Achado[] = [];
  const despesas = estado.despesas.filter(d => valida(d) && d.data_doc);

  const inicio = datas.data_aprovacao ?? datas.data_inicio_execucao ?? null;
  const rotuloInicio = datas.data_aprovacao ? "da aprovação" : "do início da execução";
  const fim = datas.data_fim_execucao ?? null;
  const severidadePeriodo = severidadeDaChecagem(regime, "DOC_FORA_VIGENCIA", "info");
  for (const d of despesas) {
    const data = d.data_doc!.slice(0, 10);
    const fora = inicio && data < inicio ? { ref: "antes", texto: `antes ${rotuloInicio} (${dataBr(inicio)})` }
      : fim && data > fim ? { ref: "depois", texto: `depois do fim da execução (${dataBr(fim)})` }
      : null;
    if (!fora) continue;
    achados.push(novoAchado(regime, {
      codigo: "DOC_FORA_VIGENCIA", severidade: severidadePeriodo, entidade: { tipo: "despesa", id: d.id }, ref: fora.ref,
      mensagem: `Documento de ${dataBr(data)}, ${fora.texto}.`,
      dados: { despesa: d.nome_arquivo, data, inicio, fim },
      justificativa: justificativaDaDespesa(d, severidadePeriodo),
    }));
  }
  if (despesas.length && !inicio && !fim && severidadePeriodo !== "info") {
    achados.push(novoAchado(regime, {
      codigo: "DATAS_DA_PRESTACAO", severidade: "info", entidade: { tipo: "prestacao", id: null }, ref: "periodo",
      mensagem: "Informe a data de aprovação (ou de início da execução) e a de fim da execução para conferir o período dos documentos.",
    }));
  }

  // Liberação: o regime diz quando o recurso fica livre para execução.
  const liberacao = regime ? definida(regime.contas)?.liberacao ?? null : null;
  if (liberacao) {
    const rejeitadas = new Set(estado.despesas.filter(d => d.status === "rejeitado").map(d => d.id));
    const pagamentos = estado.pagamentos.filter(p => !rejeitadas.has(p.despesa_id));
    const nomes = new Map(estado.despesas.map(d => [d.id, d.nome_arquivo]));
    if (datas.data_liberacao) {
      for (const p of pagamentos) {
        if (p.data >= datas.data_liberacao) continue;
        achados.push(novoAchado(regime, {
          codigo: "LIBERACAO_MINIMA", severidade: "justificativa", entidade: { tipo: "pagamento", id: p.id },
          mensagem: `Pagamento de ${reais(centavos(p.valor))} em ${dataBr(p.data)} (${rotuloDaForma(p.forma)}) de "${nomes.get(p.despesa_id) ?? "despesa"}", antes da liberação dos recursos (${dataBr(datas.data_liberacao)}).`,
          dados: { despesa: nomes.get(p.despesa_id) ?? null, data: p.data, liberacao: datas.data_liberacao },
          fonte: { ...liberacao.fonte },
        }));
      }
    } else if (pagamentos.length) {
      achados.push(novoAchado(regime, {
        codigo: "DATAS_DA_PRESTACAO", severidade: "info", entidade: { tipo: "prestacao", id: null }, ref: "liberacao",
        mensagem: "Informe a data de liberação dos recursos para conferir os pagamentos feitos antes dela.",
        fonte: { ...liberacao.fonte },
      }));
    }
  }
  return achados;
}

// ─── Orçamento ──────────────────────────────────────────────────────────────

export function checarOrcamento(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const achados: Achado[] = [];
  const nos = estado.nos ?? [];

  if (nos.length) {
    const arvore = montarArvore(nos, estado.despesas.filter(valida), estado.pagamentos);
    for (const linha of itensDaArvore(arvore.raizes)) {
      const gasto = centavos(linha.totais.comprometido) + centavos(linha.totais.pago);
      const vigente = centavos(linha.totais.vigente);
      if (gasto <= vigente) continue;
      achados.push(novoAchado(regime, {
        codigo: "ITEM_SEM_SALDO", severidade: "bloqueio", entidade: { tipo: "prestacao", id: null }, ref: linha.no.id,
        mensagem: `As despesas do item "${linha.no.nome}" somam ${reais(gasto)}, acima do vigente (${reais(vigente)}): remaneje o orçamento ou revise as despesas.`,
        dados: { item: linha.no.nome, vigente: vigente / 100, despesas: gasto / 100 },
      }));
    }

    const captado = captadoDoExtrato(estado);
    const tetos = regime ? definida(regime.orcamento)?.tetos ?? [] : [];
    // Com o nível esportivo na prestação, o limite de elaboração e captação é o do nível (checar-esporte.ts, P8.4).
    const elaboracaoPeloNivel = limiteDeElaboracao(estado) !== null;
    for (const t of tetosPorGrupo(arvore.raizes, regime, { valor_captado: captado ? captado / 100 : null })) {
      if (!t.excedido || !t.limite || t.limite.maximo === null) continue;
      if (elaboracaoPeloNivel && t.grupo === "elaboracao") continue;
      const regra = tetos.find(r => r.descricao === t.limite!.descricao);
      achados.push(novoAchado(regime, {
        codigo: "TETO_GRUPO_CUSTO", severidade: t.limite.severidade, entidade: { tipo: "prestacao", id: null }, ref: t.grupo ?? "sem_grupo",
        mensagem: `${t.limite.descricao}: ${reais(centavos(t.limite.valorLimitado))} no orçamento vigente, acima do teto de ${t.limite.percentual}% ${t.limite.base} (${reais(centavos(t.limite.maximo))}).`,
        dados: { grupo: t.rotulo, valor: t.limite.valorLimitado, maximo: t.limite.maximo, percentual: t.limite.percentual },
        fonte: regra ? { ...regra.fonte } : null,
      }));
    }
  }

  const severidadeAlteracao = severidadeDaChecagem(regime, "ALTERACAO_PENDENTE", "info");
  for (const a of estado.alteracoes ?? []) {
    if (a.status !== "solicitada") continue;
    achados.push(novoAchado(regime, {
      codigo: "ALTERACAO_PENDENTE", severidade: severidadeAlteracao, entidade: { tipo: "prestacao", id: null }, ref: a.id,
      mensagem: `A alteração nº ${a.numero} do orçamento${a.solicitada_em ? `, pedida em ${dataBr(a.solicitada_em)},` : ""} ainda não tem decisão registrada.`,
      dados: { numero: a.numero, solicitada_em: a.solicitada_em },
    }));
  }
  return [...achados, ...checarContrapartida(estado)];
}

// ─── Contrapartida (P7.2) ───────────────────────────────────────────────────

export type ContrapartidaDaPrestacao = {
  percentual: number;
  /** Em centavos: o orçamento global vigente, o mínimo e o que as despesas comprovam. */
  orcamento: number;
  minimo: number;
  financeira: number;
  doacao: number;
  comprovada: number;
};

/**
 * O mínimo de contrapartida do regime (regra contrapartida_minima) sobre o
 * orçamento global vigente e o que as despesas marcadas como contrapartida
 * comprovam. Null quando o regime não pede contrapartida ou falta orçamento.
 */
export function contrapartidaDaPrestacao(estado: Pick<EstadoDaPrestacao, "regime" | "despesas" | "nos">): ContrapartidaDaPrestacao | null {
  const regra = regraDoRegime(estado.regime, "contrapartida_minima");
  const percentual = Number(regra?.parametros?.percentual);
  if (!regra || !(percentual > 0) || !estado.nos?.length) return null;
  const orcamento = centavos(basesDoOrcamento(montarArvore(estado.nos, []).raizes, estado.regime).valorTotalProjeto);
  const soma = (tipo: "financeira" | "doacao") => estado.despesas
    .filter(d => valida(d) && d.contrapartida === tipo).reduce((s, d) => s + centavos(d.valor_extraido), 0);
  const financeira = soma("financeira");
  const doacao = soma("doacao");
  return { percentual, orcamento, minimo: Math.ceil((orcamento * percentual) / 100), financeira, doacao, comprovada: financeira + doacao };
}

export function checarContrapartida(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const regra = regraDoRegime(regime, "contrapartida_minima");
  // Sem despesa ainda, não há o que comparar.
  if (!regra || !estado.despesas.some(valida)) return [];
  const conta = contrapartidaDaPrestacao(estado);
  if (!conta) {
    if (estado.nos?.length) return [];
    return [novoAchado(regime, {
      codigo: "CONTRAPARTIDA_MINIMA", severidade: "info", resultado: "nao_calculavel", entidade: { tipo: "prestacao", id: null }, ref: "sem_orcamento",
      mensagem: "Cadastre o orçamento para conferir a contrapartida mínima.",
    })];
  }
  if (conta.comprovada >= conta.minimo) return [];

  // Na execução ainda dá para completar; depois do fim, falta de contrapartida impede o envio.
  const fim = estado.prestacao?.data_fim_execucao ?? null;
  const terminou = execucaoTerminou(fim, estado.hoje ?? new Date());
  const minimo = `${reais(conta.minimo)} (${conta.percentual}% do orçamento global de ${reais(conta.orcamento)})`;
  const partes = [conta.financeira && `${reais(conta.financeira)} em dinheiro`, conta.doacao && `${reais(conta.doacao)} por doação`].filter(Boolean);
  const comprovada = conta.comprovada
    ? `Contrapartida comprovada: ${reais(conta.comprovada)}${partes.length > 1 ? ` (${partes.join(" e ")})` : ""}, abaixo do mínimo de ${minimo}; faltam ${reais(conta.minimo - conta.comprovada)}.`
    : `Nenhuma despesa marcada como contrapartida; o mínimo é ${minimo}.`;
  return [novoAchado(regime, {
    codigo: "CONTRAPARTIDA_MINIMA",
    severidade: terminou ? regra.severidade : "alerta",
    entidade: { tipo: "prestacao", id: null },
    ref: "minimo",
    mensagem: `${comprovada} Marque em "Paga com" as despesas pagas como contrapartida${!terminou && fim ? `; a execução vai até ${dataBr(fim)}` : ""}.`,
    dados: { percentual: conta.percentual, orcamento: conta.orcamento / 100, minimo: conta.minimo / 100, financeira: conta.financeira / 100, doacao: conta.doacao / 100, falta: (conta.minimo - conta.comprovada) / 100 },
  })];
}

// ─── Concentração ───────────────────────────────────────────────────────────

/** Mesmo fornecedor: o grupo econômico informado, ou o CNPJ raiz (8 primeiras posições); pessoa física pelo CPF. */
function chaveDoFornecedor(f: PrestacaoFornecedor): string {
  const grupo = (f.grupo_economico ?? "").trim();
  if (grupo) return `grupo:${grupo.toLowerCase()}`;
  const documento = limparDocumento(f.documento);
  if (!documento) return `id:${f.id}`;
  return f.tipo_pessoa === "pj" || f.tipo_pessoa === "mei" ? `raiz:${documento.slice(0, 8)}` : `doc:${documento}`;
}

const nomeDoFornecedor = (f: PrestacaoFornecedor) => f.razao_social || f.nome || f.documento || "Fornecedor";

function dicaDaBase(base: BaseCalculo): string {
  if (base === "valor_captado") return "Importe o extrato da conta de captação com os aportes.";
  if (base === "valor_executado") return "Registre o valor das despesas.";
  return "Cadastre o orçamento com os grupos de custo.";
}

export function checarConcentracao(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const limites = regime ? definida(regime.fornecedores)?.limites ?? [] : [];
  if (!limites.length) return [];

  const fornecedores = new Map(estado.fornecedores.map(f => [f.id, f]));
  const comFornecedor = (d: DespesaDoEstado) => valida(d) && Boolean(d.fornecedor_id) && fornecedores.has(d.fornecedor_id!) && centavos(d.valor_extraido) > 0;
  const despesas = estado.despesas.filter(comFornecedor);
  // P7.4: na mesma obra (ANCINE), o limite sobre o executado soma as despesas de todas as prestações.
  const obra = estado.obra?.prestacoes.length ? estado.obra : null;
  const despesasDaObra = obra ? obra.despesas.filter(comFornecedor) : [];
  if (!despesas.length && !despesasDaObra.length) return [];

  const executado = estado.despesas.filter(valida).reduce((s, d) => s + centavos(d.valor_extraido), 0);
  const executadoDaObra = executado + (obra ? obra.despesas.filter(valida).reduce((s, d) => s + centavos(d.valor_extraido), 0) : 0);
  const captado = captadoDoExtrato(estado);
  const doOrcamento = estado.nos?.length ? basesDoOrcamento(montarArvore(estado.nos, []).raizes, regime) : null;
  const valorDaBase = (base: BaseCalculo): number | null => {
    if (base === "valor_captado") return captado || null;
    if (base === "valor_executado") return executado || null;
    if (!doOrcamento) return null;
    const valor = doOrcamento.porBase[base as keyof typeof doOrcamento.porBase]
      ?? (base === "valor_projeto" ? doOrcamento.valorProjeto : base === "valor_total_projeto" ? doOrcamento.valorTotalProjeto : null);
    return valor ? centavos(valor) : null;
  };

  const achados: Achado[] = [];
  for (const limite of limites) {
    // O limite de proponente pessoa física ou MEI depende do tipo do proponente, que a prestação ainda não guarda.
    if (limite.escopo === "proponente_pf_mei") continue;
    const somaObra = Boolean(obra) && limite.base === "valor_executado";
    const grupos = agrupar(limite, somaObra ? [...despesas, ...despesasDaObra] : despesas, fornecedores);
    if (!grupos.length) continue;
    const base = somaObra ? executadoDaObra || null : valorDaBase(limite.base);
    const daObra = somaObra ? ` Soma as ${obra!.prestacoes.length + 1} prestações da mesma obra.` : "";
    const primeira = limite.faixas[0];
    if (!base) {
      achados.push(novoAchado(regime, {
        codigo: "LIMITE_SEM_BASE", severidade: "info", entidade: { tipo: "prestacao", id: null }, ref: limite.codigo,
        mensagem: `Sem ${ROTULO_DA_BASE[limite.base].replace(/^d[oa] /, "o ")} para conferir "${limite.descricao}"${primeira ? ` (até ${primeira.percentual}% ${ROTULO_DA_BASE[limite.base]})` : ""}. ${dicaDaBase(limite.base)}`,
        fonte: { ...limite.fonte },
      }));
      continue;
    }
    const codigo = limite.escopo === "fornecedor" ? "FORNECEDOR_CONCENTRACAO" : "PROPONENTE_PARTES_RELACIONADAS";
    for (const grupo of grupos) {
      const percentual = (grupo.soma / base) * 100;
      const faixa = [...limite.faixas].reverse().find(f => percentual > f.percentual);
      if (!faixa) continue;
      const excecoes = limite.excecoes.length ? ` Se for exceção da norma (${limite.excecoes.map(e => e.descricao.toLowerCase()).join("; ")}), dispense com o motivo.` : "";
      achados.push(novoAchado(regime, {
        codigo, severidade: faixa.severidade, entidade: { tipo: "prestacao", id: null }, ref: `${limite.codigo}:${grupo.chave}`,
        mensagem: `${grupo.nome}: ${reais(grupo.soma)} em despesas, ${percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% ${ROTULO_DA_BASE[limite.base]} (${reais(base)}); o limite é ${faixa.percentual}%. ${faixa.consequencia}.${daObra}${excecoes}`,
        dados: { fornecedor: grupo.nome, soma: grupo.soma / 100, base: base / 100, percentual: Math.round(percentual * 10) / 10, limite: faixa.percentual, ...(somaObra ? { prestacoes_da_obra: obra!.prestacoes.length + 1 } : {}) },
        fonte: { ...limite.fonte },
      }));
    }
  }
  return achados;
}

function agrupar(limite: LimiteConcentracao, despesas: readonly DespesaDoEstado[], fornecedores: ReadonlyMap<string, PrestacaoFornecedor>) {
  const grupos = new Map<string, { chave: string; grupo: string | null; soma: number; nomes: Set<string> }>();
  for (const d of despesas) {
    const f = fornecedores.get(d.fornecedor_id!)!;
    if (limite.escopo === "proponente_e_relacionados" && !f.parte_relacionada) continue;
    const chave = limite.escopo === "fornecedor" ? chaveDoFornecedor(f) : "partes_relacionadas";
    const atual = grupos.get(chave) ?? { chave, grupo: (f.grupo_economico ?? "").trim() || null, soma: 0, nomes: new Set<string>() };
    atual.soma += centavos(d.valor_extraido);
    atual.nomes.add(nomeDoFornecedor(f));
    grupos.set(chave, atual);
  }
  return [...grupos.values()].map(g => {
    const nomes = [...g.nomes];
    const nome = limite.escopo !== "fornecedor"
      ? `Proponente e partes relacionadas (${nomes.slice(0, 3).join(", ")}${nomes.length > 3 ? "…" : ""})`
      : g.chave.startsWith("grupo:") && g.grupo ? `Grupo ${g.grupo} (${nomes.slice(0, 3).join(", ")}${nomes.length > 3 ? "…" : ""})`
      : `${nomes[0]}${nomes.length > 1 ? ` e mais ${nomes.length - 1} do mesmo CNPJ raiz` : ""}`;
    return { chave: g.chave, nome, soma: g.soma };
  }).sort((a, b) => b.soma - a.soma || a.chave.localeCompare(b.chave));
}
