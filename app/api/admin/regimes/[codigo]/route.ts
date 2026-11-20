import { NextRequest, NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import {
  diferencaEntreVersoes, montarRascunho, regrasQueBloqueiamEnvio, resumoDasMudancas, type MudancaRevisada,
} from "@/lib/prestacao/regimes/revisao";
import { validarRegime } from "@/lib/prestacao/regimes/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { OPERACOES, type Operacao } from "@/supabase/functions/_shared/proposta-regime";

/* prestacao_regimes e as propostas ainda não estão no tipo Database. */
/* eslint-disable @typescript-eslint/no-explicit-any */

// Revisão e publicação de regimes (P6.3), só para a equipe Jards. Toda versão
// nova passa por aqui: a rota monta o rascunho (lib/prestacao/regimes/revisao.ts),
// valida no schema e chama as funções do banco com a chave de serviço; quem
// está logado não escreve na tabela.
//
// POST { acao: "rascunho", propostaId?, mudancas, vigenteDesde?, notas? }
// POST { acao: "aprovar" }   publica, ou registra a primeira de duas aprovações;
//                            ao publicar, a versão guarda o resumo do que muda e
//                            as organizações com prestações na anterior são avisadas (P6.4)
// POST { acao: "descartar" }
// POST { acao: "rejeitar", propostaId, motivo }

const CODIGO = /^[a-z0-9_]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

const ERROS: Record<string, [number, string]> = {
  sem_permissao: [403, "Só a equipe Jards revisa regimes."],
  regime_sem_versao_publicada: [404, "O regime não tem versão publicada."],
  versao_invalida: [409, "O rascunho precisa ser a versão seguinte à publicada. Recarregue a página."],
  proposta_invalida: [409, "A proposta já foi revisada. Recarregue a página."],
  rascunho_inexistente: [404, "Não há rascunho deste regime."],
  ja_aprovou: [409, "Você já aprovou esta versão. A segunda aprovação é de outra pessoa da equipe."],
  motivo_obrigatorio: [400, "Diga o motivo da rejeição."],
};

const resposta = (corpo: unknown, status = 200) => NextResponse.json(corpo, { status });

function erroDoBanco(error: { message?: string } | null) {
  const codigo = Object.keys(ERROS).find(c => error?.message?.includes(c));
  const [status, mensagem] = codigo ? ERROS[codigo] : [500, "Não foi possível concluir a operação."];
  return resposta({ error: mensagem }, status);
}

async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, allowed: false };
  const { data: profile } = await (supabase as any).from("profiles").select("jards_super_admin").eq("id", user.id).maybeSingle();
  return { user, allowed: profile?.jards_super_admin === true };
}

