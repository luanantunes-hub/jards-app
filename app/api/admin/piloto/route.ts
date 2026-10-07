import { NextRequest, NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { erroDoPiloto, medidasDaPrestacao, resumoDaOrganizacao, type DadosDaPrestacaoNoPiloto } from "@/lib/prestacao/piloto";

/* As tabelas da prestação e do piloto ainda não estão no tipo Database. */
/* eslint-disable @typescript-eslint/no-explicit-any */

// Piloto da prestação de contas (P4.8): as organizações do piloto, o tempo de
// antes e as medidas da seção 16 do estudo. Só o super admin, com a chave de
// serviço: piloto_organizacoes não tem política para quem está logado.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGINA = 1000;

async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, allowed: false };
  const { data: profile } = await (supabase as any).from("profiles").select("jards_super_admin").eq("id", user.id).maybeSingle();
  return { user, allowed: profile?.jards_super_admin === true };
}

/** Todas as linhas, de mil em mil (o limite de cada leitura). */
async function todas(consulta: (de: number, ate: number) => PromiseLike<{ data: any[] | null; error: any }>): Promise<any[]> {
  const linhas: any[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    linhas.push(...(data ?? []));
    if (!data || data.length < PAGINA) return linhas;
  }
}

function agrupar(linhas: readonly any[]): Map<string, any[]> {
  const mapa = new Map<string, any[]>();
  for (const l of linhas) mapa.set(l.prestacao_id, [...(mapa.get(l.prestacao_id) ?? []), l]);
  return mapa;
}

