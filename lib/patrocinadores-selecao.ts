// Seleção em lote na base pública de patrocinadores: as regras, sem React nem banco, para testar.
// A tela marca empresas da base pública; um lote cria no CRM as que ainda não estão lá e põe uma tag
// ou um responsável em todas (nas que já estavam também).

import { chaveDoNome, mesmoNome, resolverDominio } from "@/lib/dominio";
import { acrescentarTag } from "@/lib/tags";

/** Quantas empresas por vez: o banco aceita 50 criações de empresa por minuto em cada organização. */
export const MAX_SELECAO = 50;

/** Quem pode levar empresas da base para o CRM: a equipe que edita (leitor só olha). */
const PAPEIS_QUE_ADICIONAM = new Set(["admin", "colaborador", "visualizador"]);

export function podeAdicionarAoCrm(papel: string | null | undefined): boolean {
  return papel != null && PAPEIS_QUE_ADICIONAM.has(papel);
}

/** O que a lista já mostra da empresa da base pública: o bastante para criá-la no CRM sem buscar de novo. */
export type EmpresaDaBase = {
  id: string;
  nome: string;
  setor: string | null;
  site: string | null;
  cidade: string | null;
  estado: string | null;
};

export type Selecao = ReadonlyMap<string, EmpresaDaBase>;

/** Marca ou desmarca uma empresa. Com o limite cheio, a marcação nova não entra. */
export function alternarNaSelecao(selecao: Selecao, empresa: EmpresaDaBase, maximo = MAX_SELECAO): Selecao {
  const proxima = new Map(selecao);
  if (proxima.has(empresa.id)) {
    proxima.delete(empresa.id);
    return proxima;
  }
  if (proxima.size >= maximo) return selecao;
  proxima.set(empresa.id, empresa);
  return proxima;
}

/** Caixa do cabeçalho: com a página toda marcada, desmarca a página; senão marca o que couber no limite. */
export function alternarPaginaNaSelecao(selecao: Selecao, pagina: readonly EmpresaDaBase[], maximo = MAX_SELECAO): Selecao {
  const proxima = new Map(selecao);
  if (pagina.length > 0 && pagina.every((empresa) => proxima.has(empresa.id))) {
    for (const empresa of pagina) proxima.delete(empresa.id);
    return proxima;
  }
  for (const empresa of pagina) {
    if (proxima.has(empresa.id)) continue;
    if (proxima.size >= maximo) break;
    proxima.set(empresa.id, empresa);
  }
  return proxima;
}

/** Empresa que já está no CRM da organização: só o que o lote precisa para decidir o que fazer com ela. */
export type EmpresaDoCrm = {
  id: string;
  nome: string;
  empresa_pub_id: string | null;
  account_id: string;
  tags: string[] | null;
  responsavel_interno_id: string | null;
};

/** O que o lote faz: pôr tags nas empresas ou deixá-las com uma pessoa como responsável. */
export type PedidoDoLote =
  | { tipo: "tag"; tags: string[] }
  | { tipo: "responsavel"; pessoaId: string; nome: string };

export type NovaEmpresaDoCrm = {
  organization_id: string;
  account_id: string;
  nome: string;
  nome_key: string;
  tipo: "prospect";
  setor: string | null;
  site: string | null;
  domain_key: string | null;
  cidade: string | null;
  estado: string | null;
  empresa_pub_id: string;
  tags: string[];
  responsavel_interno_id: string | null;
};

export type ResumoDoLote = {
  /** Entraram agora no CRM. */
  criadas: number;
  /** Já estavam no CRM e receberam a tag ou o responsável. */
  atualizadas: number;
  /** Já estavam no CRM do jeito pedido (ou repetem outra empresa do mesmo lote). */
  semMudanca: number;
  /** Já estavam no CRM, criadas por outra pessoa da equipe: só quem criou edita, então ficaram como estavam. */
  deOutraPessoa: number;
};

