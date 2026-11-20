// Revisão e publicação de regimes (P6.3).
//
// A proposta da IA (P6.2) ou uma mudança feita à mão vira o rascunho da versão
// seguinte do regime, que só é publicado por /api/admin/regimes/[codigo]. As
// contas ficam aqui, para a rota e a tela fazerem igual:
//   - aplicar as mudanças revisadas (com o valor corrigido, quando houver), a
//     fonte de cada trecho e a vigência, e validar no schema do regime;
//   - dizer o que mudou entre duas versões, parâmetro a parâmetro;
//   - apontar as mudanças que tocam uma regra de severidade "bloqueio", que
//     pedem uma segunda pessoa para publicar;
//   - resumir o que muda para quem tem prestação na versão anterior (P6.4).

import {
  aplicarMudanca,
  caminhoDosPassos,
  lerCaminho,
  passosDoCaminho,
  regimeAchatado,
  type Operacao,
  type Passo,
} from "@/supabase/functions/_shared/proposta-regime";
import { validarRegime } from "./schema";
import { DIMENSOES } from "./tipos";

type Objeto = Record<string, unknown>;

/** Mudança aceita na revisão: o valor já lido e a fonte da regra. */
export type MudancaRevisada = {
  operacao: Operacao;
  caminho: string;
  valor: unknown;
  documento: string;
  dispositivo: string;
  citacao?: string;
  aConfirmar?: boolean;
};

export type ResultadoDoRascunho = { ok: true; regime: Objeto } | { ok: false; erros: string[] };

/**
 * O rascunho: as mudanças aplicadas sobre a base (a versão publicada ou o
 * rascunho que já existe), com a versão e a vigência novas, validado no
 * schema. A vigência muda só `vigenteDesde`; a aplicabilidade (critério e
 * datas) é ajustada por mudança, quando a norma pede.
 */
export function montarRascunho(base: Objeto, mudancas: readonly MudancaRevisada[], opcoes: { versao: number; vigenteDesde?: string | null }): ResultadoDoRascunho {
  const rascunho = structuredClone(base);
  const erros: string[] = [];
  for (const m of mudancas) {
    if (!m.documento?.trim() || !m.dispositivo?.trim()) {
      erros.push(`${m.caminho}: diga o documento e o dispositivo de onde vem a regra`);
      continue;
    }
    const fonte: Objeto = {
      documento: m.documento.trim().slice(0, 300),
      dispositivo: m.dispositivo.trim().slice(0, 300),
      ...(m.citacao?.trim() ? { citacao: m.citacao.replace(/\s+/g, " ").trim().slice(0, 400) } : {}),
      ...(m.aConfirmar ? { aConfirmar: true } : {}),
    };
    const resultado = aplicarMudanca(rascunho, m.caminho, m.operacao, m.valor, fonte);
    if (!resultado.ok) erros.push(`${m.caminho}: ${resultado.motivo}`);
  }
  if (erros.length) return { ok: false, erros };
  rascunho.versao = opcoes.versao;
  if (opcoes.vigenteDesde !== undefined) rascunho.vigenteDesde = opcoes.vigenteDesde;
  const validacao = validarRegime(rascunho);
  return validacao.ok ? { ok: true, regime: rascunho } : { ok: false, erros: validacao.erros };
}

function linhasPorCaminho(regime: unknown): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const linha of regimeAchatado(regime).split("\n")) {
    const separador = linha.indexOf(" = ");
    if (separador > 0) mapa.set(linha.slice(0, separador), linha.slice(separador + 3));
  }
  return mapa;
}

export type DiferencaDeParametro = { caminho: string; antes: string | null; depois: string | null };

/**
 * O que mudou de uma versão para outra, parâmetro a parâmetro (a versão em si
 * fica de fora). A fonte de um trecho vem logo depois dos valores dele.
 */
