import type { Admin } from "@/lib/mcp/crm";
import { avisarEquipe, registrarAcao, type QuemGrava } from "@/lib/mcp/prestacao/gravacao";
import { estadoEDadosDoEnvio } from "@/lib/mcp/prestacao/leitura";
import type { PrestacaoDoResumo } from "@/lib/mcp/prestacao/resumo";
import { ErroMcp, ausente, booleano, erroDoBanco, texto, type Corpo } from "@/lib/mcp/validacao";
import { chaveDoComplemento, chaveDosNumeros, lerNumeros, rascunhoDoRelatorio, type RascunhoDoRelatorio, type SecaoDoRelatorio } from "@/lib/prestacao/relatorio-objeto";

/**
 * O relatório do objeto (a aba Envio › Relatório do app): o assistente lê quais seções têm um campo para a pessoa
 * preencher (um texto e/ou números, como empregos) e o que já está escrito, e grava nesses campos. O resto do relatório
 * (metas, locais, evidências, distribuição) é montado pelo Jards a partir dos dados da prestação e não se escreve aqui.
 *
 * O texto da equipe não é sobrescrito sem querer: se a seção já tem texto, só muda com `substituir: true`, e o texto de antes
 * fica guardado na trilha (assistente_acoes) para voltar. O assistente também não apaga seção.
 */

export const LIMITE_PADRAO_DO_TEXTO = 5000;
/** O texto atual volta cortado: o necessário para o assistente ver o que há, sem despejar a seção inteira na conversa. */
const LIMITE_DO_TEXTO_NA_RESPOSTA = 2000;

type LinhaDoRelatorio = { id: string; secao: string; conteudo: string };

const recortar = (valor: string, limite: number) => (valor.length <= limite ? { texto: valor, cortado: false } : { texto: `${valor.slice(0, limite).trimEnd()}…`, cortado: true });

export interface RelatorioMontado {
  rascunho: RascunhoDoRelatorio;
  linhas: Map<string, LinhaDoRelatorio>;
  /** Avisos sobre o que não foi possível ler (o rascunho continua válido, com mais lacunas). */
  avisos: string[];
}

/** O rascunho do relatório com o que está guardado, pelos mesmos dados e a mesma função da tela. */
export async function montarRelatorio(admin: Admin, prestacao: PrestacaoDoResumo): Promise<RelatorioMontado> {
  const [{ estado, dadosDoEnvio, erroDoEnvio }, proponente, guardadas] = await Promise.all([
    estadoEDadosDoEnvio(admin, prestacao),
    admin.from("prestacoes_contas").select("proponente:proponente_id(nome,cnpj)").eq("id", prestacao.id).maybeSingle(),
    admin.from("prestacao_relatorio" as never).select("id,secao,conteudo").eq("prestacao_id", prestacao.id),
  ]);
  if (proponente.error) throw erroDoBanco(proponente.error);
  if (guardadas.error) throw erroDoBanco(guardadas.error);

  const linhas = new Map(((guardadas.data ?? []) as unknown as LinhaDoRelatorio[]).map(linha => [linha.secao, linha]));
  const guardados = Object.fromEntries([...linhas.values()].map(linha => [linha.secao, linha.conteudo]));
  const dono = (proponente.data as unknown as { proponente: { nome: string; cnpj: string | null } | null } | null)?.proponente ?? null;

  const rascunho = rascunhoDoRelatorio({
    regime: estado.regime,
    estado,
    prestacao: { titulo: prestacao.titulo, identificador_oficial: prestacao.identificador_oficial, numero_processo: prestacao.numero_processo, proponente: dono },
    guardados,
    envio: dadosDoEnvio ?? undefined,
  });
  return { rascunho, linhas, avisos: erroDoEnvio ? ["Não foi possível ler o checklist de envio agora; a contagem de lacunas pode estar com algumas a mais."] : [] };
}

