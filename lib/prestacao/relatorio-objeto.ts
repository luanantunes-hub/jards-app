// Rascunho do relatório do objeto (P4.3).
//
// O relatório de cumprimento do objeto é montado com o que a prestação já
// guarda (metas, atividades, locais, evidências, distribuição, peças, bens,
// alterações e o checklist de envio), nos campos do sistema oficial:
//  * Rouanet: as telas da Comprovação Física do Salic (Manual do Proponente,
//    Módulo III, p. 42–54) e o conteúdo do art. 69 da IN 29/2026;
//  * LIE: o modelo RCO 2026 ("Relatório de Cumprimento do Objeto");
//  * demais regimes: um relatório com as mesmas partes, sem tela própria.
//
// Cada dado leva à aba de onde veio. O que falta vira lacuna, nunca texto
// inventado: meta sem resultado, diferença sem justificativa, campo que só a
// pessoa sabe (empregos gerados, repercussão). Esses textos ficam guardados em
// prestacao_relatorio, uma linha por seção. Sem React e sem Supabase.

import { checklistDeEnvio, type DadosDoChecklist } from "./envio";
import { rotuloDaCategoria } from "./distribuicao";
import { nomeDaEvidencia, rotuloDoTipo } from "./evidencias";
import { rotuloTipoAlteracao } from "./alteracoes";
import { limparDocumento } from "./fornecedores";
import { definida, type Fonte, type RegimeNormativo } from "./regimes";
import type { EstadoDaPrestacao } from "./checagens/catalogo";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type AbaDoRelatorio = "visao_geral" | "objeto" | "atividades" | "distribuicao" | "bens" | "divulgacao" | "orcamento" | "envio";
/** Onde o dado está: a aba e, quando há, o registro (?meta=, ?local=, ?linha=, ?bem=, ?peca=, ?evidencia=). */
export type FonteDoDado = { aba: AbaDoRelatorio; parametro?: "meta" | "local" | "linha" | "bem" | "peca" | "evidencia"; id?: string };

export type Trecho =
  | { tipo: "texto"; texto: string }
  | { tipo: "dado"; texto: string; fonte: FonteDoDado }
  | { tipo: "lacuna"; texto: string; fonte: FonteDoDado | null };
export type Paragrafo = Trecho[];

export type ModeloDoRelatorio = "salic" | "rco" | "generico";

export type SecaoDoRelatorio = {
  id: string;
  titulo: string;
  /** O texto de orientação da tela ou do modelo oficial. */
  instrucao: string | null;
  obrigatoria: boolean;
  paragrafos: Paragrafo[];
  tabela: { colunas: string[]; linhas: Paragrafo[][] } | null;
  /** Números que só a pessoa sabe (empregos), guardados com a seção. */
  numeros: { id: string; rotulo: string; valor: number | null }[] | null;
  /** Texto da pessoa, guardado em prestacao_relatorio. */
  complemento: { rotulo: string; obrigatorio: boolean; limite: number | null; valor: string } | null;
  /** Arquivos a anexar na tela oficial. */
  documentos: { nome: string; fonte: FonteDoDado }[];
  lacunas: number;
};

export type RascunhoDoRelatorio = {
  modelo: ModeloDoRelatorio;
  titulo: string;
  descricao: string;
  fonte: Fonte | null;
  secoes: SecaoDoRelatorio[];
  lacunas: number;
};

export type DadosDoRelatorio = {
  regime: RegimeNormativo | null;
  estado: EstadoDaPrestacao;
  prestacao: { titulo: string; identificador_oficial: string | null; proponente: { nome: string; cnpj: string | null } | null };
  /** Conteúdo guardado por seção (chave de prestacao_relatorio.secao). */
  guardados: Readonly<Record<string, string>>;
  /** Checklist de envio (aceite de obra, documentos do RCO); sem ele, essas partes viram lacuna. */
  envio?: Omit<DadosDoChecklist, "etapa">;
};

// ─── Peças de texto ─────────────────────────────────────────────────────────

const t = (texto: string): Trecho => ({ tipo: "texto", texto });
const dado = (texto: string, fonte: FonteDoDado): Trecho => ({ tipo: "dado", texto, fonte });
const lacuna = (texto: string, fonte: FonteDoDado | null = null): Trecho => ({ tipo: "lacuna", texto, fonte });

