// Conjunto de teste do agente normativo (P6.5), o modo "avaliar" da função.
//
// Cada caso de _shared/conjunto-normativo.ts é lido como na leitura de
// verdade (mesmo pedido, mesma conferência das citações), mas nada vira
// proposta: a nota de cada caso fica em normas_avaliacoes, e a rodada, em
// agente_execucoes (agente "avaliador_normas"). Os regimes vêm do banco, na
// versão publicada; o documento, da última versão guardada da fonte vigiada
// ou do texto escrito no caso.

import { registrarChamadaIa } from "../_shared/chamadas-ia.ts";
import { CONJUNTO, textoDoCaso, type CasoDoConjunto } from "../_shared/conjunto-normativo.ts";
import { custoDaChamada, usoDaResposta } from "../_shared/leitura-documento.ts";
import { modeloDaIa } from "../_shared/modelo-ia.ts";
import { avaliarLeitura, conferirLeitura, lerLeituraDaIa, promptDaLeituraNormativa, regimeAchatado } from "../_shared/proposta-regime.ts";
import { chamarIa } from "./leitura.ts";
import type { Cliente } from "./paginas.ts";

type Regime = { id: string; codigo: string; nome: string; versao: number; norma_referencia: string; parametros: Record<string, unknown> };

type Linha = {
  execucao_id: string;
  caso: string;
  titulo: string;
  regime_codigo: string;
  regime_versao?: number;
  documento: string;
  documento_id?: string | null;
  modelo?: string;
  classificacao?: string | null;
  classificacao_certa?: boolean;
  esperadas?: number;
  acertos?: number;
  erradas?: number;
  faltas?: number;
  falsos_alarmes?: number;
  cobertura?: number | null;
  resultado?: unknown;
  custo_usd?: number | null;
  duracao_ms?: number;
  erro?: string | null;
};

async function regimePublicado(admin: Cliente, codigo: string): Promise<Regime | null> {
  const { data } = await admin.from("prestacao_regimes")
    .select("id, codigo, nome, versao, norma_referencia, parametros")
    .eq("codigo", codigo).eq("status", "publicado").maybeSingle();
  return (data as Regime | null) ?? null;
}

async function textoDoDocumento(admin: Cliente, caso: CasoDoConjunto): Promise<{ texto: string; documentoId: string | null; url: string | null } | string> {
  const doc = caso.documento;
  if ("texto" in doc) return { texto: doc.texto, documentoId: null, url: doc.url ?? null };
  const { data: fonte } = await admin.from("normas_fontes").select("id, url").eq("codigo", doc.fonte).maybeSingle();
  if (!fonte) return `a fonte ${doc.fonte} não está cadastrada`;
  const { data: guardado } = await admin.from("normas_documentos").select("id, texto")
    .eq("fonte_id", fonte.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!guardado) return `a fonte ${doc.fonte} ainda não foi coletada`;
  return { texto: textoDoCaso(guardado.texto as string, doc.aPartirDe), documentoId: guardado.id as string, url: doc.url ?? (fonte.url as string) };
}

async function avaliarCaso(admin: Cliente, caso: CasoDoConjunto, execucaoId: string, userId: string | null): Promise<Linha> {
  const inicio = Date.now();
  const base: Linha = { execucao_id: execucaoId, caso: caso.codigo, titulo: caso.titulo, regime_codigo: caso.regime, documento: caso.documento.titulo };
  const [regime, esperado] = await Promise.all([
    regimePublicado(admin, caso.regime),
    caso.esperado.regime ? regimePublicado(admin, caso.esperado.regime) : Promise.resolve(null),
  ]);
  if (!regime) return { ...base, erro: `o regime ${caso.regime} não tem versão publicada` };
  if (caso.esperado.regime && !esperado) return { ...base, erro: `o regime conferido ${caso.esperado.regime} não tem versão publicada` };
  const documento = await textoDoDocumento(admin, caso);
  if (typeof documento === "string") return { ...base, regime_versao: regime.versao, erro: documento };

  const modelo = modeloDaIa();
  const prompt = promptDaLeituraNormativa({
    documento: { titulo: caso.documento.titulo, tipo: caso.documento.tipo, orgao: caso.documento.orgao, publicadoEm: caso.documento.publicadoEm, url: documento.url },
    texto: documento.texto,
    trechosQueMudaram: null,
    regime: { codigo: regime.codigo, nome: regime.nome, versao: regime.versao, normaReferencia: regime.norma_referencia, achatado: regimeAchatado(regime.parametros) },
    normaAnterior: caso.substitui ?? null,
  });
  const { bruta, corpo, erro } = await chamarIa(prompt);
  const leitura = erro ? null : lerLeituraDaIa(bruta);
  await registrarChamadaIa(admin, {
    funcao: "agente-normativo",
    organizationId: null,
    prestacaoId: null,
    userId,
    modelo,
    arquivo: `conjunto/${caso.codigo}`,
    tamanhoBytes: prompt.length,
    corpo,
    inicio,
    sucesso: !!leitura,
    erro: erro ?? (leitura ? null : "a resposta não trouxe uma classificação"),
  });
  const custo = custoDaChamada(Deno.env.get("GOOGLE_AI_PRECOS"), modelo, usoDaResposta(corpo));
  const comum = { ...base, regime_versao: regime.versao, documento_id: documento.documentoId, modelo, custo_usd: custo, duracao_ms: Date.now() - inicio };
  if (!leitura) return { ...comum, erro: erro ?? "a IA não devolveu uma leitura" };

  const conferida = conferirLeitura(regime.parametros, leitura, { documento: caso.documento.titulo, url: documento.url, texto: documento.texto });
  const nota = avaliarLeitura(caso, { antigo: regime.parametros, esperado: esperado?.parametros }, { classificacao: leitura.classificacao, conferida });
  return {
    ...comum,
    classificacao: nota.classificacao,
    classificacao_certa: nota.classificacaoCerta,
    esperadas: nota.esperadas,
    acertos: nota.acertos.length,
    erradas: nota.erradas.length,
    faltas: nota.faltas.length,
    falsos_alarmes: nota.falsosAlarmes.length,
    cobertura: nota.cobertura,
    resultado: {
      ...nota,
      resumo: leitura.resumo,
      mudancas: conferida.mudancas.map(m => ({ operacao: m.operacao, caminho: m.caminho, valor: m.valorProposto, dispositivo: m.dispositivo, citacao: m.citacao })),
      motivosDescarte: conferida.descartadas.map(d => ({ caminho: d.caminho, motivo: d.motivo })),
    },
  };
}

