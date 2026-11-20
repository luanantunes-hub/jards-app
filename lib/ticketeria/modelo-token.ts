import "server-only";
import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";

const resposta = (corpo: object, status: number) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

/**
 * O job semanal do modelo (GitHub Actions) fala com o Jards por rotas protegidas por um token estreito (`MODELO_TOKEN`, no cabeçalho `Authorization: Bearer …`): ele só pode listar as lojas
 * prontas, ler a tabela semanal de uma e devolver o resultado. Devolve a resposta de erro, ou null se o token vale. Sem o token configurado (ou curto demais) responde 503: nada fica aberto.
 */
export function recusarSemTokenDoModelo(req: NextRequest): NextResponse | null {
  const segredo = process.env.MODELO_TOKEN;
  if (!segredo || segredo.length < 32) return resposta({ error: "modelo_indisponivel" }, 503);
  const enviado = req.headers.get("authorization") ?? "";
  const esperado = `Bearer ${segredo}`;
  const iguais = enviado.length === esperado.length && timingSafeEqual(Buffer.from(enviado), Buffer.from(esperado));
  return iguais ? null : resposta({ error: "nao_autorizado" }, 401);
}