function lerMudancas(bruto: unknown): MudancaRevisada[] | null {
  if (!Array.isArray(bruto) || bruto.length > 60) return null;
  const lidas: MudancaRevisada[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") return null;
    const m = item as Record<string, unknown>;
    if (!OPERACOES.includes(m.operacao as Operacao) || typeof m.caminho !== "string" || m.caminho.length > 300) return null;
    lidas.push({
      operacao: m.operacao as Operacao,
      caminho: m.caminho,
      valor: m.valor ?? null,
      documento: typeof m.documento === "string" ? m.documento : "",
      dispositivo: typeof m.dispositivo === "string" ? m.dispositivo : "",
      citacao: typeof m.citacao === "string" ? m.citacao : undefined,
      aConfirmar: m.aConfirmar === true,
    });
  }
  return lidas;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  if (!CODIGO.test(codigo)) return resposta({ error: "Regime inválido." }, 400);
  const { user, allowed } = await requireSuperAdmin();
  if (!user) return resposta({ error: "Não autenticado" }, 401);
  if (!allowed) return resposta({ error: "Acesso negado" }, 403);

  const corpo = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!corpo || typeof corpo.acao !== "string") return resposta({ error: "Pedido inválido." }, 400);

  const admin = createAdminClient() as any;
  const [publicadoLido, rascunhoLido] = await Promise.all([
    admin.from("prestacao_regimes").select("id, versao, nome, parametros").eq("codigo", codigo).eq("status", "publicado").maybeSingle(),
    admin.from("prestacao_regimes").select("id, versao, parametros").eq("codigo", codigo).eq("status", "rascunho").maybeSingle(),
  ]);
  const publicado = publicadoLido.data as { id: string; versao: number; nome: string; parametros: Record<string, unknown> } | null;
  const rascunho = rascunhoLido.data as { id: string; versao: number; parametros: Record<string, unknown> } | null;
  if (!publicado) return resposta({ error: ERROS.regime_sem_versao_publicada[1] }, 404);
  const auditoria = (action: string, resourceId: string | null, summary: string, metadata: Record<string, unknown> = {}) =>
    writeAdminAuditLog({ actorUserId: user.id, action, resourceType: "prestacao_regime", resourceId, summary, metadata: { codigo, ...metadata } });

  if (corpo.acao === "rascunho") {
    const mudancas = lerMudancas(corpo.mudancas ?? []);
    if (!mudancas) return resposta({ error: "Mudanças inválidas." }, 400);
    const vigencia = corpo.vigenteDesde;
    if (vigencia !== undefined && vigencia !== null && (typeof vigencia !== "string" || !DATA.test(vigencia))) {
      return resposta({ error: "Data de vigência inválida." }, 400);
    }
    const propostaId = corpo.propostaId ?? null;
    if (propostaId !== null && (typeof propostaId !== "string" || !UUID.test(propostaId))) return resposta({ error: "Proposta inválida." }, 400);
    const notas = typeof corpo.notas === "string" ? corpo.notas.slice(0, 2000) : null;
    if (!mudancas.length && vigencia === undefined && !notas && !propostaId) return resposta({ error: "Nada para levar ao rascunho." }, 400);

    const versao = publicado.versao + 1;
    const montado = montarRascunho(rascunho?.parametros ?? publicado.parametros, mudancas, { versao, vigenteDesde: vigencia as string | null | undefined });
    if (!montado.ok) return resposta({ error: "A versão não passa nas regras do regime.", erros: montado.erros }, 422);
    const regras = regrasQueBloqueiamEnvio(publicado.parametros, montado.regime);
    const { data: id, error } = await admin.rpc("fn_regime_rascunho_salvar", {
      p_codigo: codigo, p_parametros: montado.regime, p_usuario: user.id, p_proposta_id: propostaId,
      p_regras_de_bloqueio: regras, p_notas: notas,
    });
    if (error) return erroDoBanco(error);
    await auditoria("regime_rascunho", id, `${publicado.nome}: rascunho da versão ${versao} com ${mudancas.length} ${mudancas.length === 1 ? "mudança" : "mudanças"}`,
      { versao, propostaId, caminhos: mudancas.map(m => m.caminho), regrasDeBloqueio: regras });
    return resposta({ rascunhoId: id, versao, regrasDeBloqueio: regras, diferencas: diferencaEntreVersoes(publicado.parametros, montado.regime).length });
  }

  if (corpo.acao === "aprovar") {
    if (!rascunho) return resposta({ error: ERROS.rascunho_inexistente[1] }, 404);
    // O que está guardado é o que publica: confere de novo no schema.
    const validacao = validarRegime(rascunho.parametros);
    if (!validacao.ok) return resposta({ error: "A versão não passa nas regras do regime.", erros: validacao.erros }, 422);
    const resumo = resumoDasMudancas(publicado.parametros, rascunho.parametros).slice(0, 200);
    const { data: situacao, error } = await admin.rpc("fn_regime_rascunho_aprovar", {
      p_regime_id: rascunho.id, p_usuario: user.id, p_resumo: resumo,
    });
    if (error) return erroDoBanco(error);
    if (situacao !== "publicado") {
      await auditoria("regime_primeira_aprovacao", rascunho.id, `${publicado.nome}: versão ${rascunho.versao} aprovada, aguarda a segunda aprovação`,
        { versao: rascunho.versao });
      return resposta({ situacao, versao: rascunho.versao });
    }
    // Logo depois de publicar, toda prestação em andamento do regime está numa versão anterior.
    const { data: afetadas } = await admin.rpc("fn_regime_prestacoes_afetadas", { p_codigo: codigo });
    const { prestacoes = 0, organizacoes = 0 } = (afetadas?.[0] ?? {}) as { prestacoes?: number; organizacoes?: number };
    await auditoria("regime_publicado", rascunho.id, `${publicado.nome}: versão ${rascunho.versao} publicada`,
      { versao: rascunho.versao, mudancas: resumo.length, prestacoesAfetadas: prestacoes, organizacoesAvisadas: organizacoes });
    return resposta({ situacao, versao: rascunho.versao, prestacoes, organizacoes });
  }

  if (corpo.acao === "descartar") {
    if (!rascunho) return resposta({ error: ERROS.rascunho_inexistente[1] }, 404);
    const { error } = await admin.rpc("fn_regime_rascunho_descartar", { p_regime_id: rascunho.id, p_usuario: user.id });
    if (error) return erroDoBanco(error);
    await auditoria("regime_rascunho_descartado", rascunho.id, `${publicado.nome}: rascunho da versão ${rascunho.versao} descartado`);
    return resposta({ ok: true });
  }

  if (corpo.acao === "rejeitar") {
    const propostaId = corpo.propostaId;
    if (typeof propostaId !== "string" || !UUID.test(propostaId)) return resposta({ error: "Proposta inválida." }, 400);
    const { data: proposta } = await admin.from("prestacao_regime_propostas").select("regime_codigo").eq("id", propostaId).maybeSingle();
    if (proposta?.regime_codigo !== codigo) return resposta({ error: "Proposta inválida." }, 400);
    const { error } = await admin.rpc("fn_regime_proposta_rejeitar", {
      p_proposta_id: propostaId, p_usuario: user.id, p_motivo: typeof corpo.motivo === "string" ? corpo.motivo : "",
    });
    if (error) return erroDoBanco(error);
    await auditoria("regime_proposta_rejeitada", propostaId, `${publicado.nome}: proposta rejeitada`, { motivo: corpo.motivo });
    return resposta({ ok: true });
  }

  return resposta({ error: "Ação desconhecida." }, 400);
}
