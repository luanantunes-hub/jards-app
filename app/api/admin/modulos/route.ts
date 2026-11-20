import { NextRequest, NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { dependenciasDeAdmin, lerModuloDoContrato } from "@/lib/admin/servidor";
import { MODULOS_COM_CONTRATO } from "@/lib/equipe-modulos";
import type { ModuloId } from "@/lib/modulos";
import {
  contratoPago, hojeEmBrasilia, mensagemErroAcesso, NOME_NO_TEXTO, validarCortesia, type ContratoModulo,
} from "@/lib/modulos-contrato";

/* O schema ainda não foi regenerado com organization_modulos. */
/* eslint-disable @typescript-eslint/no-explicit-any */

// Liberação dos módulos com contrato (prestação de contas e produção) pelo super
// admin (P0.9, PD0.6). O navegador não escreve em organization_modulos nem em
// modulos_acesso: tudo passa por aqui, com a chave de serviço, depois de conferir
// o super admin. Cada pedido diz o módulo (`modulo`); sem ele vale a prestação,
// como sempre foi, e o que não tem contrato (a captação) é recusado.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireSuperAdmin() {
  const supabase = await dependenciasDeAdmin.createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, allowed: false };

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("jards_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  return { user, allowed: profile?.jards_super_admin === true };
}

function dataBr(data: string) {
  return data.split("-").reverse().join("/");
}

/** Vínculos e convites pendentes com o módulo: a mesma conta do banco. */
async function vagasEmUso(admin: any, organizationId: string, modulo: ModuloId): Promise<number> {
  const { data, error } = await admin.rpc("modulo_vagas_em_uso", { p_org: organizationId, p_modulo: modulo });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function GET(request: NextRequest) {
  const { user, allowed } = await requireSuperAdmin();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const admin = dependenciasDeAdmin.createAdminClient() as any;
  const organizacao = request.nextUrl.searchParams.get("organizacao");

  // Detalhe: membros de uma organização, com o acesso de cada um.
  if (organizacao) {
    if (!UUID.test(organizacao)) return NextResponse.json({ error: "Organização inválida" }, { status: 400 });
    const { data: membros, error } = await admin
      .from("organization_members")
      .select("user_id, papel, modulos_acesso, created_at")
      .eq("organization_id", organizacao)
      .order("created_at");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const ids = (membros ?? []).map((m: any) => m.user_id);
    const { data: perfis } = ids.length
      ? await admin.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] };
    const perfilPorId = new Map((perfis ?? []).map((p: any) => [p.id, p]));

    return NextResponse.json({
      membros: (membros ?? []).map((m: any) => {
        const perfil = perfilPorId.get(m.user_id) as any;
        return {
          user_id: m.user_id,
          papel: m.papel,
          modulos_acesso: m.modulos_acesso ?? [],
          nome: perfil?.full_name ?? null,
          email: perfil?.email ?? null,
        };
      }),
    });
  }

  // Lista: todas as organizações com o contrato de cada módulo pago e o uso de vagas.
  const [orgs, contratos, membros] = await Promise.all([
    admin.from("organizations").select("id, nome, created_at, modulos_ativos").order("nome"),
    admin.from("organization_modulos")
      .select("organization_id, modulo, status, cortesia_ate, cortesia_motivo, cortesia_por, vagas_cortesia, vagas_compradas, past_due_since, encerrado_em, updated_at, teste_gratis")
      .in("modulo", [...MODULOS_COM_CONTRATO]),
    admin.from("organization_members").select("organization_id, papel, modulos_acesso"),
  ]);
  const erro = orgs.error ?? contratos.error ?? membros.error;
  if (erro) return NextResponse.json({ error: erro.message }, { status: 500 });

  const contratoPorOrg = new Map((contratos.data ?? []).map((c: any) => [`${c.organization_id}:${c.modulo}`, c]));
  const contagem = new Map<string, { membros: number; comAcesso: Record<string, number> }>();
  for (const m of membros.data ?? []) {
    const atual = contagem.get(m.organization_id) ?? { membros: 0, comAcesso: {} };
    atual.membros += 1;
    if (m.papel !== "captador") {
      for (const modulo of MODULOS_COM_CONTRATO) {
        if ((m.modulos_acesso ?? []).includes(modulo)) atual.comAcesso[modulo] = (atual.comAcesso[modulo] ?? 0) + 1;
      }
    }
    contagem.set(m.organization_id, atual);
  }

  return NextResponse.json({
    organizacoes: (orgs.data ?? []).map((o: any) => ({
      id: o.id,
      nome: o.nome,
      created_at: o.created_at,
      modulos_ativos: o.modulos_ativos ?? [],
      membros: contagem.get(o.id)?.membros ?? 0,
      // Um item por módulo com contrato: o contrato (ou null) e quantas pessoas usam o módulo.
      modulos: Object.fromEntries(MODULOS_COM_CONTRATO.map(modulo => [modulo, {
        contrato: contratoPorOrg.get(`${o.id}:${modulo}`) ?? null,
        com_acesso: contagem.get(o.id)?.comAcesso[modulo] ?? 0,
      }])),
    })),
  });
}

type Corpo = {
  acao?: unknown;
  modulo?: unknown;
  organizationId?: unknown;
  userId?: unknown;
  ativo?: unknown;
  ate?: unknown;
  motivo?: unknown;
  vagas?: unknown;
};