/**
 * Registra a rodada e devolve o trabalho: ler os casos (ou os escolhidos) e
 * guardar a nota de cada um. A leitura mais longa passa de um minuto, então a
 * função responde já com o id da rodada e a tela acompanha agente_execucoes.
 */
export async function iniciarAvaliacao(admin: Cliente, userId: string | null, hoje: string, casos?: string[]): Promise<
  { status: number; corpo: unknown; trabalho?: Promise<unknown> }
> {
  const escolhidos = casos?.length ? CONJUNTO.filter(c => casos.includes(c.codigo)) : [...CONJUNTO];
  if (!escolhidos.length) return { status: 400, corpo: { error: "caso_inexistente" } };

  const { data: execucao, error: erroExecucao } = await admin.from("agente_execucoes")
    .insert({ agente: "avaliador_normas", referencia: hoje, situacao: "rodando" })
    .select("id").single();
  if (erroExecucao || !execucao) return { status: 500, corpo: { error: "execucao_nao_registrada" } };

  const trabalho = avaliarCasos(admin, userId, execucao.id, escolhidos).catch(async falha => {
    const detalhe = (falha instanceof Error ? falha.message : String(falha)).slice(0, 2000);
    console.error("agente-normativo (avaliar)", detalhe);
    await admin.from("agente_execucoes").update({ situacao: "falhou", detalhe, terminada_em: new Date().toISOString() }).eq("id", execucao.id);
  });
  return { status: 202, corpo: { execucao: execucao.id, situacao: "rodando", casos: escolhidos.length }, trabalho };
}

async function avaliarCasos(admin: Cliente, userId: string | null, execucaoId: string, escolhidos: CasoDoConjunto[]) {
  const linhas = await Promise.all(escolhidos.map(caso => avaliarCaso(admin, caso, execucaoId, userId).catch((falha): Linha => ({
    execucao_id: execucaoId, caso: caso.codigo, titulo: caso.titulo, regime_codigo: caso.regime, documento: caso.documento.titulo,
    erro: falha instanceof Error ? falha.message : String(falha),
  }))));
  const { error: erroLinhas } = await admin.from("normas_avaliacoes").insert(linhas.map(l => ({ ...l, erro: l.erro ? l.erro.slice(0, 2000) : null })));

  const lidas = linhas.filter(l => !l.erro);
  const esperadas = lidas.reduce((soma, l) => soma + (l.esperadas ?? 0), 0);
  const acertos = lidas.reduce((soma, l) => soma + (l.acertos ?? 0), 0);
  const alarmes = lidas.reduce((soma, l) => soma + (l.falsos_alarmes ?? 0), 0);
  const situacao = lidas.length === 0 || erroLinhas ? "falhou" : "ok";
  const detalhe = [
    `${acertos} de ${esperadas} mudanças esperadas`,
    `${alarmes} ${alarmes === 1 ? "falso alarme" : "falsos alarmes"}`,
    `${lidas.filter(l => l.classificacao_certa).length} de ${linhas.length} classificações certas`,
    ...linhas.filter(l => l.erro).map(l => `${l.caso}: ${l.erro}`),
    ...(erroLinhas ? [`não foi possível guardar as notas (${erroLinhas.message})`] : []),
  ].join("; ").slice(0, 2000);
  await admin.from("agente_execucoes").update({
    situacao,
    lidos: linhas.length,
    relevantes: lidas.filter(l => l.classificacao_certa).length,
    novos: acertos,
    custo: Math.round(lidas.reduce((soma, l) => soma + (l.custo_usd ?? 0), 0) * 1_000_000) / 1_000_000,
    detalhe,
    terminada_em: new Date().toISOString(),
  }).eq("id", execucaoId);

  return { situacao, detalhe };
}
