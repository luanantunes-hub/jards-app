import { NextRequest } from "next/server";
import type { Ferramenta } from "@/lib/mcp/ferramentas";
import { SEM_PARAMETROS } from "@/lib/mcp/rota";
import { GET as organizacoesGET } from "@/app/api/mcp/organizacoes/route";
import { GET as opcoesGET } from "@/app/api/mcp/opcoes/route";
import { GET as projetosGET, POST as projetosPOST } from "@/app/api/mcp/projetos/route";
import { GET as projetoGET } from "@/app/api/mcp/projetos/[id]/route";
import { GET as empresasGET, POST as empresasPOST } from "@/app/api/mcp/empresas/route";
import { GET as empresaGET } from "@/app/api/mcp/empresas/[id]/route";
import { GET as contatosDaEmpresaGET } from "@/app/api/mcp/empresas/[id]/contatos/route";
import { GET as contatosGET, POST as contatosPOST } from "@/app/api/mcp/contatos/route";
import { GET as negociacoesGET, POST as negociacoesPOST } from "@/app/api/mcp/negociacoes/route";
import { GET as negociacaoGET } from "@/app/api/mcp/negociacoes/[id]/route";
import { GET as atividadesGET, POST as atividadesPOST } from "@/app/api/mcp/atividades/route";
import { GET as historicoGET } from "@/app/api/mcp/historico/route";
import { POST as notasPOST } from "@/app/api/mcp/notas/route";
import { POST as interacoesPOST } from "@/app/api/mcp/interacoes/route";
import { POST as followupsPOST } from "@/app/api/mcp/followups/route";
import { GET as inscricoesGET } from "@/app/api/mcp/inscricoes/route";
import { GET as propostasGET } from "@/app/api/mcp/propostas/route";
import { GET as captadoresGET } from "@/app/api/mcp/captadores/route";
import { GET as proponentesGET, POST as proponentesPOST } from "@/app/api/mcp/proponentes/route";
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
  listarOpcoesDoCrm: (req) => opcoesGET(req, SEM_PARAMETROS),
  listarProjetos: (req) => projetosGET(req, SEM_PARAMETROS),
  criarProjeto: (req) => projetosPOST(req, SEM_PARAMETROS),
  obterProjeto: (req, args) => projetoGET(req, comId(args)),
  listarEmpresasCrm: (req) => empresasGET(req, SEM_PARAMETROS),
  criarEmpresaCrm: (req) => empresasPOST(req, SEM_PARAMETROS),
  obterEmpresaCrm: (req, args) => empresaGET(req, comId(args)),
  listarContatosDaEmpresa: (req, args) => contatosDaEmpresaGET(req, comId(args)),
  listarContatos: (req) => contatosGET(req, SEM_PARAMETROS),
  criarContato: (req) => contatosPOST(req, SEM_PARAMETROS),
  listarNegociacoes: (req) => negociacoesGET(req, SEM_PARAMETROS),
  criarNegociacao: (req) => negociacoesPOST(req, SEM_PARAMETROS),
  obterNegociacao: (req, args) => negociacaoGET(req, comId(args)),
  listarAtividades: (req) => atividadesGET(req, SEM_PARAMETROS),
  criarAtividade: (req) => atividadesPOST(req, SEM_PARAMETROS),
  listarHistorico: (req) => historicoGET(req, SEM_PARAMETROS),
  criarNota: (req) => notasPOST(req, SEM_PARAMETROS),
  registrarInteracao: (req) => interacoesPOST(req, SEM_PARAMETROS),
  criarFollowup: (req) => followupsPOST(req, SEM_PARAMETROS),
  listarInscricoes: (req) => inscricoesGET(req, SEM_PARAMETROS),
  listarPropostas: (req) => propostasGET(req),
  listarCaptadores: (req) => captadoresGET(req),
  listarProponentes: (req) => proponentesGET(req, SEM_PARAMETROS),
  criarProponente: (req) => proponentesPOST(req, SEM_PARAMETROS),
  listarEditais: (req) => editaisGET(req),
  listarPatrocinadoresPublicos: (req) => patrocinadoresPublicosGET(req),
  avaliarCarteiraEmpresa: (req) => carteiraEmpresaGET(req),
  resumoOrganizacao: (req) => resumoGET(req, SEM_PARAMETROS),
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