export type PlanoDoLote = {
  criar: NovaEmpresaDoCrm[];
  /** Uma gravação por lista final de tags: quem tem as mesmas tags no fim vai junto. */
  gravarTags: { ids: string[]; tags: string[] }[];
  gravarResponsavel: string[];
  resumo: ResumoDoLote;
};

function mesclarTags(atuais: readonly string[], novas: readonly string[], vocabulario: readonly string[]): string[] {
  return novas.reduce<string[]>((lista, tag) => acrescentarTag(lista, tag, [...vocabulario]), [...atuais]);
}

/**
 * Decide, sem tocar em nada, o que o lote faz: quem entra no CRM, em quem vai a tag ou o responsável e quem
 * fica de fora. Uma empresa "já está" no CRM quando alguma linha liga à mesma empresa da base ou, sem ligação,
 * tem o mesmo nome (mesma regra do conector MCP).
 */
export function planejarLote(entrada: {
  empresas: readonly EmpresaDaBase[];
  doCrm: readonly EmpresaDoCrm[];
  organizacaoId: string;
  usuarioId: string;
  pedido: PedidoDoLote;
  vocabulario?: readonly string[];
}): PlanoDoLote {
  const { empresas, doCrm, organizacaoId, usuarioId, pedido, vocabulario = [] } = entrada;

  const ligadas = new Map<string, EmpresaDoCrm[]>();
  const semLigacao: EmpresaDoCrm[] = [];
  for (const linha of doCrm) {
    if (!linha.empresa_pub_id) { semLigacao.push(linha); continue; }
    ligadas.set(linha.empresa_pub_id, [...(ligadas.get(linha.empresa_pub_id) ?? []), linha]);
  }
  // Havendo mais de uma linha para a mesma empresa, vale a que a pessoa pode editar.
  const existenteDe = (empresa: EmpresaDaBase): EmpresaDoCrm | undefined => {
    const candidatas = [...(ligadas.get(empresa.id) ?? []), ...semLigacao.filter((linha) => mesmoNome(linha.nome, empresa.nome))];
    return candidatas.find((linha) => linha.account_id === usuarioId) ?? candidatas[0];
  };

  const plano: PlanoDoLote = { criar: [], gravarTags: [], gravarResponsavel: [], resumo: { criadas: 0, atualizadas: 0, semMudanca: 0, deOutraPessoa: 0 } };
  const gruposDeTags = new Map<string, { ids: string[]; tags: string[] }>();
  const vistas = new Set<string>();
  const tagsDoPedido = pedido.tipo === "tag" ? pedido.tags : [];

  for (const empresa of empresas) {
    if (vistas.has(empresa.id)) continue;
    vistas.add(empresa.id);

    const existente = existenteDe(empresa);
    if (!existente) {
      // Duas empresas do lote com o mesmo nome entram uma vez só no CRM.
      if (plano.criar.some((nova) => mesmoNome(nova.nome, empresa.nome))) { plano.resumo.semMudanca++; continue; }
      plano.criar.push({
        organization_id: organizacaoId,
        account_id: usuarioId,
        nome: empresa.nome,
        nome_key: chaveDoNome(empresa.nome),
        tipo: "prospect",
        setor: empresa.setor,
        site: empresa.site,
        domain_key: resolverDominio(empresa.site),
        cidade: empresa.cidade,
        estado: empresa.estado,
        empresa_pub_id: empresa.id,
        tags: mesclarTags([], tagsDoPedido, vocabulario),
        responsavel_interno_id: pedido.tipo === "responsavel" ? pedido.pessoaId : null,
      });
      plano.resumo.criadas++;
      continue;
    }

    if (existente.account_id !== usuarioId) { plano.resumo.deOutraPessoa++; continue; }

    let mudou = false;
    if (pedido.tipo === "tag") {
      const atuais = existente.tags ?? [];
      const finais = mesclarTags(atuais, pedido.tags, vocabulario);
      if (finais.length !== atuais.length) {
        mudou = true;
        const chave = JSON.stringify(finais);
        const grupo = gruposDeTags.get(chave) ?? { ids: [], tags: finais };
        grupo.ids.push(existente.id);
        gruposDeTags.set(chave, grupo);
      }
    } else if (existente.responsavel_interno_id !== pedido.pessoaId) {
      mudou = true;
      plano.gravarResponsavel.push(existente.id);
    }
    if (mudou) plano.resumo.atualizadas++;
    else plano.resumo.semMudanca++;
  }

  plano.gravarTags = [...gruposDeTags.values()];
  return plano;
}

