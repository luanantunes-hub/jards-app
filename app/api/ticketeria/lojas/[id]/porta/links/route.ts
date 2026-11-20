// /api/ticketeria/lojas/{id}/porta/links: os links da equipe da porta de uma sessão. Quem pede precisa EDITAR a Ticketeria da organização da loja.
//
//   GET  ?sessao={id}                   os links da sessão (com o segredo, para copiar) e a validade de cada um
//   POST { sessao_id, rotulo? }         cria um link (nome padrão "Porta 1", "Porta 2"...); até 10 ligados por sessão
// O link vale até 24 horas depois do começo da sessão, sem login, e só serve para ler QR Code, buscar pelo nome e dar entrada naquela sessão.

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { linksDaEquipe, proximoNomeDeLink } from "@/lib/ticketeria/porta";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function erro(e: { message?: string } | null) {
  const m = e?.message ?? "";
  if (m.includes("sessao_inexistente")) return resposta({ error: "sessao_inexistente" }, 404);
  if (m.includes("sessao_cancelada")) return resposta({ error: "sessao_cancelada", mensagem: "Esta sessão foi cancelada." }, 409);
  if (m.includes("sessao_encerrada")) return resposta({ error: "sessao_encerrada", mensagem: "Esta sessão já acabou: não dá mais para criar link." }, 409);
  if (m.includes("limite_de_links")) return resposta({ error: "limite_de_links", mensagem: "Já há 10 links ligados nesta sessão. Desligue algum para criar outro." }, 409);
  if (m.includes("rotulo_invalido")) return resposta({ error: "rotulo_invalido", mensagem: "Dê um nome de 1 a 60 caracteres ao link." }, 400);
  console.error("[ticketeria] links da porta:", m);
  return resposta({ error: "falha_na_porta" }, 500);
}

export async function GET(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "porta-links", max: 60 });
  if (a.erro) return a.erro;
  const sessao = req.nextUrl.searchParams.get("sessao") ?? "";
  if (!UUID.test(sessao)) return resposta({ error: "sessao_invalida" }, 400);
  const { data, error } = await a.admin.rpc("fn_ticketeria_porta_link_listar", { p_loja: a.loja.id, p_sessao: sessao.toLowerCase() });
  if (error) return erro(error);
  const links = linksDaEquipe(data, req.nextUrl.origin);
  return links ? resposta({ links }) : resposta({ error: "resposta_inesperada" }, 500);
}

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "porta-links-criar", max: 20 });
  if (a.erro) return a.erro;
  let corpo: { sessao_id?: unknown; rotulo?: unknown };
  try { corpo = await req.json(); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const sessao = typeof corpo.sessao_id === "string" ? corpo.sessao_id.toLowerCase() : "";
  if (!UUID.test(sessao)) return resposta({ error: "sessao_invalida" }, 400);
  let rotulo = typeof corpo.rotulo === "string" ? corpo.rotulo.trim() : "";
  if (rotulo === "") {
    const { data: lista } = await a.admin.rpc("fn_ticketeria_porta_link_listar", { p_loja: a.loja.id, p_sessao: sessao });
    const nomes = linksDaEquipe(lista, "https://x")?.map(l => l.rotulo) ?? [];
    rotulo = proximoNomeDeLink(nomes);
  }
  const { error } = await a.admin.rpc("fn_ticketeria_porta_link_criar", { p_loja: a.loja.id, p_sessao: sessao, p_rotulo: rotulo, p_usuario: a.user.id });
  if (error) return erro(error);
  const { data, error: erroDaLista } = await a.admin.rpc("fn_ticketeria_porta_link_listar", { p_loja: a.loja.id, p_sessao: sessao });
  if (erroDaLista) return erro(erroDaLista);
  const links = linksDaEquipe(data, req.nextUrl.origin);
  return links ? resposta({ links }, 201) : resposta({ error: "resposta_inesperada" }, 500);
}
