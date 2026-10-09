// GET /api/prestacoes/[id]/transferegov (P9.4): a parceria do Pronon ou do
// Pronas/PCD no Transferegov, pela API pública de Gestão de Parcerias, lida
// pelo NUP da prestação: a parceria, a proposta, as contas no Banco do Brasil
// (com saldos e a classificação dos ingressos) e as linhas do extrato de cada
// conta. O navegador não busca direto porque a API não libera CORS.
//
// O acesso é conferido com a sessão de quem pediu: só quem vê a prestação
// consulta, e só o NUP dela. Nada é gravado aqui: a importação do extrato
// passa pela função do banco, com a permissão de quem edita.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  lerConta,
  lerExtratoDoTransferegov,
  lerParceria,
  lerProposta,
  processoDoNup,
  URL_DA_API_DE_PARCERIAS,
} from "@/lib/prestacao/transferegov";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A API devolve no máximo 200 por página; 25 páginas cobrem 5.000 linhas, o limite da importação. */
const POR_PAGINA = 200;
const PAGINAS = 25;

type Pagina = { data?: Record<string, unknown>[]; total_pages?: number };

class Indisponivel extends Error {}

async function pagina(caminho: string, parametros: Record<string, string | number>): Promise<Pagina> {
  const url = new URL(`${URL_DA_API_DE_PARCERIAS}${caminho}`);
  for (const [k, v] of Object.entries(parametros)) url.searchParams.set(k, String(v));
  let resposta: Response;
  try {
    resposta = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: "no-store", headers: { accept: "application/json", "user-agent": "Jards/1.0 (prestacao de contas)" } });
  } catch (erro) {
    console.error("[transferegov] sem resposta", caminho, erro);
    throw new Indisponivel();
  }
  if (!resposta.ok) {
    console.error("[transferegov] status", resposta.status, caminho);
    throw new Indisponivel();
  }
  return (await resposta.json()) as Pagina;
}

async function todas(caminho: string, parametros: Record<string, string | number>) {
  const primeira = await pagina(caminho, { ...parametros, pagina: 1, tamanho_da_pagina: POR_PAGINA });
  const total = Math.min(primeira.total_pages ?? 1, PAGINAS);
  const resto = await Promise.all(Array.from({ length: Math.max(0, total - 1) }, (_, i) => pagina(caminho, { ...parametros, pagina: i + 2, tamanho_da_pagina: POR_PAGINA })));
  return [primeira, ...resto].flatMap(p => p.data ?? []);
}

/** Com mais de uma parceria no mesmo processo, a que está andando. */
const PREFERENCIA = ["Em Execução", "Em Captação", "Aprovada", "Em Análise", "Em Elaboração", "Inativa", "Rejeitada"];

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "prestacao_inexistente" }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
  const { data: prestacao } = await (supabase as any).from("prestacoes_contas").select("id, identificador_oficial").eq("id", id).maybeSingle();
  if (!prestacao) return NextResponse.json({ error: "prestacao_inexistente" }, { status: 404 });

  const processo = processoDoNup(prestacao.identificador_oficial);
  if (!processo) return NextResponse.json({ error: "nup_invalido" }, { status: 422 });

  try {
    const [parcerias, atualizacao] = await Promise.all([
      pagina("/parceria", { cd_processo_sei: processo }),
      pagina("/data-atualizacao", {}).catch(() => null),
    ]);
    const registro = [...(parcerias.data ?? [])]
      .sort((a, b) => PREFERENCIA.indexOf(String(a.in_situacao_parceria)) - PREFERENCIA.indexOf(String(b.in_situacao_parceria)))[0];
    if (!registro) return NextResponse.json({ error: "parceria_nao_encontrada" }, { status: 404 });
    const parceria = lerParceria(registro);

    const [propostas, contasBrutas] = await Promise.all([
      registro.id_proposta ? pagina("/proposta", { id_proposta: String(registro.id_proposta) }).catch(() => null) : null,
      todas("/parceria-conta", { id_parceria: parceria.id }),
    ]);
    const contas = await Promise.all(contasBrutas.map(async bruta => {
      const conta = lerConta(bruta);
      const linhas = await todas("/extrato-bancario", { id_parceria_conta: conta.id });
      return { ...conta, lancamentos: lerExtratoDoTransferegov(linhas, conta.tipo) };
    }));

    const atualizadoEm = (atualizacao as { data_ultima_atualizacao?: string } | null)?.data_ultima_atualizacao?.slice(0, 10) ?? null;
    const proposta = propostas?.data?.[0] ? lerProposta(propostas.data[0]) : null;
    return NextResponse.json({ parceria, proposta, contas, atualizadoEm, consultadoEm: new Date().toISOString() });
  } catch (erro) {
    if (erro instanceof Indisponivel) return NextResponse.json({ error: "transferegov_indisponivel" }, { status: 502 });
    throw erro;
  }
}