function quantas(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

function flexao(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

function listaDeTags(tags: readonly string[]): string {
  const marcadas = tags.map((tag) => `“${tag}”`);
  const quais = marcadas.length > 1 ? `${marcadas.slice(0, -1).join(", ")} e ${marcadas[marcadas.length - 1]}` : marcadas[0] ?? "";
  return `${flexao(tags.length, "a tag", "as tags")} ${quais}`;
}

/** A frase do aviso depois do lote, em português corrido: o que entrou, o que mudou e o que ficou como estava. */
export function mensagemDoLote(resumo: ResumoDoLote, pedido: PedidoDoLote): string {
  const { criadas: c, atualizadas: a, semMudanca: s, deOutraPessoa: o } = resumo;
  const frases: string[] = [];
  const porTag = pedido.tipo === "tag";
  const destino = porTag ? listaDeTags(pedido.tags) : "";

  if (c > 0 && a > 0) {
    frases.push(`${quantas(c, "empresa entrou", "empresas entraram")} no CRM e ${a} que já ${flexao(a, "estava", "estavam")} ${porTag ? `${flexao(a, "ganhou", "ganharam")} ${destino}` : `${flexao(a, "passou", "passaram")} para ${pedido.nome}`}`);
  } else if (c > 0) {
    frases.push(`${quantas(c, "empresa entrou", "empresas entraram")} no CRM ${porTag ? `com ${destino}` : `com ${pedido.nome} como responsável`}`);
  } else if (a > 0) {
    frases.push(`${quantas(a, "empresa que já estava", "empresas que já estavam")} no CRM ${porTag ? `${flexao(a, "ganhou", "ganharam")} ${destino}` : `${flexao(a, "passou", "passaram")} para ${pedido.nome}`}`);
  }

  if (s > 0) {
    if (c === 0 && a === 0) {
      frases.push(`${s === 1 ? "A empresa já estava" : `As ${s} empresas já estavam`} no CRM ${porTag ? `com ${destino}` : `com ${pedido.nome} como responsável`}`);
    } else {
      frases.push(`${s} já ${porTag ? `${flexao(s, "tinha", "tinham")} ${flexao(pedido.tags.length, "a tag", "as tags")}` : `${flexao(s, "era", "eram")} de ${pedido.nome}`}`);
    }
  }

  if (o > 0) {
    frases.push(`${quantas(o, "empresa é", "empresas são")} de outra pessoa da equipe e ${flexao(o, "ficou", "ficaram")} como ${flexao(o, "estava", "estavam")}`);
  }

  if (frases.length === 0) return "Nenhuma empresa para adicionar.";
  return `${frases.join(". ")}.`;
}

/** Para onde o aviso leva: as empresas do CRM já filtradas pela tag ou pelo responsável do lote. */
export function enderecoDoResultado(pedido: PedidoDoLote): string {
  if (pedido.tipo === "tag") return `/empresas-crm?tag=${encodeURIComponent(pedido.tags[0] ?? "")}`;
  return `/empresas-crm?responsavel=${encodeURIComponent(pedido.pessoaId)}`;
}

/** O erro do banco numa frase que a pessoa entende. O limite de criações por minuto vira "espere 1 minuto". */
export function traduzirErroDoLote(mensagem: string): string {
  if (mensagem.includes("RATE_LIMIT")) return "Muitas empresas criadas em pouco tempo. Espere 1 minuto e tente de novo.";
  return `Não foi possível adicionar ao CRM. ${mensagem}`;
}