export function diferencaEntreVersoes(antes: unknown, depois: unknown): DiferencaDeParametro[] {
  const a = linhasPorCaminho(antes);
  const b = linhasPorCaminho(depois);
  const caminhos = [...b.keys(), ...[...a.keys()].filter(c => !b.has(c))];
  const mudadas = caminhos
    .filter(c => c !== "versao" && a.get(c) !== b.get(c))
    .map(c => ({ caminho: c, antes: a.get(c) ?? null, depois: b.get(c) ?? null }));
  const ordenadas = mudadas.filter(d => !d.caminho.endsWith(".fonte"));
  for (const fonte of mudadas.filter(d => d.caminho.endsWith(".fonte"))) {
    const dono = fonte.caminho.slice(0, -".fonte".length);
    const ultimo = ordenadas.map(d => d.caminho.startsWith(`${dono}.`) || d.caminho.startsWith(`${dono}[`)).lastIndexOf(true);
    ordenadas.splice(ultimo >= 0 ? ultimo + 1 : ordenadas.length, 0, fonte);
  }
  return ordenadas;
}

/**
 * As regras de severidade "bloqueio" (antes ou depois) tocadas pelas
 * diferenças: cada caminho sobe até o primeiro objeto com severidade. Mudar
 * uma delas pede uma segunda pessoa para publicar.
 */
export function regrasQueBloqueiamEnvio(antes: unknown, depois: unknown, diferencas = diferencaEntreVersoes(antes, depois)): string[] {
  const tocadas = new Set<string>();
  for (const d of diferencas) {
    const passos = passosDoCaminho(d.caminho);
    if (!passos) continue;
    for (let n = passos.length; n > 0; n--) {
      const dono = caminhoDosPassos(passos.slice(0, n));
      const severidades = [lerCaminho(antes, `${dono}.severidade`).valor, lerCaminho(depois, `${dono}.severidade`).valor];
      if (severidades.includes("bloqueio")) { tocadas.add(dono); break; }
      if (severidades.some(s => s !== undefined)) break;
    }
  }
  return [...tocadas];
}

const NOME_DA_DIMENSAO: Record<string, string> = {
  ...Object.fromEntries(DIMENSOES.map(d => [d.chave, d.rotulo])),
  nome: "Nome", orgao: "Órgão", sistemaOficial: "Sistema oficial", normaReferencia: "Norma de referência",
  vigenteDesde: "Vigente desde", identificadorOficial: "Identificador oficial", fontes: "Fontes", esfera: "Esfera",
};

/** "Prazos › Concluir os pagamentos e enviar o relatório final no Salic › quantidade". */
export function rotuloDoCaminho(regime: unknown, caminho: string): string {
  const passos = passosDoCaminho(caminho);
  if (!passos) return caminho;
  const partes: string[] = [];
  passos.forEach((passo, i) => {
    if (i === 0 && "chave" in passo) { partes.push(NOME_DA_DIMENSAO[passo.chave] ?? passo.chave); return; }
    const valor = lerCaminho(regime, caminhoDosPassos(passos.slice(0, i + 1))).valor;
    const nome = valor && typeof valor === "object" && !Array.isArray(valor)
      ? ((valor as Objeto).descricao ?? (valor as Objeto).rotulo ?? (valor as Objeto).nome) as string | undefined
      : undefined;
    if (typeof nome === "string" && nome) partes.push(nome.length > 70 ? `${nome.slice(0, 70)}…` : nome);
    else if (i === passos.length - 1 && "chave" in passo) partes.push(passo.chave);
  });
  return partes.join(" › ");
}

/** O valor de um parâmetro para ler na tela. */
export function valorLegivel(valor: unknown): string {
  if (valor === null || valor === undefined) return "—";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (typeof valor === "number") return valor.toLocaleString("pt-BR");
  if (typeof valor === "string") return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor.split("-").reverse().join("/") : valor;
  if (Array.isArray(valor)) return valor.map(valorLegivel).join(", ");
  const objeto = valor as Objeto;
  return String(objeto.descricao ?? objeto.rotulo ?? objeto.nome ?? JSON.stringify(valor));
}

/** Um item do que muda de uma versão para a outra, para quem usa o regime (P6.4). */
export type ItemDoResumo = {
  rotulo: string;
  tipo: "mudou" | "entrou" | "saiu";
  antes: string | null;
  depois: string | null;
  /** Documento e dispositivo de onde vem a regra, na versão que vale. */
  fonte: string | null;
};