/** Uma seção como o assistente vê: o que ela pede, o que já está preenchido e se dá para preencher por aqui. */
export function secaoParaOAssistente(secao: SecaoDoRelatorio) {
  const complemento = secao.complemento;
  const atual = complemento ? recortar(complemento.valor.trim(), LIMITE_DO_TEXTO_NA_RESPOSTA) : null;
  return {
    secao_id: secao.id,
    titulo: secao.titulo,
    obrigatoria: secao.obrigatoria,
    ...(secao.instrucao ? { instrucao: secao.instrucao } : {}),
    lacunas: secao.lacunas,
    pode_preencher: Boolean(complemento || secao.numeros),
    texto: complemento
      ? {
          campo: complemento.rotulo,
          obrigatorio: complemento.obrigatorio,
          limite_de_caracteres: complemento.limite ?? LIMITE_PADRAO_DO_TEXTO,
          preenchido: Boolean(atual?.texto),
          atual: atual?.texto || null,
          ...(atual?.cortado ? { atual_cortado: true } : {}),
        }
      : null,
    numeros: secao.numeros ? secao.numeros.map(n => ({ id: n.id, campo: n.rotulo, valor: n.valor })) : null,
  };
}

// ─── Gravar ─────────────────────────────────────────────────────────────────

/** Nulo e vazio contam como "não informado": muitos assistentes mandam null nos opcionais que não vão usar. */
const presente = (corpo: Corpo, campo: string) => !ausente(corpo[campo]);

function lerNumerosInformados(corpo: Corpo): { id: string; valor: number }[] {
  const bruto = corpo.numeros;
  if (!Array.isArray(bruto) || bruto.length === 0) throw new ErroMcp(400, 'numeros deve ser uma lista de { "id": "...", "valor": 0 }.');
  if (bruto.length > 10) throw new ErroMcp(400, "numeros aceita até 10 itens.");
  const vistos = new Set<string>();
  return bruto.map((item, posicao) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new ErroMcp(400, `numeros[${posicao}] deve ser um objeto com id e valor.`);
    const { id, valor } = item as { id?: unknown; valor?: unknown };
    if (typeof id !== "string" || !id.trim()) throw new ErroMcp(400, `numeros[${posicao}].id deve ser o id do campo (veja obter_relatorio_da_prestacao).`);
    if (vistos.has(id.trim())) throw new ErroMcp(400, `numeros[${posicao}]: o campo "${id.trim()}" aparece mais de uma vez.`);
    vistos.add(id.trim());
    const numero = typeof valor === "string" && /^\d+$/.test(valor.trim()) ? Number(valor.trim()) : valor;
    if (typeof numero !== "number" || !Number.isInteger(numero) || numero < 0 || numero > 100_000_000) throw new ErroMcp(400, `numeros[${posicao}].valor deve ser um número inteiro, a partir de zero.`);
    return { id: id.trim(), valor: numero };
  });
}

/** Grava uma linha do relatório (cria ou troca o conteúdo) e devolve o id dela. */
async function gravarLinha(admin: Admin, prestacaoId: string, chave: string, conteudo: string, existente: LinhaDoRelatorio | undefined): Promise<string> {
  const agora = new Date().toISOString();
  if (existente) {
    const { error } = await admin.from("prestacao_relatorio" as never).update({ conteudo, updated_at: agora } as never).eq("id", existente.id).eq("prestacao_id", prestacaoId);
    if (error) throw erroDoBanco(error);
    return existente.id;
  }
  const { data, error } = await admin.from("prestacao_relatorio" as never).insert({ prestacao_id: prestacaoId, secao: chave, conteudo, updated_at: agora } as never).select("id").single();
  if (error || !data) throw erroDoBanco(error);
  return (data as { id: string }).id;
}

/** Desfaz uma gravação cuja trilha não pôde ser guardada: volta o texto de antes, ou tira a linha que não existia. */
async function restaurarLinha(admin: Admin, prestacaoId: string, id: string, antes: string | null) {
  if (antes === null) await admin.from("prestacao_relatorio" as never).delete().eq("id", id).eq("prestacao_id", prestacaoId);
  else await admin.from("prestacao_relatorio" as never).update({ conteudo: antes, updated_at: new Date().toISOString() } as never).eq("id", id).eq("prestacao_id", prestacaoId);
}

