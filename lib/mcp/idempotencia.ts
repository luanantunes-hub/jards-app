import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { Admin } from "@/lib/mcp/crm";
import { ErroMcp, erroDoBanco, type Corpo } from "@/lib/mcp/validacao";

/**
 * Escrita segura contra repetição. Quem cria algo pelo conector e recebe erro de rede (com o registro já gravado)
 * repete o pedido com a MESMA chave e recebe o resultado de antes, em vez de criar de novo.
 *
 * A chave é reservada antes da gravação (linha com status nulo) e completada depois, com a resposta. Assim dois
 * pedidos iguais ao mesmo tempo não gravam duas vezes: o segundo espera. Só respostas de sucesso ficam guardadas;
 * erro libera a chave para o pedido ser corrigido e repetido.
 */

export const CAMPO_CHAVE = "chave_idempotencia";
const FORMATO_DA_CHAVE = /^[A-Za-z0-9._:-]{8,128}$/;
/** Pedido "em andamento" há mais que isso é de uma chamada que morreu no meio: a chave pode ser retomada. */
const SEGUNDOS_ATE_ABANDONADO = 60;

interface DonoDaChave {
  orgId: string;
  userId: string;
  chave: string;
  /** Ex.: "POST /api/mcp/negociacoes". */
  operacao: string;
  /** Hash do pedido: a mesma chave com dados diferentes é recusada. */
  impressao: string;
}

/** Tira a chave do corpo (campo chave_idempotencia, ou o cabeçalho Idempotency-Key). Sem chave, devolve o corpo como veio. */
export function separarChave(corpo: Corpo, cabecalho: string | null): { chave: string | null; corpo: Corpo } {
  const { [CAMPO_CHAVE]: doCorpo, ...resto } = corpo;
  if (doCorpo !== undefined && doCorpo !== null && typeof doCorpo !== "string") throw new ErroMcp(400, `${CAMPO_CHAVE} deve ser texto.`);
  const chave = (typeof doCorpo === "string" && doCorpo.trim()) || cabecalho?.trim() || null;
  if (!chave) return { chave: null, corpo: resto };
  if (!FORMATO_DA_CHAVE.test(chave)) {
    throw new ErroMcp(400, `${CAMPO_CHAVE} deve ter de 8 a 128 caracteres (letras, números, ponto, hífen, dois-pontos ou sublinhado), como um UUID.`);
  }
  return { chave, corpo: resto };
}

