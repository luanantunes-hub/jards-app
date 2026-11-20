import { chaveDoNome, mesmoNome, resolverDominio } from "@/lib/dominio";
import {
  CUSTO_DO_DESBLOQUEIO_EM_CREDITOS,
  MAX_EMPRESAS_POR_LOTE,
  buscarBasePublica,
  creditosDisponiveis,
  custoParaVerContatos,
  empresasPublicasPorId,
  type EmpresaPublica,
} from "@/lib/mcp/basePublica";
import { linkDoApp, type Admin, type Linha } from "@/lib/mcp/crm";
import { TIPOS_EMPRESA } from "@/lib/mcp/enums";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { booleano, erroDoBanco, ErroMcp, inteiro, listaDeUuids, opcao, texto, ufDe } from "@/lib/mcp/validacao";

const COLUNAS = "id,nome,setor,site,tipo,cidade,estado,localizacao,empresa_pub_id";
const POR_PAGINA = 1000;

/** Todas as empresas do CRM da organização, para saber quais da base pública já estão lá (por ligação ou por nome). */
async function empresasDoCrm(admin: Admin, orgId: string): Promise<Linha[]> {
  const todas: Linha[] = [];
  for (let pagina = 0; pagina < 10; pagina++) {
    const { data, error } = await admin
      .from("empresas_crm")
      .select(COLUNAS)
      .eq("organization_id", orgId)
      .order("id", { ascending: true })
      .range(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1);
    if (error) throw erroDoBanco(error);
    todas.push(...((data ?? []) as Linha[]));
    if ((data ?? []).length < POR_PAGINA) break;
  }
  return todas;
}

function localizacaoDe(cidade: string | null, estado: string | null): string | null {
  if (cidade && estado) return `${cidade}-${estado}`;
  return cidade ?? estado ?? null;
}

async function contatosLiberados(admin: Admin, orgId: string, empresaId: string) {
  const { data, error } = await admin.rpc("fn_responsaveis_empresa_org", { p_organization_id: orgId, p_empresa_id: empresaId });
  if (error) throw erroDoBanco(error);
  return ((data ?? []) as Linha[]).map((c) => ({ nome: c.nome, cargo: c.cargo, email: c.email, linkedin_url: c.linkedin_url, fonte: c.fonte }));
}

/**
 * Adiciona ao CRM da organização empresas da base pública, em lote (até 50): por empresa_pub_ids ou por filtro
 * (busca, cidade, estado, setor). Quem já está no CRM não é duplicado. Não gasta crédito sozinho: devolve quantos
 * contatos há e o custo de liberá-los; só libera quando o pedido repete com desbloquear_contatos e a confirmação
 * exata do custo (confirmar_custo_creditos).
 */