export interface ResultadoDaSecao {
  mudou: boolean;
  secao_id: string;
  titulo: string;
  campos_gravados: ("texto" | "numeros")[];
  acao_ids: string[];
}

/**
 * Preenche o texto e/ou os números de uma seção do relatório. Recusa (409) trocar um texto ou um número que a pessoa já tinha
 * posto, a menos que o pedido venha com `substituir: true`; nesse caso o valor de antes vai para a trilha.
 */
export async function salvarSecaoDoRelatorio(entrada: { admin: Admin; prestacao: PrestacaoDoResumo; quem: QuemGrava; corpo: Corpo }): Promise<ResultadoDaSecao> {
  const { admin, prestacao, quem, corpo } = entrada;
  const secaoId = texto(corpo, "secao_id", { max: 80, obrigatorio: true }) as string;
  const querTexto = presente(corpo, "texto");
  const querNumeros = presente(corpo, "numeros");
  if (!querTexto && !querNumeros) throw new ErroMcp(400, "Informe texto (o que escrever na seção) e/ou numeros (os campos numéricos dela).");
  const substituir = booleano(corpo, "substituir") === true;

  const novoTexto = querTexto ? (texto(corpo, "texto", { max: LIMITE_PADRAO_DO_TEXTO }) ?? "") : null;
  if (querTexto && !novoTexto) throw new ErroMcp(400, "texto não pode ficar vazio. O assistente não apaga o que está escrito no relatório.");
  const numerosInformados = querNumeros ? lerNumerosInformados(corpo) : [];

  const { rascunho, linhas } = await montarRelatorio(admin, prestacao);
  const secao = rascunho.secoes.find(s => s.id === secaoId);
  if (!secao) {
    const preenchiveis = rascunho.secoes.filter(s => s.complemento || s.numeros).map(s => s.id);
    throw new ErroMcp(404, `Seção "${secaoId.slice(0, 40)}" não encontrada neste relatório. Use obter_relatorio_da_prestacao; as que se preenchem são: ${preenchiveis.join(", ") || "nenhuma"}.`);
  }

  // Primeiro confere tudo; só depois grava. Um pedido com texto e números nunca fica pela metade por causa de uma recusa.
  const planoDoTexto = (() => {
    if (novoTexto === null) return null;
    const campo = secao.complemento;
    if (!campo) throw new ErroMcp(400, `A seção "${secao.titulo}" não tem campo de texto para preencher; ela é montada pelo Jards a partir dos dados da prestação.`);
    const limite = campo.limite ?? LIMITE_PADRAO_DO_TEXTO;
    if (novoTexto.length > limite) throw new ErroMcp(400, `O texto passa de ${limite} caracteres, o limite deste campo (${campo.rotulo}).`);
    const atual = campo.valor.trim();
    if (atual === novoTexto) return null;
    if (atual && !substituir) {
      const cortado = recortar(atual, LIMITE_DO_TEXTO_NA_RESPOSTA);
      throw new ErroMcp(409, `A seção "${secao.titulo}" já tem texto. Para trocar, confirme com a pessoa e envie substituir=true; o texto de antes fica guardado em "Ações do assistente".`, {
        texto_atual: cortado.texto,
        ...(cortado.cortado ? { texto_atual_cortado: true } : {}),
      });
    }
    return { chave: chaveDoComplemento(rascunho.modelo, secao.id), existente: linhas.get(chaveDoComplemento(rascunho.modelo, secao.id)), atual, novo: novoTexto };
  })();

  const planoDosNumeros = (() => {
    if (numerosInformados.length === 0) return null;
    const campos = secao.numeros;
    if (!campos) throw new ErroMcp(400, `A seção "${secao.titulo}" não tem campos numéricos.`);
    const ids = campos.map(n => n.id);
    for (const { id } of numerosInformados) if (!ids.includes(id)) throw new ErroMcp(400, `A seção "${secao.titulo}" não tem o campo "${id}". Os campos são: ${ids.join(", ")}.`);
    const chave = chaveDosNumeros(rascunho.modelo, secao.id);
    const existente = linhas.get(chave);
    const atuais = lerNumeros(existente?.conteudo, ids);
    const mudancas = numerosInformados.filter(n => atuais[n.id] !== n.valor);
    if (mudancas.length === 0) return null;
    const trocas = mudancas.filter(n => atuais[n.id] !== null);
    if (trocas.length > 0 && !substituir) {
      throw new ErroMcp(409, `Já há número em ${trocas.map(n => `"${n.id}" (${atuais[n.id]})`).join(", ")}. Para trocar, confirme com a pessoa e envie substituir=true; o valor de antes fica guardado em "Ações do assistente".`, {
        numeros_atuais: Object.fromEntries(ids.map(id => [id, atuais[id]])),
      });
    }
    const depois = { ...Object.fromEntries(ids.filter(id => atuais[id] !== null).map(id => [id, atuais[id]])), ...Object.fromEntries(mudancas.map(n => [n.id, n.valor])) };
    return { chave, existente, atuais, mudancas, trocas, depois };
  })();

  const gravados: ResultadoDaSecao["campos_gravados"] = [];
  const acaoIds: string[] = [];

  if (planoDoTexto) {
    const { chave, existente, atual, novo } = planoDoTexto;
    const linhaId = await gravarLinha(admin, prestacao.id, chave, novo, existente);
    try {
      acaoIds.push(
        await registrarAcao(admin, quem, {
          prestacaoId: prestacao.id,
          ferramenta: "salvar_secao_do_relatorio",
          acao: atual ? "atualizar" : "criar",
          tabela: "prestacao_relatorio",
          registroId: linhaId,
          resumo: `${atual ? "Trocou" : "Preencheu"} o texto da seção “${secao.titulo.slice(0, 150)}” do relatório do objeto`,
          antes: atual ? { texto: atual } : undefined,
          depois: { texto: novo },
        }),
      );
    } catch (erro) {
      await restaurarLinha(admin, prestacao.id, linhaId, existente ? existente.conteudo : null);
      throw erro;
    }
    gravados.push("texto");
  }

  if (planoDosNumeros) {
    const { chave, existente, atuais, mudancas, trocas, depois } = planoDosNumeros;
    const linhaId = await gravarLinha(admin, prestacao.id, chave, JSON.stringify(depois), existente);
    try {
      acaoIds.push(
        await registrarAcao(admin, quem, {
          prestacaoId: prestacao.id,
          ferramenta: "salvar_secao_do_relatorio",
          acao: trocas.length > 0 ? "atualizar" : "criar",
          tabela: "prestacao_relatorio",
          registroId: linhaId,
          resumo: `${trocas.length > 0 ? "Trocou" : "Preencheu"} os números da seção “${secao.titulo.slice(0, 150)}” do relatório do objeto`,
          antes: trocas.length > 0 ? Object.fromEntries(trocas.map(n => [n.id, atuais[n.id]])) : undefined,
          depois: Object.fromEntries(mudancas.map(n => [n.id, n.valor])),
        }),
      );
    } catch (erro) {
      await restaurarLinha(admin, prestacao.id, linhaId, existente ? existente.conteudo : null);
      throw erro;
    }
    gravados.push("numeros");
  }

  return { mudou: gravados.length > 0, secao_id: secao.id, titulo: secao.titulo, campos_gravados: gravados, acao_ids: acaoIds };
}

export async function avisarSecaoPreenchida(admin: Admin, prestacaoId: string, titulo: string, secao: string, chave: string): Promise<void> {
  await avisarEquipe(admin, prestacaoId, "Relatório do objeto preenchido pelo assistente", `Em “${titulo}”, seção “${secao}”. Veja “Ações do assistente” na prestação.`, chave);
}