function fonteMaisProxima(regime: unknown, passos: readonly Passo[]): string | null {
  for (let n = passos.length; n > 0; n--) {
    const fonte = lerCaminho(regime, `${caminhoDosPassos(passos.slice(0, n))}.fonte`).valor;
    if (fonte && typeof fonte === "object" && !Array.isArray(fonte)) {
      const { documento, dispositivo } = fonte as Objeto;
      const texto = [documento, dispositivo].filter(v => typeof v === "string" && v.trim()).join(", ");
      if (texto) return texto;
    }
  }
  return null;
}

/** Objeto não vira texto no resumo: o nome dele já está no rótulo. */
const legivelNoResumo = (valor: unknown) => (valor && typeof valor === "object" && !Array.isArray(valor) ? null : valorLegivel(valor));

const UNIDADES: Record<string, [string, string]> = {
  dias_corridos: ["dia corrido", "dias corridos"], dias_uteis: ["dia útil", "dias úteis"], meses: ["mês", "meses"], anos: ["ano", "anos"],
};

/**
 * Quantidade de prazo e percentual de teto se leem com o que são ("90 dias
 * corridos", "12%"), e o rótulo para no prazo ou no teto.
 */
function noResumo(regime: unknown, passos: readonly Passo[], valor: unknown): { dono: Passo[] | null; texto: string | null } {
  const ultimo = passos[passos.length - 1];
  if (!ultimo || !("chave" in ultimo) || typeof valor !== "number") return { dono: null, texto: legivelNoResumo(valor) };
  const dono = passos.slice(0, -1);
  if (ultimo.chave === "percentual") return { dono, texto: `${valorLegivel(valor)}%` };
  const unidade = UNIDADES[String(lerCaminho(regime, `${caminhoDosPassos(dono)}.unidade`).valor)];
  if (ultimo.chave === "quantidade" && unidade) return { dono, texto: `${valorLegivel(valor)} ${unidade[valor === 1 ? 0 : 1]}` };
  return { dono: null, texto: valorLegivel(valor) };
}

/**
 * O que muda para quem usa o regime, guardado na versão ao publicar e
 * mostrado no aviso da prestação: cada parâmetro com o valor de antes e o de
 * agora; o item de lista que entrou ou saiu aparece uma vez só. A fonte muda
 * junto com o valor e vai ao lado dele, não como mudança à parte.
 */
export function resumoDasMudancas(antes: unknown, depois: unknown): ItemDoResumo[] {
  const itens: ItemDoResumo[] = [];
  const vistos = new Set<string>();
  for (const d of diferencaEntreVersoes(antes, depois)) {
    if (d.caminho.endsWith(".fonte")) continue;
    const passos = passosDoCaminho(d.caminho);
    if (!passos) continue;
    let n = passos.length;
    for (let k = 1; k < passos.length; k++) {
      if ("chave" in passos[k - 1]) continue;
      const caminho = caminhoDosPassos(passos.slice(0, k));
      if (lerCaminho(antes, caminho).existe !== lerCaminho(depois, caminho).existe) { n = k; break; }
    }
    const caminho = caminhoDosPassos(passos.slice(0, n));
    if (vistos.has(caminho)) continue;
    vistos.add(caminho);
    const a = lerCaminho(antes, caminho);
    const b = lerCaminho(depois, caminho);
    const tipo = !a.existe ? "entrou" : !b.existe ? "saiu" : "mudou";
    const vale = tipo === "saiu" ? antes : depois;
    const daqui = passos.slice(0, n);
    const lidoAntes = a.existe ? noResumo(antes, daqui, a.valor) : null;
    const lidoDepois = b.existe ? noResumo(depois, daqui, b.valor) : null;
    const dono = (lidoDepois ?? lidoAntes)?.dono;
    itens.push({
      rotulo: rotuloDoCaminho(vale, dono?.length ? caminhoDosPassos(dono) : caminho),
      tipo,
      antes: lidoAntes?.texto ?? null,
      depois: lidoDepois?.texto ?? null,
      fonte: fonteMaisProxima(vale, daqui),
    });
  }
  return itens;
}