export const POST = rotaMcp({ escrita: true }, async ({ admin, ctx, orgId, corpo, origem }) => {
  const ids = listaDeUuids(corpo, "empresa_pub_ids", MAX_EMPRESAS_POR_LOTE);
  const filtros = {
    busca: texto(corpo, "busca", { max: 120 }),
    cidade: texto(corpo, "cidade", { max: 120 }),
    estado: ufDe(corpo, "estado"),
    setor: texto(corpo, "setor", { max: 120 }),
  };
  const tipo = opcao(corpo, "tipo", TIPOS_EMPRESA) ?? "prospect";
  const querLiberar = booleano(corpo, "desbloquear_contatos") ?? false;
  const custoConfirmado = inteiro(corpo, "confirmar_custo_creditos", { min: 0 });

  let alvo: EmpresaPublica[];
  let totalNoFiltro: number | null = null;
  let proximoDeslocamento: number | null = null;
  if (ids && ids.length > 0) {
    alvo = await empresasPublicasPorId(admin, orgId, ids);
    const achadas = new Set(alvo.map((empresa) => empresa.id));
    const faltando = ids.filter((id) => !achadas.has(id));
    if (faltando.length > 0) throw new ErroMcp(404, `Estes empresa_pub_ids não existem na base pública: ${faltando.join(", ")}.`);
  } else if (Object.values(filtros).some((valor) => valor !== null)) {
    const limite = inteiro(corpo, "limite", { min: 1, max: MAX_EMPRESAS_POR_LOTE }) ?? 20;
    const deslocamento = inteiro(corpo, "deslocamento", { min: 0 }) ?? 0;
    const busca = await buscarBasePublica(admin, { orgId, ...filtros, limite, deslocamento });
    alvo = busca.empresas;
    totalNoFiltro = busca.total;
    proximoDeslocamento = deslocamento + alvo.length < busca.total ? deslocamento + alvo.length : null;
  } else {
    throw new ErroMcp(400, "Informe empresa_pub_ids ou ao menos um filtro (busca, cidade, estado ou setor): o lote não adiciona a base inteira.");
  }
  if (alvo.length === 0) {
    return resposta({ resumo: { empresas_no_lote: 0, criadas: 0, ja_existiam: 0 }, total_no_filtro: totalNoFiltro, empresas: [], mensagem: "Nenhuma empresa da base pública bate com o pedido." });
  }

  // O custo é calculado e conferido antes de criar qualquer coisa: sem a confirmação certa, nada é gravado nem cobrado.
  const aLiberar = alvo.filter((empresa) => custoParaVerContatos(empresa) > 0);
  const custoTotal = aLiberar.length * CUSTO_DO_DESBLOQUEIO_EM_CREDITOS;
  const saldo = await creditosDisponiveis(admin, orgId);
  if (querLiberar && custoTotal > 0) {
    const detalhe = { custo_total_creditos: custoTotal, creditos_disponiveis: saldo, empresas_a_liberar: aLiberar.map((empresa) => empresa.nome) };
    if (custoConfirmado !== custoTotal) {
      throw new ErroMcp(409, `Liberar os contatos de ${aLiberar.length} empresa(s) custa ${custoTotal} crédito(s) (saldo: ${saldo}). Nada foi criado nem cobrado. Para seguir, repita o pedido com desbloquear_contatos: true e confirmar_custo_creditos: ${custoTotal}.`, detalhe);
    }
    if (saldo < custoTotal) throw new ErroMcp(402, `Créditos insuficientes: liberar custa ${custoTotal} e a organização tem ${saldo}. Nada foi criado nem cobrado. Veja os planos em /meu-plano.`, detalhe);
  }

  // Cria no CRM só quem ainda não está lá: já ligada à mesma empresa pública ou com o mesmo nome.
  const doCrm = await empresasDoCrm(admin, orgId);
  const existenteDe = (empresa: EmpresaPublica) =>
    doCrm.find((linha) => linha.empresa_pub_id === empresa.id) ?? doCrm.find((linha) => !linha.empresa_pub_id && mesmoNome(linha.nome as string, empresa.nome));
  const novas = alvo.filter((empresa) => !existenteDe(empresa));

  const criadas = new Map<string, Linha>();
  if (novas.length > 0) {
    const { data, error } = await admin
      .from("empresas_crm")
      .insert(
        novas.map((empresa) => ({
          organization_id: orgId,
          account_id: ctx.userId,
          nome: empresa.nome,
          nome_key: chaveDoNome(empresa.nome),
          tipo,
          setor: empresa.setor,
          site: empresa.site,
          domain_key: resolverDominio(empresa.site),
          cidade: empresa.cidade,
          estado: empresa.estado,
          localizacao: localizacaoDe(empresa.cidade, empresa.estado),
          empresa_pub_id: empresa.id,
        }))
      )
      .select(COLUNAS);
    if (error) throw erroDoBanco(error);
    for (const linha of (data ?? []) as Linha[]) criadas.set(linha.empresa_pub_id as string, linha);
  }

  // Libera os contatos (1 crédito cada, só na primeira vez da organização) e para no primeiro erro, sem esconder o que já foi feito.
  const liberadasAgora = new Set<string>();
  let falhaNaLiberacao: { empresa: string; erro: string } | null = null;
  if (querLiberar) {
    for (const empresa of aLiberar) {
      const { error } = await admin.rpc("fn_desbloquear_empresa_as", { p_user_id: ctx.userId, p_organization_id: orgId, p_empresa_id: empresa.id });
      if (error) {
        falhaNaLiberacao = { empresa: empresa.nome, erro: error.message };
        break;
      }
      liberadasAgora.add(empresa.id);
    }
  }

  const empresas = [];
  for (const empresa of alvo) {
    const crm = criadas.get(empresa.id) ?? existenteDe(empresa);
    const liberada = empresa.contatos_liberados || liberadasAgora.has(empresa.id);
    empresas.push({
      empresa_crm_id: crm?.id as string,
      nome: empresa.nome,
      cidade: empresa.cidade,
      estado: empresa.estado,
      setor: empresa.setor,
      ja_existia: !criadas.has(empresa.id),
      url: crm ? linkDoApp(origem, "empresa", crm.id as string) : null,
      contatos_disponiveis: empresa.contatos_disponiveis,
      contatos_liberados: liberada,
      custo_para_ver_contatos: liberada ? 0 : custoParaVerContatos(empresa),
      ...(querLiberar && liberada && empresa.contatos_disponiveis > 0 ? { contatos: await contatosLiberados(admin, orgId, empresa.id) } : {}),
    });
  }

  const pendentes = aLiberar.filter((empresa) => !liberadasAgora.has(empresa.id));
  const custoPendente = pendentes.length * CUSTO_DO_DESBLOQUEIO_EM_CREDITOS;
  const saldoDepois = liberadasAgora.size > 0 ? await creditosDisponiveis(admin, orgId) : saldo;
  return resposta(
    {
      resumo: {
        empresas_no_lote: alvo.length,
        criadas: criadas.size,
        ja_existiam: alvo.length - criadas.size,
        contatos: {
          empresas_com_contatos: alvo.filter((empresa) => empresa.contatos_disponiveis > 0).length,
          liberados_agora: liberadasAgora.size,
          ainda_bloqueados: pendentes.length,
          custo_para_liberar_creditos: custoPendente,
          creditos_disponiveis: saldoDepois,
        },
      },
      ...(custoPendente > 0 && !falhaNaLiberacao
        ? {
            oferta_de_contatos: `Liberar os contatos de ${pendentes.length} empresa(s) custa ${custoPendente} crédito(s) (saldo: ${saldoDepois}). Para liberar, repita este pedido com desbloquear_contatos: true e confirmar_custo_creditos: ${custoPendente} — só depois de a pessoa concordar com o gasto.`,
          }
        : {}),
      ...(falhaNaLiberacao
        ? {
            falha_na_liberacao: falhaNaLiberacao,
            mensagem: "A liberação parou numa empresa; o que já foi feito está acima. Repita o mesmo pedido para concluir o resto: ninguém é criado nem cobrado em dobro.",
          }
        : {}),
      total_no_filtro: totalNoFiltro,
      proximo_deslocamento: proximoDeslocamento,
      empresas,
    },
    // Parada no meio: não é sucesso, para a chave de idempotência não guardar um resultado pela metade.
    falhaNaLiberacao ? 502 : criadas.size > 0 ? 201 : 200
  );
});
