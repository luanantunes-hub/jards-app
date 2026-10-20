// Os dados que o checklist de envio (P4.1) avalia, lidos do banco: o estado da prestação que o motor de
// checagens usa, as verificações abertas, as contas com os extratos, as marcações e os arquivos do checklist, as
// devoluções (P4.4) e as diligências. Era um hook do navegador; agora é uma função só, e a tela e o conector do
// Claude e do ChatGPT leem pelo mesmo caminho: os números de um nunca divergem dos do outro.

import { estadoDaPrestacao, type ClienteDoEstado } from "@/lib/prestacao/checagens/estado";
import type { EstadoDaPrestacao } from "@/lib/prestacao/checagens/catalogo";
import type { ArquivoDoChecklist, ContaDoChecklist, DadosDoChecklist, DevolucaoDoChecklist, MarcacaoDoChecklist } from "@/lib/prestacao/envio";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";

export type DadosDoEnvio = Omit<DadosDoChecklist, "etapa"> & { verificadaEm: string | null; identificador: string | null };

type Importacao = { conta_id: string; periodo_fim: string | null; saldo_final: number | null; created_at: string };

/**
 * Lê os dados do checklist de envio da prestação. Com `estado` já carregado (o conector precisa dele para outras contas),
 * não lê de novo. Erro de leitura volta em `erro`, sem lançar, como a tela sempre tratou.
 */
export async function carregarDadosDoEnvio(
  cliente: ClienteDoEstado,
  prestacaoId: string,
  estadoPronto?: EstadoDaPrestacao,
): Promise<{ dados: DadosDoEnvio | null; erro: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
  const db = cliente as any;
  try {
    const [estado, prestacao, verificacoes, contas, importacoes, marcacoes, arquivos, devolucoes, diligencias] = await Promise.all([
      estadoPronto ?? estadoDaPrestacao(cliente, prestacaoId),
      db.from("prestacoes_contas").select("verificada_em, titulo, identificador_oficial").eq("id", prestacaoId).maybeSingle(),
      db.from("prestacao_verificacoes").select("check_codigo, status").eq("prestacao_id", prestacaoId).eq("status", "aberta"),
      db.from("prestacao_contas_bancarias").select("id, tipo, apelido, banco, conta, data_encerramento").eq("prestacao_id", prestacaoId).order("created_at"),
      db.from("prestacao_extrato_importacoes").select("conta_id, periodo_fim, saldo_final, created_at").eq("prestacao_id", prestacaoId),
      db.from("prestacao_envio_checklist").select("etapa, exercicio, tipo, codigo, situacao, justificativa, marcado_por, updated_at").eq("prestacao_id", prestacaoId),
      db.from("prestacao_envio_arquivos").select("id, etapa, exercicio, codigo, storage_path, nome_arquivo, mime_type, tamanho_bytes, created_at").eq("prestacao_id", prestacaoId).order("created_at"),
      db.from("prestacao_devolucoes").select("motivo, situacao, valor_principal, valor_atualizado, valor_pago, pago_em, storage_path").eq("prestacao_id", prestacaoId),
      db.from("prestacao_diligencias").select("situacao").eq("prestacao_id", prestacaoId),
    ]);
    const falha = prestacao.error ?? verificacoes.error ?? contas.error ?? importacoes.error ?? marcacoes.error ?? arquivos.error ?? devolucoes.error ?? diligencias.error;
    if (falha) return { dados: null, erro: mensagemErroPrestacao(falha, "Não foi possível carregar o checklist de envio") };
    const extratos = (importacoes.data ?? []) as Importacao[];
    return {
      erro: "",
      dados: {
        regime: estado.regime,
        estado,
        verificacoes: verificacoes.data ?? [],
        contas: ((contas.data ?? []) as Omit<ContaDoChecklist, "extratos">[]).map(c => ({
          ...c,
          extratos: extratos.filter(e => e.conta_id === c.id).map(e => ({ ...e, saldo_final: e.saldo_final === null ? null : Number(e.saldo_final) })),
        })),
        marcacoes: (marcacoes.data ?? []) as MarcacaoDoChecklist[],
        arquivos: (arquivos.data ?? []) as ArquivoDoChecklist[],
        devolucoes: (devolucoes.data ?? []) as DevolucaoDoChecklist[],
        diligencias: (diligencias.data ?? []) as { situacao: string }[],
        verificadaEm: prestacao.data?.verificada_em ?? null,
        identificador: prestacao.data?.identificador_oficial || prestacao.data?.titulo || null,
      },
    };
  } catch (e) {
    return { dados: null, erro: mensagemErroPrestacao({ message: e instanceof Error ? e.message : String(e) }, "Não foi possível carregar o checklist de envio") };
  }
}
