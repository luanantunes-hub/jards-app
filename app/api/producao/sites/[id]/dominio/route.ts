// /api/producao/sites/{id}/dominio (PD12.1b): o domínio da pessoa no site.
//
//   POST   { dominio }  cadastra o domínio no site (e no projeto da Vercel) e devolve os registros de DNS a criar
//   PUT    { id }       confere o DNS e a posse; se estiver tudo certo, o domínio fica ativo e o site abre nele
//   DELETE { id }       tira o domínio do site e da Vercel
//
// Quem chama precisa editar a produção da organização do site (as regras do banco valem na leitura do site). A escrita na tabela de
// domínios é só aqui, com a chave de serviço: o navegador não escreve nela. O domínio só vira ativo com as três provas juntas: a
// Vercel o verificou, o DNS aponta para ela, e o TXT de posse com o código está no DNS (sem a posse, ninguém publica um site
// no domínio de outra pessoa só por cadastrá-lo primeiro).

import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { lerDominio, registrosDeDns } from "@/lib/producao/site";
import {
  cadastrarDominioNaVercel, configDaVercel, pendenciasDoDominio, provaDeposseNoDns, removerDominioDaVercel, situacaoNaVercel,
} from "@/lib/producao/vercel-dominios";
import { isRateLimited } from "@/lib/mcp/rateLimit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const resposta = (corpo: object, status = 200) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

/** Quem pede, com o site que enxerga e o direito de editar. Devolve a resposta de erro quando não pode. */
async function autorizar(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const { id } = await rota.params;
  if (!UUID.test(id)) return { erro: resposta({ error: "site_invalido" }, 400) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: resposta({ error: "nao_autenticado" }, 401) };
  if (isRateLimited(`site-dominio:${user.id}`, 20)) return { erro: resposta({ error: "muitas_tentativas" }, 429) };
  const producao = clienteDaProducao(supabase);
  const { data: site } = await producao.from("producao_sites").select("id, organization_id").eq("id", id).maybeSingle();
  if (!site) return { erro: resposta({ error: "site_nao_encontrado" }, 404) };
  const { data: pode } = await producao.rpc("auth_producao_pode", { p_org: site.organization_id, p_acao: "editar" });
  if (pode !== true) return { erro: resposta({ error: "sem_permissao" }, 403) };
  return { site, user, admin: clienteDaProducao(createAdminClient()) };
}

async function corpoDe(req: NextRequest): Promise<Record<string, unknown>> {
  const corpo: unknown = await req.json().catch(() => null);
  return corpo && typeof corpo === "object" && !Array.isArray(corpo) ? (corpo as Record<string, unknown>) : {};
}

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const auth = await autorizar(req, rota);
  if ("erro" in auth) return auth.erro;
  const { site, user, admin } = auth;
  const leitura = lerDominio(String((await corpoDe(req)).dominio ?? ""));
  if (!leitura.ok) return resposta({ error: leitura.erro }, 422);
  const config = configDaVercel();
  if (!config) return resposta({ error: "nao_configurado", mensagem: "A conexão de domínios ainda não foi configurada no servidor do Jards. Fale com o suporte." }, 503);

  const { data: existente } = await admin.from("producao_site_dominios").select("id, site_id, situacao, token_verificacao").eq("dominio", leitura.dominio).maybeSingle();
  if (existente && existente.site_id === site.id) return resposta({ id: existente.id, dominio: leitura.dominio, situacao: existente.situacao, token: existente.token_verificacao, registros: registrosDeDns(leitura.dominio, existente.token_verificacao) });
  if (existente?.situacao === "ativo") return resposta({ error: "Este domínio já está em uso por outro site." }, 409);
  // Um cadastro que nunca ficou ativo não dá direito ao domínio: quem prova a posse primeiro, fica com ele.
  if (existente) await admin.from("producao_site_dominios").delete().eq("id", existente.id);

  const cadastro = await cadastrarDominioNaVercel(config, leitura.dominio);
  if (!cadastro.ok) return resposta({ error: cadastro.erro }, 502);
  const token = randomBytes(16).toString("hex");
  const { data: criado, error } = await admin.from("producao_site_dominios")
    .insert({ organization_id: site.organization_id, site_id: site.id, dominio: leitura.dominio, situacao: "aguardando", token_verificacao: token, criado_por: user.id })
    .select("id").single();
  if (error || !criado) return resposta({ error: "Não foi possível guardar o domínio. Tente de novo." }, 500);
  const estado = await situacaoNaVercel(config, leitura.dominio).catch(() => null);
  return resposta({ id: criado.id, dominio: leitura.dominio, situacao: "aguardando", token, registros: registrosDeDns(leitura.dominio, token, estado?.apontar) }, 201);
}

export async function PUT(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const auth = await autorizar(req, rota);
  if ("erro" in auth) return auth.erro;
  const { site, admin } = auth;
  const id = String((await corpoDe(req)).id ?? "");
  if (!UUID.test(id)) return resposta({ error: "dominio_invalido" }, 400);
  const config = configDaVercel();
  if (!config) return resposta({ error: "nao_configurado", mensagem: "A conexão de domínios ainda não foi configurada no servidor do Jards. Fale com o suporte." }, 503);
  const { data: registro } = await admin.from("producao_site_dominios").select("id, dominio, token_verificacao").eq("id", id).eq("site_id", site.id).maybeSingle();
  if (!registro) return resposta({ error: "dominio_nao_encontrado" }, 404);

  const [estado, prova] = await Promise.all([situacaoNaVercel(config, registro.dominio), provaDeposseNoDns(registro.dominio, registro.token_verificacao)]);
  const pendencias = pendenciasDoDominio(estado, prova);
  if (estado.cadastrado && !estado.verificado) pendencias.push("A Vercel ainda não verificou o domínio.");
  const ativo = pendencias.length === 0;
  const agora = new Date().toISOString();
  await admin.from("producao_site_dominios").update({
    situacao: ativo ? "ativo" : "verificando", erro: ativo ? null : pendencias.join(" ").slice(0, 500), conferido_em: agora, ...(ativo ? { verificado_em: agora } : {}),
  }).eq("id", registro.id);
  return resposta({ id: registro.id, dominio: registro.dominio, situacao: ativo ? "ativo" : "verificando", pendencias, registros: registrosDeDns(registro.dominio, registro.token_verificacao, estado.apontar) });
}

export async function DELETE(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const auth = await autorizar(req, rota);
  if ("erro" in auth) return auth.erro;
  const { site, admin } = auth;
  const id = String((await corpoDe(req)).id ?? "");
  if (!UUID.test(id)) return resposta({ error: "dominio_invalido" }, 400);
  const { data: registro } = await admin.from("producao_site_dominios").select("id, dominio").eq("id", id).eq("site_id", site.id).maybeSingle();
  if (!registro) return resposta({ error: "dominio_nao_encontrado" }, 404);
  const config = configDaVercel();
  if (config && !(await removerDominioDaVercel(config, registro.dominio))) return resposta({ error: "Não foi possível tirar o domínio do servidor agora. Tente de novo." }, 502);
  await admin.from("producao_site_dominios").delete().eq("id", registro.id);
  return resposta({ ok: true });
}
