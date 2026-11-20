import type { createClient } from "@/lib/supabase/client";
import {
  MAX_SELECAO,
  planejarLote,
  traduzirErroDoLote,
  type EmpresaDaBase,
  type EmpresaDoCrm,
  type PedidoDoLote,
  type ResumoDoLote,
} from "@/lib/patrocinadores-selecao";

type Cliente = ReturnType<typeof createClient>;

const COLUNAS = "id, nome, empresa_pub_id, account_id, tags, responsavel_interno_id";
const POR_PAGINA = 1000;

// O tipo gerado do banco não aceita gravar em empresas_crm (vira `never`); o resto do app grava pelo mesmo atalho.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const empresasCrm = (cliente: Cliente) => (cliente as any).from("empresas_crm");

/** Todas as empresas do CRM da organização (as que a pessoa enxerga), para saber quais já estão lá. */
async function empresasDoCrm(cliente: Cliente, organizacaoId: string): Promise<EmpresaDoCrm[]> {
  const todas: EmpresaDoCrm[] = [];
  for (let pagina = 0; pagina < 10; pagina++) {
    const { data, error } = await empresasCrm(cliente)
      .select(COLUNAS)
      .eq("organization_id", organizacaoId)
      .order("id", { ascending: true })
      .range(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1);
    if (error) throw new Error(traduzirErroDoLote(error.message));
    const linhas = (data ?? []) as unknown as EmpresaDoCrm[];
    todas.push(...linhas);
    if (linhas.length < POR_PAGINA) break;
  }
  return todas;
}

/**
 * Leva as empresas marcadas na base pública para o CRM da organização: cria as que ainda não estão lá e põe a
 * tag ou o responsável em todas. Repetir o mesmo pedido é seguro: quem já está no CRM não é duplicado e o que já
 * foi aplicado não muda de novo. As regras de acesso do banco valem: só quem criou a empresa pode alterá-la.
 */
export async function adicionarEmpresasAoCrm(
  cliente: Cliente,
  entrada: {
    organizacaoId: string;
    usuarioId: string;
    empresas: readonly EmpresaDaBase[];
    pedido: PedidoDoLote;
    vocabulario?: readonly string[];
  },
): Promise<ResumoDoLote> {
  const { organizacaoId, usuarioId, empresas, pedido, vocabulario } = entrada;
  if (empresas.length === 0) throw new Error("Marque ao menos uma empresa.");
  if (empresas.length > MAX_SELECAO) throw new Error(`Marque até ${MAX_SELECAO} empresas por vez.`);
  if (pedido.tipo === "tag" && pedido.tags.length === 0) throw new Error("Escolha uma tag.");

  const doCrm = await empresasDoCrm(cliente, organizacaoId);
  const plano = planejarLote({ empresas, doCrm, organizacaoId, usuarioId, pedido, vocabulario });

  // Primeiro as que entram (uma só gravação: ou entram todas ou nenhuma); se falhar, nada mudou.
  if (plano.criar.length > 0) {
    const { error } = await empresasCrm(cliente).insert(plano.criar);
    if (error) throw new Error(traduzirErroDoLote(error.message));
  }

  const jaEntraram = plano.criar.length > 0 ? ` As ${plano.criar.length} novas já entraram no CRM; é só repetir para terminar.` : "";
  for (const grupo of plano.gravarTags) {
    const { data, error } = await empresasCrm(cliente).update({ tags: grupo.tags }).in("id", grupo.ids).select("id");
    if (error) throw new Error(`${traduzirErroDoLote(error.message)}${jaEntraram}`);
    if ((data ?? []).length < grupo.ids.length) throw new Error(`Algumas empresas não puderam receber a tag.${jaEntraram}`);
  }
  if (plano.gravarResponsavel.length > 0 && pedido.tipo === "responsavel") {
    const { data, error } = await empresasCrm(cliente)
      .update({ responsavel_interno_id: pedido.pessoaId })
      .in("id", plano.gravarResponsavel)
      .select("id");
    if (error) throw new Error(`${traduzirErroDoLote(error.message)}${jaEntraram}`);
    if ((data ?? []).length < plano.gravarResponsavel.length) throw new Error(`Algumas empresas não puderam mudar de responsável.${jaEntraram}`);
  }

  return plano.resumo;
}
