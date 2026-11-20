// /api/ticketeria/lojas/{id}/bilheteiros: quem vende na porta (a conta da bilheteria). Quem pede precisa EDITAR a Ticketeria da organização da loja.
//
//   GET  → { bilheteiros: [{ id, nome, email, ativo, criado_em }] }
//   POST { nome, email } → 201 { bilheteiro }; cria o acesso. Quem ainda não tem conta no Jards recebe um e-mail para criar a senha; quem já tem usa a própria.
//        400 dados_invalidos | 409 ja_cadastrada | 409 convite_pendente | 502 convite_falhou
// A resposta não diz se o e-mail já tinha conta no Jards.

import { type NextRequest } from "next/server";
import { appUrl } from "@/lib/email/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerNovoBilheteiro } from "@/lib/ticketeria/bilheteria";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
const TAMANHO_MAXIMO = 4 * 1024;

/** ilike trata % e _ como curingas: o e-mail é comparado literalmente. */
const emailLiteral = (email: string) => email.replace(/[\\%_]/g, c => `\\${c}`);

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "bilheteiros", max: 60 });
  if (a.erro) return a.erro;
  const { data, error } = await a.admin.from("ticketeria_bilheteiros").select("id, user_id, nome, ativo, created_at").eq("loja_id", a.loja.id).order("created_at", { ascending: false });
  if (error) { console.error("[ticketeria] bilheteiros da loja:", error.message); return resposta({ error: "falha_ao_ler" }, 500); }
  const ids = (data ?? []).map(b => b.user_id);
  const emails = new Map<string, string>();
  if (ids.length > 0) {
    const { data: perfis } = await createAdminClient().from("profiles").select("id, email").in("id", ids);
    for (const p of perfis ?? []) if (typeof p.email === "string") emails.set(p.id as string, p.email);
  }
  return resposta({ bilheteiros: (data ?? []).map(b => ({ id: b.id, nome: b.nome, email: emails.get(b.user_id) ?? null, ativo: b.ativo, criado_em: b.created_at })) });
}

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "bilheteiros-novo", max: 20 });
  if (a.erro) return a.erro;
  const texto = await req.text();
  if (new TextEncoder().encode(texto).length > TAMANHO_MAXIMO) return resposta({ error: "dados_invalidos" }, 413);
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { return resposta({ error: "dados_invalidos" }, 400); }
  const leitura = lerNovoBilheteiro(bruto);
  if (!leitura.ok) return resposta({ error: "dados_invalidos", mensagem: leitura.erro }, 400);
  const { nome, email } = leitura.valor;

  try {
    const admin = createAdminClient();
    const { data: perfil, error: erroDoPerfil } = await admin.from("profiles").select("id").ilike("email", emailLiteral(email)).maybeSingle();
    if (erroDoPerfil) throw new Error(erroDoPerfil.message);
    let userId: string | null = perfil?.id ?? null;

    if (userId) {
      // Quem já tem conta: se já está na bilheteria, ou volta a ter acesso (se estava desligada), ou é repetida.
      const { data: existente } = await a.admin.from("ticketeria_bilheteiros").select("id, ativo").eq("loja_id", a.loja.id).eq("user_id", userId).maybeSingle();
      if (existente?.ativo) return resposta({ error: "ja_cadastrada" }, 409);
      if (existente) {
        const { data, error } = await a.admin.from("ticketeria_bilheteiros").update({ ativo: true, nome }).eq("id", existente.id).select("id, nome, ativo, created_at").single();
        if (error || !data) throw new Error(error?.message ?? "sem linha");
        return resposta({ bilheteiro: { id: data.id, nome: data.nome, email, ativo: data.ativo, criado_em: data.created_at } }, 201);
      }
    } else {
      const redirectTo = `${appUrl()}/api/auth/callback?next=${encodeURIComponent("/nova-senha?next=/bilheteria")}`;
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { ticketeria_bilheteria: true } });
      if (error || !data.user) {
        const ja = /already|registered|exists/i.test(error?.message ?? "") || (error as { code?: string } | null)?.code === "email_exists";
        return resposta({ error: ja ? "convite_pendente" : "convite_falhou" }, ja ? 409 : 502);
      }
      userId = data.user.id;
    }

    const { data, error } = await a.admin.from("ticketeria_bilheteiros").insert({ organization_id: a.loja.organization_id, loja_id: a.loja.id, user_id: userId, nome, criado_por: a.user.id }).select("id, nome, ativo, created_at").single();
    if (error || !data) {
      if (error?.code === "23505") return resposta({ error: "ja_cadastrada" }, 409);
      throw new Error(error?.message ?? "sem linha");
    }
    return resposta({ bilheteiro: { id: data.id, nome: data.nome, email, ativo: data.ativo, criado_em: data.created_at } }, 201);
  } catch (erro) {
    console.error("[ticketeria] cadastrar bilheteiro:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_gravar" }, 500);
  }
}