/** JSON com as chaves em ordem, para que o mesmo pedido gere sempre o mesmo texto. */
function estavel(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(estavel).join(",")}]`;
  if (valor && typeof valor === "object") {
    const objeto = valor as Record<string, unknown>;
    const chaves = Object.keys(objeto).filter((chave) => objeto[chave] !== undefined).sort();
    return `{${chaves.map((chave) => `${JSON.stringify(chave)}:${estavel(objeto[chave])}`).join(",")}}`;
  }
  return JSON.stringify(valor) ?? "null";
}

export function impressaoDoPedido(operacao: string, corpo: Corpo): string {
  return createHash("sha256").update(`${operacao}\n${estavel(corpo)}`).digest("hex");
}

const linhaDa = (admin: Admin, dono: DonoDaChave) =>
  admin.from("mcp_idempotencia").select("impressao,status,resposta,criada_em").eq("organization_id", dono.orgId).eq("usuario_id", dono.userId).eq("chave", dono.chave);

async function liberar(admin: Admin, dono: DonoDaChave): Promise<void> {
  await admin
    .from("mcp_idempotencia")
    .delete()
    .eq("organization_id", dono.orgId)
    .eq("usuario_id", dono.userId)
    .eq("chave", dono.chave)
    .is("status", null);
}

const EM_ANDAMENTO = new ErroMcp(409, `Este mesmo pedido ainda está sendo processado. Espere alguns segundos e repita com a mesma ${CAMPO_CHAVE}.`);

/** "dono": esta chamada pode gravar. Qualquer outra coisa é a resposta pronta que deve voltar para quem chamou. */
async function reservar(admin: Admin, dono: DonoDaChave, tentativa = 0): Promise<"dono" | NextResponse> {
  const novo = await admin
    .from("mcp_idempotencia")
    .insert({ organization_id: dono.orgId, usuario_id: dono.userId, chave: dono.chave, operacao: dono.operacao, impressao: dono.impressao });
  if (!novo.error) return "dono";
  if (novo.error.code !== "23505") throw erroDoBanco(novo.error);

  const { data, error } = await linhaDa(admin, dono).maybeSingle();
  if (error) throw erroDoBanco(error);
  // Sumiu entre a tentativa e a leitura (a outra chamada falhou e liberou a chave): tenta de novo uma vez.
  if (!data) return tentativa < 1 ? reservar(admin, dono, tentativa + 1) : NextResponse.json({ error: EM_ANDAMENTO.message }, { status: 409 });

  const existente = data as { impressao: string; status: number | null; resposta: unknown; criada_em: string };
  if (existente.impressao !== dono.impressao) {
    throw new ErroMcp(422, `Esta ${CAMPO_CHAVE} já foi usada com outros dados. Use uma chave nova para um pedido diferente, ou repita exatamente o mesmo pedido.`);
  }

  if (existente.status !== null) {
    const corpo = existente.resposta && typeof existente.resposta === "object" ? (existente.resposta as Record<string, unknown>) : {};
    return NextResponse.json(
      {
        ...corpo,
        resposta_repetida: true,
        mensagem_repeticao: "Este pedido já tinha sido feito com a mesma chave_idempotencia: devolvi o resultado de antes e nada foi criado de novo.",
      },
      { status: existente.status, headers: { "Idempotent-Replayed": "true" } }
    );
  }

  const idade = (Date.now() - new Date(existente.criada_em).getTime()) / 1000;
  if (idade < SEGUNDOS_ATE_ABANDONADO) throw EM_ANDAMENTO;

  // Pedido abandonado: quem trocar a data de criação primeiro assume a chave; os outros esperam.
  const retomada = await admin
    .from("mcp_idempotencia")
    .update({ criada_em: new Date().toISOString() })
    .eq("organization_id", dono.orgId)
    .eq("usuario_id", dono.userId)
    .eq("chave", dono.chave)
    .eq("criada_em", existente.criada_em)
    .is("status", null)
    .select("chave");
  if (retomada.error) throw erroDoBanco(retomada.error);
  if (Array.isArray(retomada.data) && retomada.data.length > 0) return "dono";
  throw EM_ANDAMENTO;
}

/** Roda `executar` uma única vez por chave: repetições recebem a resposta guardada. */
export async function executarComIdempotencia(admin: Admin, dono: DonoDaChave, executar: () => Promise<NextResponse>): Promise<NextResponse> {
  const reserva = await reservar(admin, dono);
  if (reserva !== "dono") return reserva;

  let resposta: NextResponse;
  try {
    resposta = await executar();
  } catch (erro) {
    await liberar(admin, dono);
    throw erro;
  }

  if (resposta.status < 200 || resposta.status >= 300) {
    await liberar(admin, dono);
    return resposta;
  }

  const corpo: unknown = await resposta.clone().json().catch(() => null);
  const { error } = await admin
    .from("mcp_idempotencia")
    .update({ status: resposta.status, resposta: corpo, concluida_em: new Date().toISOString() })
    .eq("organization_id", dono.orgId)
    .eq("usuario_id", dono.userId)
    .eq("chave", dono.chave);
  // O registro já foi gravado: se só o resultado não pôde ser guardado, a chave perde a proteção, mas o pedido não falha.
  if (error) console.error("[mcp] não foi possível guardar a resposta da chave de idempotência", error.message);
  return resposta;
}