const numero = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : null);
const plural = (n: number, um: string, varios: string) => `${numero(n)} ${n === 1 ? um : varios}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Chave de prestacao_relatorio.secao para o texto da pessoa numa seção. */
export const chaveDoComplemento = (modelo: ModeloDoRelatorio, secao: string) => `${modelo}:${secao}`;
export const chaveDosNumeros = (modelo: ModeloDoRelatorio, secao: string) => `${modelo}:${secao}:numeros`;

/** Lê os números guardados ({"diretos": 3}); o que não for número fica null. */
export function lerNumeros(conteudo: string | undefined, ids: readonly string[]): Record<string, number | null> {
  let cru: unknown = null;
  try { cru = conteudo ? JSON.parse(conteudo) : null; } catch { cru = null; }
  const obj = cru && typeof cru === "object" ? (cru as Record<string, unknown>) : {};
  return Object.fromEntries(ids.map(id => {
    const v = obj[id];
    return [id, typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null];
  }));
}

function secao(campos: Partial<SecaoDoRelatorio> & Pick<SecaoDoRelatorio, "id" | "titulo">): SecaoDoRelatorio {
  const s: SecaoDoRelatorio = {
    instrucao: null, obrigatoria: false, paragrafos: [], tabela: null, numeros: null, complemento: null, documentos: [], lacunas: 0, ...campos,
  };
  const trechos = [...s.paragrafos.flat(), ...(s.tabela?.linhas.flat(2) ?? [])];
  s.lacunas = trechos.filter(x => x.tipo === "lacuna").length
    + (s.numeros?.filter(n => n.valor === null).length ?? 0)
    + (s.complemento?.obrigatorio && !s.complemento.valor.trim() ? 1 : 0);
  return s;
}

function complemento(d: DadosDoRelatorio, modelo: ModeloDoRelatorio, id: string, rotulo: string, obrigatorio: boolean, limite: number | null = null) {
  return { rotulo, obrigatorio, limite, valor: d.guardados[chaveDoComplemento(modelo, id)] ?? "" };
}

// ─── Partes comuns ──────────────────────────────────────────────────────────

const FONTE_METAS: FonteDoDado = { aba: "objeto" };

/** Uma linha por meta: previsto, realizado, percentual e a justificativa da diferença. */
function paragrafosDasMetas(d: DadosDoRelatorio): Paragrafo[] {
  const metas = d.estado.metas ?? [];
  if (metas.length === 0) return [[lacuna("cadastre as metas do objeto, com o previsto e o realizado", FONTE_METAS)]];
  return metas.map(m => {
    const fonte: FonteDoDado = { aba: "objeto", parametro: "meta", id: m.id };
    const unidade = m.unidade?.trim() ? ` ${m.unidade.trim()}` : "";
    const p: Paragrafo = [dado(m.descricao, fonte), t(": previsto "), dado(`${numero(Number(m.previsto))}${unidade}`, fonte), t(", realizado ")];
    if (m.realizado === null || m.realizado === undefined) {
      p.push(lacuna(`resultado alcançado em "${m.descricao}"`, fonte), t("."));
      return p;
    }
    const realizado = Number(m.realizado);
    const previsto = Number(m.previsto);
    p.push(dado(`${numero(realizado)}${unidade}`, fonte));
    if (previsto > 0) p.push(t(" ("), dado(`${numero(Math.round((realizado / previsto) * 1000) / 10)}%`, fonte), t(")"));
    p.push(t("."));
    if (realizado < previsto) {
      p.push(t(" "), m.justificativa?.trim() ? dado(`Justificativa: ${m.justificativa.trim()}`, fonte) : lacuna("justifique a diferença entre o previsto e o realizado", fonte));
    }
    return p;
  });
}

/** Atividades realizadas (quantas e de quando a quando) e as não realizadas, com o motivo. */
function paragrafosDasAtividades(d: DadosDoRelatorio): Paragrafo[] {
  const atividades = d.estado.atividades ?? [];
  if (atividades.length === 0) return [];
  const fonte: FonteDoDado = { aba: "atividades" };
  const realizadas = atividades.filter(a => (a.status_realizacao ?? "realizado") === "realizado");
  const naoRealizadas = atividades.filter(a => a.status_realizacao === "nao_realizado");
  const saida: Paragrafo[] = [];
  if (realizadas.length) {
    const datas = realizadas.map(a => a.data_realizacao).filter(Boolean).sort();
    saida.push([t("Foram realizadas "), dado(plural(realizadas.length, "atividade", "atividades"), fonte),
      ...(datas.length ? [t(datas.length > 1 ? ", de " : ", em "), dado(dataBr(datas[0])!, fonte), ...(datas.length > 1 ? [t(" a "), dado(dataBr(datas[datas.length - 1])!, fonte)] : [])] : []),
      t(".")]);
  }
  for (const a of naoRealizadas) {
    const motivo = a.justificativa_nao_realizacao?.trim();
    saida.push([t("Não realizada: "), dado(a.titulo, fonte), t(". "), motivo ? dado(`Motivo: ${motivo}`, fonte) : lacuna(`motivo de "${a.titulo}" não ter sido realizada`, fonte)]);
  }
  return saida;
}

type Requisito = "acessibilidade" | "democratizacao";

function evidenciasDo(d: DadosDoRelatorio, requisito: Requisito) {
  return (d.estado.evidencias ?? []).filter(e => e.requisitos?.includes(requisito));
}

/** O que as atividades descrevem e as evidências comprovam para um requisito do objeto. */
function paragrafosDoRequisito(d: DadosDoRelatorio, requisito: Requisito, falta: string): { paragrafos: Paragrafo[]; documentos: SecaoDoRelatorio["documentos"] } {
  const evidencias = evidenciasDo(d, requisito);
  const campo = requisito === "acessibilidade" ? "acessibilidade_descricao" : "democratizacao_descricao";
  const descritas = (d.estado.atividades ?? []).filter(a => a[campo]?.trim());
  const paragrafos: Paragrafo[] = descritas.map(a => [dado(a.titulo, { aba: "atividades" }), t(": "), dado(a[campo]!.trim(), { aba: "atividades" })]);
  if (evidencias.length) {
    paragrafos.push([t("Comprovação: "), dado(plural(evidencias.length, "evidência", "evidências"), { aba: "objeto" }), t(" ("),
      ...evidencias.flatMap((e, i) => [...(i ? [t("; ")] : []), dado(e.descricao?.trim() || nomeDaEvidencia(e), { aba: "objeto", parametro: "evidencia", id: e.id })]), t(").")]);
  } else {
    paragrafos.push([lacuna(falta, { aba: "objeto" })]);
  }
  return {
    paragrafos,
    documentos: evidencias.map(e => ({ nome: nomeDaEvidencia(e), fonte: { aba: "objeto" as const, parametro: "evidencia" as const, id: e.id } })),
  };
}

const GRATUITAS = new Set(["patrocinador", "proponente", "social", "educativo", "gratuita"]);

/** Quantos produtos foram distribuídos sem custo e a preço popular, pelo realizado. */
function paragrafosDaDemocratizacaoNaDistribuicao(d: DadosDoRelatorio): Paragrafo[] {
  const linhas = d.estado.distribuicao ?? [];
  if (!linhas.length) return [];
  const fonte: FonteDoDado = { aba: "distribuicao" };
  const somar = (filtro: (categoria: string) => boolean) => {
    const das = linhas.filter(l => filtro(l.categoria));
    const semRealizado = das.filter(l => l.quantidade_realizada === null || l.quantidade_realizada === undefined).length;
    return { total: das.reduce((s, l) => s + Number(l.quantidade_realizada ?? 0), 0), linhas: das.length, semRealizado };
  };
  // Sem nenhum realizado, a lacuna fica no lugar do número: zero seria inventar.
  const parte = (rotulo: string, g: ReturnType<typeof somar>, falta: string): Paragrafo => g.semRealizado === g.linhas
    ? [t(rotulo), lacuna(falta, fonte), t(".")]
    : [t(rotulo), dado(numero(g.total), fonte), t(g.total === 1 ? " unidade." : " unidades."),
      ...(g.semRealizado ? [t(" "), lacuna("quantidade distribuída de fato no resto do plano", fonte)] : [])];
  const gratis = somar(c => c === "social" || c === "educativo" || c === "gratuita");
  const popular = somar(c => c === "popular");
  const p: Paragrafo = [];
  if (gratis.linhas) p.push(...parte("Distribuição gratuita (social, educativa e ao público): ", gratis, "quantidade distribuída sem custo"));
  if (popular.linhas) p.push(...parte(p.length ? " Preço popular: " : "Preço popular: ", popular, "quantidade vendida a preço popular"));
  return p.length ? [p] : [];
}

function tabelaDosLocais(d: DadosDoRelatorio, comJustificativa: boolean): SecaoDoRelatorio["tabela"] {
  const locais = d.estado.locais ?? [];
  if (!locais.length) return null;
  const SITUACAO: Record<string, string> = { realizado: "Realizado", nao_realizado: "Não realizado", outras_fontes: "Realizado com outras fontes" };
  return {
    colunas: ["País", "UF", "Município", "Situação", "Início", "Fim", ...(comJustificativa ? ["Justificativa"] : [])],
    linhas: locais.map(l => {
      const fonte: FonteDoDado = { aba: "objeto", parametro: "local", id: l.id };
      const realizado = l.status === "realizado" || l.status === "outras_fontes";
      const data = (v: string | null | undefined, rotulo: string): Paragrafo => v ? [dado(dataBr(v)!, fonte)] : realizado ? [lacuna(rotulo, fonte)] : [];
      return [
        [dado(l.pais, fonte)],
        l.uf ? [dado(l.uf, fonte)] : [],
        l.municipio ? [dado(l.municipio, fonte)] : [],
        SITUACAO[l.status] ? [dado(SITUACAO[l.status], fonte)] : [lacuna("situação: realizado ou não", fonte)],
        data(l.inicio, "início"),
        data(l.fim, "fim"),
        ...(comJustificativa ? [l.justificativa?.trim() ? [dado(l.justificativa.trim(), fonte)] : []] : []),
      ];
    }),
  };
}

function tabelaDaDistribuicao(d: DadosDoRelatorio): SecaoDoRelatorio["tabela"] {
  const linhas = (d.estado.distribuicao ?? []).filter(l => GRATUITAS.has(l.categoria));
  if (!linhas.length) return null;
  return {
    colunas: ["Produto", "Categoria", "Beneficiário", "CPF/CNPJ", "Quantidade"],
    linhas: linhas.map(l => {
      const fonte: FonteDoDado = { aba: "distribuicao", parametro: "linha", id: l.id };
      const realizada = l.quantidade_realizada;
      const publico = l.categoria === "gratuita";
      return [
        [dado(l.produto, fonte)],
        [dado(rotuloDaCategoria(l.categoria), fonte)],
        // Gratuita ao público não tem um beneficiário só; as cotas (patrocinador, social…) têm.
        l.beneficiario?.trim() ? [dado(l.beneficiario.trim(), fonte)] : publico ? [t("Público em geral")] : [lacuna("quem recebeu", fonte)],
        l.beneficiario_documento ? [dado(limparDocumento(l.beneficiario_documento), fonte)] : publico ? [] : [lacuna("CPF ou CNPJ", fonte)],
        realizada === null || realizada === undefined ? [lacuna("quantidade distribuída", fonte)] : [dado(numero(Number(realizada)), fonte)],
      ];
    }),
  };
}

const TIPO_DA_EXECUCAO: Record<string, string> = { foto: "Foto", video: "Vídeo", link: "Link" };

function tabelaDaExecucao(d: DadosDoRelatorio): SecaoDoRelatorio["tabela"] {
  const evidencias = d.estado.evidencias ?? [];
  const pecas = (d.estado.pecas ?? []).filter(p => p.storage_path || p.url);
  if (!evidencias.length && !pecas.length) return null;
  return {
    colunas: ["Tipo", "Arquivo", "Observações"],
    linhas: [
      ...evidencias.map(e => {
        const fonte: FonteDoDado = { aba: "objeto", parametro: "evidencia", id: e.id };
        return [
          [dado(TIPO_DA_EXECUCAO[e.tipo] ?? `Arquivo (${rotuloDoTipo(e.tipo).toLowerCase()})`, fonte)],
          [dado(nomeDaEvidencia(e), fonte)],
          e.descricao?.trim() ? [dado(e.descricao.trim(), fonte)] : [lacuna("observação sobre a evidência", fonte)],
        ];
      }),
      ...pecas.map(p => {
        const fonte: FonteDoDado = { aba: "divulgacao", parametro: "peca", id: p.id };
        return [[dado(p.url && !p.storage_path ? "Link" : "Arquivo (divulgação)", fonte)], [dado(p.url && !p.storage_path ? p.url : p.titulo, fonte)], [dado(`Peça de divulgação: ${p.titulo}`, fonte)]];
      }),
    ],
  };
}

function tabelaDosBensDoados(d: DadosDoRelatorio): SecaoDoRelatorio["tabela"] {
  const bens = (d.estado.bens ?? []).filter(b => b.destinacao === "doacao");
  if (!bens.length) return null;
  const nomeDoItem = new Map((d.estado.nos ?? []).map(n => [n.id, n.nome]));
  return {
    colunas: ["Item orçamentário", "Bem", "Beneficiário", "CPF/CNPJ", "Quantidade", "Termo de doação", "Aceite"],
    linhas: bens.map(b => {
      const fonte: FonteDoDado = { aba: "bens", parametro: "bem", id: b.id };
      return [
        b.no_id && nomeDoItem.get(b.no_id) ? [dado(nomeDoItem.get(b.no_id)!, fonte)] : [lacuna("item do orçamento", fonte)],
        [dado(b.descricao, fonte)],
        b.beneficiario?.trim() ? [dado(b.beneficiario.trim(), fonte)] : [lacuna("quem recebeu", fonte)],
        b.beneficiario_documento ? [dado(limparDocumento(b.beneficiario_documento), fonte)] : [lacuna("CPF ou CNPJ", fonte)],
        [dado(numero(Number(b.quantidade ?? 1)), fonte)],
        b.doacao_storage_path ? [dado("anexado", fonte)] : [lacuna("termo de doação", fonte)],
        b.aceite_storage_path ? [dado("anexado", fonte)] : [lacuna("aceite de quem recebeu", fonte)],
      ];
    }),
  };
}

/** Teve obra? Pelo documento do checklist de envio (aceite da obra). */
function paragrafoDoAceiteDeObra(d: DadosDoRelatorio): Paragrafo {
  const fonte: FonteDoDado = { aba: "envio" };
  if (!d.envio) return [lacuna("informe no checklist de envio se o projeto teve obra", fonte)];
  const arquivos = d.envio.arquivos.filter(a => a.etapa === "final" && a.codigo === "aceitacao_obra");
  const marca = d.envio.marcacoes.find(m => m.etapa === "final" && m.tipo === "documento" && m.codigo === "aceitacao_obra");
  if (arquivos.length) return [t("Sim. Termo de aceitação: "), dado(arquivos.map(a => a.nome_arquivo).join(", "), fonte), t(".")];
  if (marca?.situacao === "nao_se_aplica") return [t("Não. "), dado(marca.justificativa?.trim() || "Sem obra no projeto.", fonte)];
  if (marca?.situacao === "pronto") return [t("Sim. "), lacuna("anexe o termo de aceitação definitiva da obra", fonte)];
  return [lacuna("informe no checklist de envio se o projeto teve obra (termo de aceitação ou \"não se aplica\")", fonte)];
}

// ─── Modelos ────────────────────────────────────────────────────────────────

/** Comprovação Física do Salic (Módulo III, p. 42–54), com o conteúdo do art. 69 da IN 29/2026. */
function rascunhoSalic(d: DadosDoRelatorio): SecaoDoRelatorio[] {
  const m: ModeloDoRelatorio = "salic";
  const acess = paragrafosDoRequisito(d, "acessibilidade", "anexe evidências de acessibilidade (marque o requisito nas evidências do objeto)");
  const demo = paragrafosDoRequisito(d, "democratizacao", "anexe evidências de democratização do acesso (marque o requisito nas evidências do objeto)");
  const numeros = lerNumeros(d.guardados[chaveDosNumeros(m, "empregos")], ["diretos", "indiretos"]);
  const execucao = tabelaDaExecucao(d);
  const bensDoados = tabelaDosBensDoados(d);
  const distribuicao = tabelaDaDistribuicao(d);
  const locais = tabelaDosLocais(d, true);
  return [
    secao({
      id: "etapas", titulo: "Etapas de trabalho executadas", obrigatoria: true,
      instrucao: "Descrever os objetivos e metas realizadas e discorrer sobre os resultados do projeto junto à sociedade. Em caso de divergências com o previsto, justificar.",
      paragrafos: [...paragrafosDasMetas(d), ...paragrafosDasAtividades(d)],
      complemento: complemento(d, m, "etapas", "Resultados do projeto junto à sociedade", true),
    }),
    secao({
      id: "acessibilidade", titulo: "Acessibilidade", obrigatoria: true,
      instrucao: "Acesso e lugares adaptados para pessoas com deficiência, idosas ou com mobilidade reduzida (IN 29/2026, art. 69, IV).",
      paragrafos: acess.paragrafos, documentos: acess.documentos,
      complemento: complemento(d, m, "acessibilidade", "Outras medidas de acessibilidade", false),
    }),
    secao({
      id: "democratizacao", titulo: "Medidas de democratização do acesso", obrigatoria: true,
      instrucao: "Nos termos da portaria de aprovação: realização em local de fácil acesso, transporte, atividade, distribuição, entrada franqueada e divulgação.",
      paragrafos: [...paragrafosDaDemocratizacaoNaDistribuicao(d), ...demo.paragrafos], documentos: demo.documentos,
      complemento: complemento(d, m, "democratizacao", "Outras medidas de democratização", false),
    }),
    secao({
      id: "empregos", titulo: "Empregos e qualificações decorrentes do projeto", obrigatoria: true,
      instrucao: "Diretos, indiretos e total, com a descrição.",
      numeros: [{ id: "diretos", rotulo: "Diretos", valor: numeros.diretos }, { id: "indiretos", rotulo: "Indiretos", valor: numeros.indiretos }],
      complemento: complemento(d, m, "empregos", "Empregos e qualificações", false),
    }),
    secao({
      id: "locais", titulo: "Local de realização", obrigatoria: true,
      instrucao: "Realizado pede as datas de início e fim; não realizado e realizado com outras fontes pedem justificativa de até 500 caracteres.",
      tabela: locais, paragrafos: locais ? [] : [[lacuna("cadastre os locais de realização", { aba: "objeto" })]],
    }),
    secao({
      id: "distribuicao", titulo: "Plano de distribuição",
      instrucao: "Produto, beneficiário, CPF/CNPJ, quantidade e a declaração de recebimento. Com mais de um beneficiário, junte as declarações num único PDF e cadastre um CPF.",
      tabela: distribuicao, paragrafos: distribuicao ? [] : [[t("Nenhuma distribuição sem custo cadastrada.")]],
    }),
    secao({
      id: "execucao", titulo: "Comprovantes de execução", obrigatoria: true,
      instrucao: "Fotos, vídeos ou arquivos de reformas, construções e de qualquer outro produto, com observações.",
      tabela: execucao, paragrafos: execucao ? [] : [[lacuna("anexe as evidências do objeto", { aba: "objeto" })]],
    }),
    secao({ id: "aceite_obra", titulo: "Aceite de obra", instrucao: "Construção, reforma, restauro, obras esculturais ou similares: anexar o termo.", paragrafos: [paragrafoDoAceiteDeObra(d)] }),
    secao({
      id: "bens_doados", titulo: "Bens doados", instrucao: "Item orçamentário, documento de doação, quem recebeu (CPF/CNPJ, nome e quantidade) e o aceite.",
      tabela: bensDoados, paragrafos: bensDoados ? [] : [[t("Nenhum bem doado.")]],
    }),
  ];
}

/** Modelo RCO 2026 da LIE ("Relatório de Cumprimento do Objeto"). */
function rascunhoRco(d: DadosDoRelatorio): SecaoDoRelatorio[] {
  const m: ModeloDoRelatorio = "rco";
  const proponente = d.prestacao.proponente;
  const metas = d.estado.metas ?? [];
  const acess = paragrafosDoRequisito(d, "acessibilidade", "anexe fotos de acessibilidade nos locais (marque o requisito nas evidências do objeto)");
  const alteracoes = (d.estado.alteracoes ?? []).filter(a => a.status === "aprovada");
  const naoAtingidas = metas.filter(x => x.realizado === null || x.realizado === undefined || Number(x.realizado) < Number(x.previsto));
  const checklist = d.envio && d.regime ? checklistDeEnvio({ ...d.envio, regime: d.regime, etapa: "final" }) : null;
  const locais = tabelaDosLocais(d, false);
  return [
    secao({
      id: "dados", titulo: "I. Dados do projeto", obrigatoria: true,
      tabela: {
        colunas: ["Campo", "Valor"],
        linhas: [
          // O nº do processo no SEI não fica na prestação; o identificador oficial da LIE é o nº do projeto no SLI.
          [[t("Processo nº")], [lacuna("número do processo no SEI")]],
          [[t("SLIE/SLI")], d.prestacao.identificador_oficial ? [dado(d.prestacao.identificador_oficial, { aba: "visao_geral" })] : [lacuna("número do projeto no SLI", { aba: "visao_geral" })]],
          [[t("Projeto")], [dado(d.prestacao.titulo, { aba: "visao_geral" })]],
          [[t("Proponente")], proponente ? [dado(proponente.nome, { aba: "visao_geral" })] : [lacuna("proponente", { aba: "visao_geral" })]],
          [[t("CNPJ")], proponente?.cnpj ? [dado(limparDocumento(proponente.cnpj), { aba: "visao_geral" })] : [lacuna("CNPJ do proponente", { aba: "visao_geral" })]],
        ],
      },
      complemento: complemento(d, m, "dados", "Manifestação desportiva, modalidades e responsável legal", true),
    }),
    secao({
      id: "objeto", titulo: "II. Consecução do objeto: objeto e objetivos", obrigatoria: true,
      complemento: complemento(d, m, "objeto", "Objeto e objetivos", true),
    }),
    secao({
      id: "resultados", titulo: "II. Resultados esperados e atingidos e repercussão", obrigatoria: true,
      paragrafos: [...paragrafosDasMetas(d), ...paragrafosDasAtividades(d)],
      complemento: complemento(d, m, "resultados", "Repercussão", true),
    }),
    secao({
      id: "alteracoes", titulo: "II. Alterações durante a execução",
      instrucao: "Termo aditivo, mudança de local, remanejamentos, readequação e uso de aplicação financeira, com a justificativa.",
      paragrafos: alteracoes.length
        ? alteracoes.map(a => {
          const fonte: FonteDoDado = { aba: "orcamento" };
          // "Alteração" concorda com o particípio, seja remanejamento, complementação, redução ou inclusão.
          return [dado(`Alteração nº ${a.numero} (${rotuloTipoAlteracao(a.tipo ?? "remanejamento").toLowerCase()})`, fonte), ...(a.decidida_em ? [t(", aprovada em "), dado(dataBr(a.decidida_em)!, fonte)] : []), t(". "),
            a.justificativa?.trim() ? dado(a.justificativa.trim(), fonte) : lacuna("justificativa da alteração", fonte)];
        })
        : [[t("Nenhuma alteração do orçamento aprovada.")]],
      complemento: complemento(d, m, "alteracoes", "Outras alterações (local, prazo, aplicação financeira)", false),
    }),
    secao({
      id: "locais", titulo: "II. Locais de execução e condições de acessibilidade", obrigatoria: true,
      tabela: locais, paragrafos: [...(locais ? [] : [[lacuna("cadastre os locais de execução", { aba: "objeto" })]]), ...acess.paragrafos],
      documentos: acess.documentos,
    }),
    secao({
      id: "metas", titulo: "III. Metas qualitativas e quantitativas", obrigatoria: true,
      instrucao: "Metas aprovadas, sem alterar as da análise técnica, com indicador, instrumentos de verificação e o percentual de atingimento.",
      tabela: metas.length ? {
        colunas: ["Meta", "Indicador", "Previsto", "Alcançado", "Atingimento", "Instrumentos de verificação"],
        linhas: metas.map(x => {
          const fonte: FonteDoDado = { aba: "objeto", parametro: "meta", id: x.id };
          const evidencias = (d.estado.evidencias ?? []).filter(e => e.meta_id === x.id || (e.atividade_id && (d.estado.atividades ?? []).some(a => a.id === e.atividade_id && a.meta_id === x.id)));
          const tipos = [...new Set(evidencias.map(e => rotuloDoTipo(e.tipo).toLowerCase()))];
          const alcancado = x.realizado === null || x.realizado === undefined ? null : Number(x.realizado);
          return [
            [dado(x.descricao, fonte)],
            x.unidade?.trim() ? [dado(x.unidade.trim(), fonte)] : [lacuna("indicador", fonte)],
            [dado(numero(Number(x.previsto)), fonte)],
            alcancado === null ? [lacuna("alcançado", fonte)] : [dado(numero(alcancado), fonte)],
            alcancado === null || !Number(x.previsto) ? [] : [dado(`${numero(Math.round((alcancado / Number(x.previsto)) * 1000) / 10)}%`, fonte)],
            evidencias.length ? [dado(`${plural(evidencias.length, "evidência", "evidências")} (${tipos.join(", ")})`, fonte)] : [lacuna("instrumentos de verificação", fonte)],
          ];
        }),
      } : null,
      paragrafos: metas.length ? [] : [[lacuna("cadastre as metas aprovadas", FONTE_METAS)]],
    }),
    secao({
      id: "documentos", titulo: "IV. Documentos comprobatórios",
      instrucao: "Relação a–q do modelo; cada documento segue o formulário da DPPIE.",
      paragrafos: checklist && !checklist.semChecklist
        ? checklist.documentos.map(l => [dado(l.descricao, { aba: "envio" }), t(": "),
          l.situacao === "pronto" ? dado("pronto", { aba: "envio" }) : l.situacao === "nao_se_aplica" ? dado("não se aplica", { aba: "envio" }) : lacuna(l.detalhe, { aba: "envio" })])
        : [[lacuna("veja os documentos no checklist de envio", { aba: "envio" })]],
    }),
    secao({
      id: "aplicacao", titulo: "Aplicação financeira",
      instrucao: "Se os rendimentos foram usados: ação nº, valor e justificativa, pelo melhor resultado para a execução (Portaria 10/2026, art. 28, § 2º).",
      complemento: complemento(d, m, "aplicacao", "Ações pagas com rendimentos", false),
    }),
    secao({
      id: "consideracoes", titulo: "V. Considerações finais", obrigatoria: true,
      paragrafos: metas.length && naoAtingidas.length === 0
        ? [[t("Ressalta-se que foi atingido o objeto pactuado e cumprido fielmente o Plano de Trabalho aprovado.")]]
        : [[lacuna(metas.length ? `explique as metas não atingidas (${naoAtingidas.map(x => x.descricao).join("; ")}) antes de afirmar o cumprimento do objeto` : "cadastre as metas antes das considerações finais", FONTE_METAS)]],
      complemento: complemento(d, m, "consideracoes", "Considerações", false),
    }),
    secao({
      id: "autenticacao", titulo: "VI. Autenticação",
      paragrafos: [[t("Atesto a veracidade das informações prestadas neste relatório. Local, data e assinatura do responsável legal: o documento só vale para a análise técnica com essa assinatura.")]],
    }),
  ];
}

/** Os demais regimes: as partes do relatório de cumprimento do objeto, sem tela própria. */
function rascunhoGenerico(d: DadosDoRelatorio): SecaoDoRelatorio[] {
  const m: ModeloDoRelatorio = "generico";
  const acess = paragrafosDoRequisito(d, "acessibilidade", "anexe evidências de acessibilidade, quando o regime pedir");
  const demo = paragrafosDoRequisito(d, "democratizacao", "anexe evidências de democratização do acesso, quando o regime pedir");
  const locais = tabelaDosLocais(d, true);
  const execucao = tabelaDaExecucao(d);
  const distribuicao = tabelaDaDistribuicao(d);
  const bensDoados = tabelaDosBensDoados(d);
  return [
    secao({
      id: "metas", titulo: "Metas e resultados", obrigatoria: true,
      paragrafos: [...paragrafosDasMetas(d), ...paragrafosDasAtividades(d)],
      complemento: complemento(d, m, "metas", "Resultados e repercussão", true),
    }),
    secao({ id: "locais", titulo: "Locais de realização", tabela: locais, paragrafos: locais ? [] : [[lacuna("cadastre os locais de realização", { aba: "objeto" })]] }),
    secao({ id: "evidencias", titulo: "Evidências da execução", tabela: execucao, paragrafos: execucao ? [] : [[lacuna("anexe as evidências do objeto", { aba: "objeto" })]] }),
    secao({ id: "acessibilidade", titulo: "Acessibilidade", paragrafos: acess.paragrafos, documentos: acess.documentos }),
    secao({ id: "democratizacao", titulo: "Democratização do acesso", paragrafos: [...paragrafosDaDemocratizacaoNaDistribuicao(d), ...demo.paragrafos], documentos: demo.documentos }),
    secao({ id: "distribuicao", titulo: "Distribuição", tabela: distribuicao, paragrafos: distribuicao ? [] : [[t("Nenhuma distribuição sem custo cadastrada.")]] }),
    secao({ id: "bens", titulo: "Bens doados", tabela: bensDoados, paragrafos: bensDoados ? [] : [[t("Nenhum bem doado.")]] }),
  ];
}

/** Modelo do relatório pelo regime: Salic na Rouanet, RCO na LIE, genérico nos demais. */
export function modeloDoRegime(regime: RegimeNormativo | null | undefined): ModeloDoRelatorio {
  if (regime?.sistemaOficial === "Salic") return "salic";
  if (regime?.codigo.startsWith("lie_")) return "rco";
  return "generico";
}

/** O documento do relatório do objeto no envio do regime, para citar a fonte. */
function documentoDoRelatorio(regime: RegimeNormativo | null): Fonte | null {
  const envio = regime ? definida(regime.envio) : null;
  return envio?.documentos.find(x => ["relatorio_objeto", "rco", "objeto"].includes(x.codigo))?.fonte ?? null;
}

export function rascunhoDoRelatorio(d: DadosDoRelatorio): RascunhoDoRelatorio {
  const modelo = modeloDoRegime(d.regime);
  const secoes = modelo === "salic" ? rascunhoSalic(d) : modelo === "rco" ? rascunhoRco(d) : rascunhoGenerico(d);
  const cabecalho = {
    salic: { titulo: "Relatório de execução do objeto", descricao: "Nos campos da Comprovação Física do Salic (Manual do Proponente, Módulo III, p. 42–54)." },
    rco: { titulo: "Relatório de cumprimento do objeto", descricao: "No modelo RCO 2026 da Lei de Incentivo ao Esporte." },
    generico: { titulo: "Relatório de cumprimento do objeto", descricao: "Com metas, locais, evidências, acessibilidade, distribuição e bens." },
  }[modelo];
  return { modelo, ...cabecalho, fonte: documentoDoRelatorio(d.regime), secoes, lacunas: secoes.reduce((s, x) => s + x.lacunas, 0) };
}

// ─── Texto para copiar ──────────────────────────────────────────────────────

const textoDoTrecho = (x: Trecho) => (x.tipo === "lacuna" ? `[Falta: ${x.texto}]` : x.texto);
const textoDoParagrafo = (p: Paragrafo) => p.map(textoDoTrecho).join("");

/** O texto da seção para colar no sistema oficial; lacunas aparecem como "[Falta: …]". */
export function textoDaSecao(s: SecaoDoRelatorio): string {
  const partes: string[] = [];
  partes.push(...s.paragrafos.map(textoDoParagrafo));
  if (s.tabela) {
    for (const linha of s.tabela.linhas) {
      partes.push(s.tabela.colunas.map((c, i) => `${c}: ${textoDoParagrafo(linha[i] ?? []) || "—"}`).join(" · "));
    }
  }
  if (s.numeros) {
    const valores = s.numeros.map(n => `${n.rotulo}: ${n.valor === null ? `[Falta: ${n.rotulo.toLowerCase()}]` : numero(n.valor)}`);
    const total = s.numeros.every(n => n.valor !== null) ? s.numeros.reduce((soma, n) => soma + (n.valor ?? 0), 0) : null;
    partes.push([...valores, `Total: ${total === null ? "—" : numero(total)}`].join(" · "));
  }
  if (s.complemento) {
    const valor = s.complemento.valor.trim();
    if (valor) partes.push(valor);
    else if (s.complemento.obrigatorio) partes.push(`[Falta: ${s.complemento.rotulo.toLowerCase()}]`);
  }
  if (s.documentos.length) partes.push(`Anexar: ${s.documentos.map(x => x.nome).join("; ")}.`);
  return partes.filter(Boolean).join("\n");
}

/** O rascunho inteiro, seção por seção. */
export function textoDoRascunho(r: RascunhoDoRelatorio): string {
  return r.secoes.map(s => `${cap(s.titulo)}\n${textoDaSecao(s)}`).join("\n\n") + "\n";
}