export async function POST(request: NextRequest) {
  const { user, allowed } = await requireSuperAdmin();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const corpo = await request.json().catch(() => null) as Corpo | null;
  const organizationId = typeof corpo?.organizationId === "string" ? corpo.organizationId : "";
  if (!UUID.test(organizationId)) return NextResponse.json({ error: "Organização inválida" }, { status: 400 });
  const modulo = lerModuloDoContrato(corpo?.modulo);
  if (!modulo) return NextResponse.json({ error: "Módulo inválido" }, { status: 400 });
  const nome = NOME_NO_TEXTO[modulo];

  const admin = dependenciasDeAdmin.createAdminClient() as any;
  const [{ data: org }, { data: contrato }] = await Promise.all([
    admin.from("organizations").select("id, nome").eq("id", organizationId).maybeSingle(),
    admin.from("organization_modulos").select("*").eq("organization_id", organizationId).eq("modulo", modulo).maybeSingle(),
  ]);
  if (!org) return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });
  const atual = contrato as (ContratoModulo & { id: string }) | null;

  if (corpo?.acao === "liberar") {
    const pedido = {
      ate: typeof corpo.ate === "string" ? corpo.ate : "",
      motivo: typeof corpo.motivo === "string" ? corpo.motivo.trim() : "",
      vagas: typeof corpo.vagas === "number" ? corpo.vagas : Number.NaN,
    };
    if (contratoPago(atual)) {
      return NextResponse.json({ error: `A organização já assina a ${nome.curto}. A cortesia não substitui a assinatura.` }, { status: 409 });
    }
    const emUso = await vagasEmUso(admin, organizationId, modulo).catch(() => null);
    if (emUso === null) return NextResponse.json({ error: "Não foi possível conferir as vagas." }, { status: 500 });
    const invalido = validarCortesia(pedido, emUso, hojeEmBrasilia(), modulo);
    if (invalido) return NextResponse.json({ error: invalido }, { status: 400 });

    const mudouPrazo = atual?.status !== "cortesia" || atual.cortesia_ate !== pedido.ate;
    const { data: gravado, error } = await admin
      .from("organization_modulos")
      .upsert({
        organization_id: organizationId,
        modulo,
        status: "cortesia",
        cortesia_ate: pedido.ate,
        cortesia_motivo: pedido.motivo,
        vagas_cortesia: pedido.vagas,
        cortesia_por: user.id,
        encerrado_em: null,
        // Cortesia do suporte, mesmo quando estende o teste grátis do convite.
        teste_gratis: false,
        // Prazo novo, aviso novo: a rotina avisa de novo 7 dias antes.
        ...(mudouPrazo ? { cortesia_aviso_em: null } : {}),
      }, { onConflict: "organization_id,modulo" })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: "Não foi possível liberar a cortesia." }, { status: 500 });

    const renovacao = atual?.status === "cortesia";
    await writeAdminAuditLog({
      actorUserId: user.id,
      organizationId,
      action: atual ? "update" : "create",
      resourceType: "organizacao",
      resourceId: gravado.id,
      summary: `${renovacao ? "Alterou" : "Liberou"} a ${nome.completo} como cortesia para ${org.nome} até ${dataBr(pedido.ate)} (${pedido.vagas} ${pedido.vagas === 1 ? "vaga" : "vagas"})`,
      metadata: {
        modulo, ate: pedido.ate, motivo: pedido.motivo, vagas: pedido.vagas,
        anterior: atual ? { status: atual.status, cortesia_ate: atual.cortesia_ate, vagas_cortesia: atual.vagas_cortesia } : null,
      },
    }, admin);
    return NextResponse.json({ ok: true });
  }

  if (corpo?.acao === "encerrar") {
    if (!atual || atual.status !== "cortesia") {
      return NextResponse.json({ error: "Não há cortesia ativa para encerrar." }, { status: 409 });
    }
    const { error } = await admin
      .from("organization_modulos")
      .update({ status: "cancelado", encerrado_em: new Date().toISOString() })
      .eq("id", atual.id);
    if (error) return NextResponse.json({ error: "Não foi possível encerrar a cortesia." }, { status: 500 });

    await writeAdminAuditLog({
      actorUserId: user.id,
      organizationId,
      action: "update",
      resourceType: "organizacao",
      resourceId: atual.id,
      summary: `Encerrou a cortesia da ${nome.completo} de ${org.nome}`,
      metadata: { modulo, cortesia_ate: atual.cortesia_ate },
    }, admin);
    return NextResponse.json({ ok: true });
  }

  if (corpo?.acao === "acesso") {
    const userId = typeof corpo.userId === "string" ? corpo.userId : "";
    if (!UUID.test(userId) || typeof corpo.ativo !== "boolean") {
      return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
    }
    const { data: modulos, error } = await admin.rpc("admin_definir_acesso_modulo", {
      p_org: organizationId, p_user: userId, p_modulo: modulo, p_ativo: corpo.ativo,
    });
    if (error) return NextResponse.json({ error: mensagemErroAcesso(error.message) }, { status: 409 });

    const { data: perfil } = await admin.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
    const pessoa = perfil?.full_name ?? perfil?.email ?? "membro";
    await writeAdminAuditLog({
      actorUserId: user.id,
      organizationId,
      action: "update",
      resourceType: "organizacao",
      resourceId: atual?.id ?? null,
      targetUserId: userId,
      summary: `${corpo.ativo ? "Deu" : "Tirou"} acesso à ${nome.completo} ${corpo.ativo ? "a" : "de"} ${pessoa} em ${org.nome}`,
      metadata: { modulo, modulos_acesso: modulos },
    }, admin);
    return NextResponse.json({ ok: true, modulos_acesso: modulos });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