export async function GET() {
  const { user, allowed } = await requireSuperAdmin();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const admin = createAdminClient() as any;
  try {
    const [piloto, orgs, contratos] = await Promise.all([
      admin.from("piloto_organizacoes").select("organization_id, entrou_em, dias_antes, observacoes, created_at").order("created_at"),
      admin.from("organizations").select("id, nome").order("nome"),
      admin.from("organization_modulos").select("organization_id, status, cortesia_ate").eq("modulo", "prestacao"),
    ]);
    const falha = piloto.error ?? orgs.error ?? contratos.error;
    if (falha) throw new Error(falha.message);

    const nomes = new Map((orgs.data ?? []).map((o: any) => [o.id, o.nome as string]));
    const contratoPorOrg = new Map((contratos.data ?? []).map((c: any) => [c.organization_id, c]));
    const ids = (piloto.data ?? []).map((p: any) => p.organization_id as string);

    const prestacoes = ids.length
      ? await todas((de, ate) => admin.from("prestacoes_contas")
        .select("id, titulo, organization_id, created_at, prazo_final, prazo_final_override, status, regime:regime_id(codigo)")
        .in("organization_id", ids).order("created_at").range(de, ate))
      : [];
    const pids = prestacoes.map(p => p.id as string);
    const porPrestacao = async (tabela: string, campos: string, filtro?: (q: any) => any) => pids.length
      ? agrupar(await todas((de, ate) => {
        const q = admin.from(tabela).select(campos).in("prestacao_id", pids);
        return (filtro ? filtro(q) : q).order("id").range(de, ate);
      }))
      : new Map<string, any[]>();

    const [envios, contas, lancamentos, pagamentos, chamadas, diligencias] = await Promise.all([
      porPrestacao("prestacao_envios", "id, prestacao_id, enviado_em", q => q.eq("etapa", "final")),
      porPrestacao("prestacao_contas_bancarias", "id, prestacao_id, tipo"),
      porPrestacao("prestacao_lancamentos", "id, prestacao_id, conta_id, data, natureza, valor, historico, numero_documento, numero_normalizado, categoria", q => q.eq("natureza", "debito")),
      porPrestacao("prestacao_pagamentos", "id, prestacao_id, despesa_id, data, valor, numero_documento, favorecido_documento, lancamento_id"),
      porPrestacao("prestacao_ia_chamadas", "id, prestacao_id, custo_usd, sucesso"),
      porPrestacao("prestacao_diligencias", "id, prestacao_id, preditiva, apontamentos"),
    ]);

    type Medidas = ReturnType<typeof medidasDaPrestacao> & { regime: string | null; status: string };
    const medidasPorOrg = new Map<string, Medidas[]>();
    for (const p of prestacoes) {
      const dados: DadosDaPrestacaoNoPiloto = {
        id: p.id,
        titulo: p.titulo,
        criadaEm: p.created_at,
        prazoFinal: p.prazo_final_override ?? p.prazo_final ?? null,
        enviosFinais: envios.get(p.id) ?? [],
        contas: contas.get(p.id) ?? [],
        lancamentos: lancamentos.get(p.id) ?? [],
        pagamentos: pagamentos.get(p.id) ?? [],
        chamadasIa: chamadas.get(p.id) ?? [],
        diligencias: (diligencias.get(p.id) ?? []).map(d => ({ preditiva: Boolean(d.preditiva), apontamentos: d.apontamentos ?? [] })),
      };
      const medidas = { ...medidasDaPrestacao(dados), regime: p.regime?.codigo ?? null, status: p.status };
      medidasPorOrg.set(p.organization_id, [...(medidasPorOrg.get(p.organization_id) ?? []), medidas]);
    }

    return NextResponse.json({
      organizacoes: (piloto.data ?? []).map((o: any) => {
        const medidas = medidasPorOrg.get(o.organization_id) ?? [];
        const contrato = contratoPorOrg.get(o.organization_id) as any;
        return {
          organization_id: o.organization_id,
          nome: nomes.get(o.organization_id) ?? "Organização removida",
          entrou_em: o.entrou_em,
          dias_antes: o.dias_antes,
          observacoes: o.observacoes,
          contrato: contrato ? { status: contrato.status, cortesia_ate: contrato.cortesia_ate } : null,
          resumo: resumoDaOrganizacao(medidas, o.dias_antes),
          prestacoes: medidas,
        };
      }),
      // As que podem entrar: têm a prestação de contas e ainda não estão no piloto.
      candidatas: (orgs.data ?? [])
        .filter((o: any) => contratoPorOrg.has(o.id) && !ids.includes(o.id) && (contratoPorOrg.get(o.id) as any).status !== "cancelado")
        .map((o: any) => ({ id: o.id, nome: o.nome, status: (contratoPorOrg.get(o.id) as any).status })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao ler o piloto" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, allowed } = await requireSuperAdmin();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const corpo = await request.json().catch(() => null) as { organizationId?: unknown; diasAntes?: unknown; observacoes?: unknown; entrouEm?: unknown } | null;
  const organizationId = typeof corpo?.organizationId === "string" ? corpo.organizationId : "";
  if (!UUID.test(organizationId)) return NextResponse.json({ error: "Organização inválida" }, { status: 400 });
  const diasAntes = corpo?.diasAntes === null || corpo?.diasAntes === undefined ? "" : String(corpo.diasAntes);
  const observacoes = typeof corpo?.observacoes === "string" ? corpo.observacoes.trim() : "";
  const entrouEm = typeof corpo?.entrouEm === "string" && /^\d{4}-\d{2}-\d{2}$/.test(corpo.entrouEm) ? corpo.entrouEm : null;
  const problema = erroDoPiloto({ diasAntes, observacoes });
  if (problema) return NextResponse.json({ error: problema }, { status: 400 });

  const admin = createAdminClient() as any;
  const [{ data: org }, { data: atual }] = await Promise.all([
    admin.from("organizations").select("id, nome").eq("id", organizationId).maybeSingle(),
    admin.from("piloto_organizacoes").select("organization_id").eq("organization_id", organizationId).maybeSingle(),
  ]);
  if (!org) return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });

  const linha = {
    organization_id: organizationId,
    dias_antes: diasAntes.trim() ? Number(diasAntes) : null,
    observacoes: observacoes || null,
    ...(entrouEm ? { entrou_em: entrouEm } : {}),
    ...(atual ? {} : { incluido_por: user.id }),
  };
  const { error } = await admin.from("piloto_organizacoes").upsert(linha, { onConflict: "organization_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAdminAuditLog({
    actorUserId: user.id,
    organizationId,
    action: atual ? "update" : "create",
    resourceType: "organizacao",
    resourceId: organizationId,
    summary: atual ? `Alterou ${org.nome} no piloto da prestação de contas` : `Incluiu ${org.nome} no piloto da prestação de contas`,
    metadata: { piloto: true, dias_antes: linha.dias_antes },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { user, allowed } = await requireSuperAdmin();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const organizationId = request.nextUrl.searchParams.get("organizacao") ?? "";
  if (!UUID.test(organizationId)) return NextResponse.json({ error: "Organização inválida" }, { status: 400 });
  const admin = createAdminClient() as any;
  const { data: org } = await admin.from("organizations").select("nome").eq("id", organizationId).maybeSingle();
  const { error } = await admin.from("piloto_organizacoes").delete().eq("organization_id", organizationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAdminAuditLog({
    actorUserId: user.id,
    organizationId,
    action: "delete",
    resourceType: "organizacao",
    resourceId: organizationId,
    summary: `Tirou ${org?.nome ?? "a organização"} do piloto da prestação de contas`,
    metadata: { piloto: true },
  });
  return NextResponse.json({ ok: true });
}
