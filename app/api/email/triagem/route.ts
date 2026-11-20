import { NextResponse } from "next/server";
import { requireUser } from "@/lib/calendar/require-user";
import { listEmailConnections } from "@/lib/email/connections";
import { podeConectarEmail } from "@/lib/email/liberacao";
import { agruparPorRemetente, dominioDoEmail, nomeDaEmpresaPeloDominio, nomeSugerido, sugerirEmpresa, type RemetenteAgrupado, type SugestaoDeEmpresa } from "@/lib/email/triagem";
import { emailsDosRemetentes, lerTodas } from "@/lib/email/triagem-banco";
import { createAdminClient } from "@/lib/supabase/admin";

type Contato = { id: string; nome: string | null; email: string | null; empresa_crm_id: string | null };
type Empresa = { id: string; nome: string; site: string | null };

export type RemetenteDaTriagem = RemetenteAgrupado & {
  organizationId: string;
  nomeSugerido: string;
  /** O contato que já existe com esse e-mail (primeiro passo feito), ou null. */
  contato: { id: string; nome: string | null; empresaId: string | null; empresaNome: string | null } | null;
  sugestaoDeEmpresa: SugestaoDeEmpresa | null;
  /** Sem empresa do CRM que já combine: um palpite de nome pelo domínio, para criar a empresa junto com o contato. */
  nomeDaEmpresaPeloDominio: string | null;
};

const MAXIMO_DE_REMETENTES = 200;

/**
 * A triagem da pessoa: quem escreveu (ou recebeu e-mail dela) e ainda não está nos contatos.
 * Cada remetente traz o que já foi feito (contato criado) e uma empresa sugerida pelo domínio.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;

  try {
    const conexoes = await listEmailConnections(user.id);
    const organizacoes = [...new Set(conexoes.map((conexao) => conexao.organization_id).filter((id): id is string => Boolean(id)))];
    if (organizacoes.length === 0) return NextResponse.json({ conectado: false, remetentes: [] });
    if (!(await podeConectarEmail({ id: user.id, email: user.email }, organizacoes[0]))) {
      return NextResponse.json({ error: "O e-mail ainda está em teste fechado." }, { status: 403 });
    }

    const admin = createAdminClient();
    const banco = admin as unknown as Parameters<typeof emailsDosRemetentes>[0];
    const remetentes: RemetenteDaTriagem[] = [];

    for (const organizationId of organizacoes) {
      const { data: pendentes, error } = await (admin as any)
        .from("email_triagem")
        .select("endereco, nome")
        .eq("user_id", user.id)
        .eq("organization_id", organizationId)
        .eq("estado", "pendente")
        .limit(MAXIMO_DE_REMETENTES);
      if (error) throw new Error(error.message);
      const linhas = (pendentes ?? []) as Array<{ endereco: string; nome: string | null }>;
      if (linhas.length === 0) continue;

      const enderecos = new Set(linhas.map((linha) => linha.endereco));
      const emails = await emailsDosRemetentes(banco, user.id, organizationId, [...enderecos]);
      const grupos = agruparPorRemetente(emails, enderecos);

      const contatos = await lerTodas<Contato>((de, ate) =>
        (admin as any).from("contatos").select("id, nome, email, empresa_crm_id").eq("organization_id", organizationId).range(de, ate));
      const empresas = await lerTodas<Empresa>((de, ate) =>
        (admin as any).from("empresas_crm").select("id, nome, site").eq("organization_id", organizationId).range(de, ate));
      const contatoPorEndereco = new Map<string, Contato>();
      for (const contato of contatos) {
        const endereco = (contato.email ?? "").trim().toLowerCase();
        if (endereco) contatoPorEndereco.set(endereco, contato);
      }
      const nomeDaEmpresa = new Map(empresas.map((empresa) => [empresa.id, empresa.nome]));
      const nomeGuardado = new Map(linhas.map((linha) => [linha.endereco, linha.nome]));

      for (const grupo of grupos) {
        const contato = contatoPorEndereco.get(grupo.endereco) ?? null;
        const nome = grupo.nome ?? nomeGuardado.get(grupo.endereco) ?? null;
        const sugestaoDeEmpresa = contato ? null : sugerirEmpresa(grupo.endereco, empresas, contatos);
        remetentes.push({
          ...grupo,
          nome,
          organizationId,
          nomeSugerido: nomeSugerido(grupo.endereco, nome),
          contato: contato
            ? { id: contato.id, nome: contato.nome, empresaId: contato.empresa_crm_id, empresaNome: contato.empresa_crm_id ? nomeDaEmpresa.get(contato.empresa_crm_id) ?? null : null }
            : null,
          sugestaoDeEmpresa,
          // Nenhuma empresa do CRM já combina: ainda assim o domínio pode virar uma empresa nova ao criar o contato.
          nomeDaEmpresaPeloDominio: contato || sugestaoDeEmpresa ? null : nomeDaEmpresaPeloDominio(dominioDoEmail(grupo.endereco)),
        });
      }
    }

    remetentes.sort((a, b) => Date.parse(b.ultimoEm ?? "") - Date.parse(a.ultimoEm ?? "") || 0);
    return NextResponse.json({ conectado: true, remetentes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao montar a triagem";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
