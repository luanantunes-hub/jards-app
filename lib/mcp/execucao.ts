import { NextRequest } from "next/server";
import type { Ferramenta } from "@/lib/mcp/ferramentas";
import { GET as organizacoesGET } from "@/app/api/mcp/organizacoes/route";
import { GET as projetosGET } from "@/app/api/mcp/projetos/route";
import { GET as projetoGET } from "@/app/api/mcp/projetos/[id]/route";
import { GET as empresasGET } from "@/app/api/mcp/empresas/route";
import { GET as contatosDaEmpresaGET } from "@/app/api/mcp/empresas/[id]/contatos/route";
import { POST as contatosPOST } from "@/app/api/mcp/contatos/route";
import { GET as propostasGET } from "@/app/api/mcp/propostas/route";
import { GET as tarefasGET, POST as tarefasPOST } from "@/app/api/mcp/tarefas/route";
import { GET as captadoresGET } from "@/app/api/mcp/captadores/route";
import { GET as proponentesGET } from "@/app/api/mcp/proponentes/route";
import { GET as editaisGET } from "@/app/api/mcp/editais/route";
import { GET as patrocinadoresPublicosGET } from "@/app/api/mcp/patrocinadores-publicos/route";
import { GET as carteiraEmpresaGET } from "@/app/api/mcp/analise/carteira-empresa/route";
import { GET as resumoGET } from "@/app/api/mcp/analise/resumo/route";

type Manipulador = (req: NextRequest, argumentos: Record<string, unknown>) => Promise<Response>;

const comId = (argumentos: Record<string, unknown>) => ({ params: Promise.resolve({ id: String(argumentos.id) }) });

/**
 * Cada operação da spec OpenAPI chama direto o handler REST dela: a autenticação, o escopo, a
 * organização e o plano continuam decididos num lugar só (as rotas em /api/mcp/*). O teste
 * tests/mcp-ferramentas.test.ts falha se uma operação nova ficar sem registro aqui.
 */
export const MANIPULADORES: Record<string, Manipulador> = {
  listarMinhasOrganizacoes: (req) => organizacoesGET(req),
  listarProjetos: (req) => projetosGET(req),
  obterProjeto: (req, args) => projetoGET(req, comId(args)),
  listarEmpresasCrm: (req) => empresasGET(req),
  listarContatosDaEmpresa: (req, args) => contatosDaEmpresaGET(req, comId(args)),
  criarContato: (req) => contatosPOST(req),
  listarPropostas: (req) => propostasGET(req),
  listarTarefas: (req) => tarefasGET(req),
  criarTarefa: (req) => tarefasPOST(req),
  listarCaptadores: (req) => captadoresGET(req),
  listarProponentes: (req) => proponentesGET(req),
  listarEditais: (req) => editaisGET(req),
  listarPatrocinadoresPublicos: (req) => patrocinadoresPublicosGET(req),
  avaliarCarteiraEmpresa: (req) => carteiraEmpresaGET(req),
  resumoOrganizacao: (req) => resumoGET(req),
};

/** Monta a requisição REST equivalente (mesmo token e mesmo IP de origem) e chama o handler. */
export async function executarFerramenta(
  ferramenta: Ferramenta,
  argumentos: Record<string, unknown>,
  original: NextRequest
): Promise<{ status: number; corpo: unknown }> {
  const manipulador = MANIPULADORES[ferramenta.operationId];
  if (!manipulador) return { status: 500, corpo: { error: "Ferramenta sem handler registrado." } };

  const caminho = ferramenta.caminho.replace(/\{(\w+)\}/g, (_, nome: string) => encodeURIComponent(String(argumentos[nome])));
  const url = new URL(`/api/mcp${caminho}`, original.nextUrl.origin);
  const restantes = Object.entries(argumentos).filter(([chave, valor]) => !ferramenta.parametrosDeCaminho.includes(chave) && valor !== undefined && valor !== null);

  const headers = new Headers();
  for (const nome of ["authorization", "x-forwarded-for", "x-real-ip", "user-agent"]) {
    const valor = original.headers.get(nome);
    if (valor) headers.set(nome, valor);
  }

  let body: string | undefined;
  if (ferramenta.metodo === "GET") {
    for (const [chave, valor] of restantes) url.searchParams.set(chave, String(valor));
  } else {
    headers.set("content-type", "application/json");
    body = JSON.stringify(Object.fromEntries(restantes));
  }

  const resposta = await manipulador(new NextRequest(url, { method: ferramenta.metodo, headers, body }), argumentos);
  const texto = await resposta.text();
  try {
    return { status: resposta.status, corpo: JSON.parse(texto) };
  } catch {
    return { status: resposta.status, corpo: texto };
  }
}
