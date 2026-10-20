import { afterEach } from "node:test";
import { NextRequest } from "next/server";
import type { McpAuthContext } from "../../lib/mcp/auth";
import { acessoDaPrestacao } from "../../lib/mcp/prestacao/acesso";
import { dependenciasDaRota } from "../../lib/mcp/rota";
import type { NoOrcamento } from "../../lib/prestacao/orcamento";
import { ROUANET_IN29_2026 } from "../../lib/prestacao/regimes/rouanet-in29-2026";
import { bancoFalso, type Consulta, type Resolvedor } from "./banco-falso";

/**
 * Cenário compartilhado pelos testes das rotas da prestação: uma organização com uma prestação (Rouanet) de orçamento
 * pequeno, outra organização com outra prestação, e a autenticação e o banco das rotas trocados por versões de mentira.
 */

// Cada teste troca a autenticação e o banco das rotas; ao fim de cada um, os de verdade voltam.
const originais = { ...dependenciasDaRota };
afterEach(() => Object.assign(dependenciasDaRota, originais));

export const ORG = "5c1b0f0e-0000-4000-8000-0000000000a1";
export const OUTRA_ORG = "5c1b0f0e-0000-4000-8000-0000000000b2";
export const USUARIO = "5c1b0f0e-0000-4000-8000-000000000002";
export const PRESTACAO = "5c1b0f0e-0000-4000-8000-0000000000d1";
export const DE_OUTRA_ORG = "5c1b0f0e-0000-4000-8000-0000000000d9";
export const REGIME = "5c1b0f0e-0000-4000-8000-0000000000e1";
export const VERSAO = "5c1b0f0e-0000-4000-8000-0000000000c0";
export const GRUPO = "5c1b0f0e-0000-4000-8000-0000000000c1";
export const ITEM_A = "5c1b0f0e-0000-4000-8000-0000000000c2";
export const ITEM_B = "5c1b0f0e-0000-4000-8000-0000000000c3";
export const DESPESA_1 = "5c1b0f0e-0000-4000-8000-0000000000f1";
export const DESPESA_2 = "5c1b0f0e-0000-4000-8000-0000000000f2";
export const FORNECEDOR = "5c1b0f0e-0000-4000-8000-0000000000aa";
export const ORIGEM = "https://app.jards.test";

const no = (parcial: Partial<NoOrcamento> & Pick<NoOrcamento, "id" | "nome" | "tipo">): NoOrcamento => ({
  versao_id: VERSAO,
  parent_id: null,
  codigo: null,
  descricao: null,
  uf: null,
  municipio: null,
  grupo_custo: null,
  unidade: null,
  quantidade: null,
  ocorrencias: null,
  valor_unitario: null,
  valor_total: 0,
  valor_remanejado: 0,
  ordem: 0,
  ...parcial,
});

/** Um agrupador (meta) com dois itens: R$ 10.000 e R$ 5.000. */
export const NOS: NoOrcamento[] = [
  no({ id: GRUPO, nome: "Meta 1: oficinas", tipo: "meta" as NoOrcamento["tipo"], grupo_custo: "execucao" }),
  no({ id: ITEM_A, nome: "Oficineiros", tipo: "item", parent_id: GRUPO, valor_total: 10_000, ordem: 1, quantidade: 10, ocorrencias: 1, valor_unitario: 1000, unidade: "oficina" }),
  no({ id: ITEM_B, nome: "Material", tipo: "item", parent_id: GRUPO, valor_total: 5_000, ordem: 2 }),
];

export const linhaDaPrestacao = (organization_id: string, id: string) => ({
  id,
  organization_id,
  titulo: "Festival de Inverno",
  status: "rascunho",
  prazo: "2099-03-31",
  prazo_final: "2099-03-31",
  prazo_final_override: null,
  prazo_final_justificativa: null,
  valor_aprovado: "15000.00",
  valor_realizado: null,
  regime_id: REGIME,
  identificador_oficial: "PRONAC 261234",
  identificador_tipo: "pronac",
  fonte_recurso: null,
  numero_processo: null,
  data_aprovacao: "2026-01-10",
  data_liberacao: null,
  data_termo: null,
  data_inicio_execucao: "2026-03-01",
  data_fim_execucao: "2026-12-31",
  data_conclusao_objeto: null,
  data_envio: null,
  data_fim_captacao: null,
  verificada_em: null,
  created_at: "2026-02-01T10:00:00Z",
  updated_at: "2026-10-18T10:00:00Z",
  obra_grupo: null,
  manifestacao_esportiva: null,
  crc_validade: null,
  modalidade_saude: null,
  captacao: { id: "c1", titulo: "Captação 2026", lei: "rouanet", valor_solicitado: 15000 },
  projeto: { id: "p1", nome: "Festival de Inverno 2026" },
  proponente: { id: "pr1", nome: "Instituto A" },
});

export const filtroDe = (c: Consulta, coluna: string) => c.filtros.find(([op, col]) => op === "eq" && col === coluna)?.[2];

export interface Cenario {
  /** Prestações existentes: id → organização dona. */
  prestacoes?: Record<string, string>;
  escopo?: "read" | "write";
  /** Papel da pessoa na organização (padrão: colaborador). */
  papel?: string;
  /** O módulo está em vigor na organização (padrão: sim); falso = só para consulta. */
  emVigor?: boolean;
  /** O que o banco responde a fn_mcp_prestacao_pode (padrão: sim, a pessoa edita). */
  podeEditarNoBanco?: boolean;
  /** Qual assistente fez o pedido (padrão: claude). */
  plataforma?: "claude" | "chatgpt" | "outro";
}

/** O Storage de mentira: o que cada teste quer devolver, e o registro das chamadas em `chamadas`. */
export interface BucketFalso {
  list?: (pasta: string, opcoes: unknown) => { data: unknown[]; error: null };
  download?: (caminho: string) => { data: Blob | null; error: { message: string } | null };
  upload?: (caminho: string, conteudo: unknown, opcoes: unknown) => { data: unknown; error: { message: string } | null };
  assinar?: (caminho: string) => { data: { signedUrl: string; token: string; path: string } | null; error: { message: string } | null };
}
export interface ChamadaDoStorage {
  acao: string;
  argumentos: unknown[];
}

/**
 * Troca a autenticação, o banco e o Storage das rotas pelas versões de mentira deste cenário. Devolve o registro das
 * consultas e das chamadas ao Storage. Por padrão a pessoa pode editar (fn_mcp_prestacao_pode), nada está travado e os avisos funcionam.
 */
export function prepararComStorage(cenario: Cenario = {}, extra: Resolvedor = () => undefined, bucket: BucketFalso = {}) {
  const prestacoes = cenario.prestacoes ?? { [PRESTACAO]: ORG, [DE_OUTRA_ORG]: OUTRA_ORG };
  const { admin, consultas } = bancoFalso((c) => {
    const personalizada = extra(c);
    if (personalizada !== undefined) return personalizada;
    if (c.tabela === "prestacoes_contas") {
      const id = String(filtroDe(c, "id") ?? "");
      const dona = prestacoes[id];
      if (!dona) return undefined;
      // A leitura por id do conector sempre vem com o filtro da organização; a do motor de checagens (service role) vem só pelo id.
      const org = filtroDe(c, "organization_id");
      if (org !== undefined && org !== dona) return undefined;
      return { data: linhaDaPrestacao(dona, id) };
    }
    if (c.tabela === "prestacao_regimes") return { data: { id: REGIME, codigo: "rouanet_in29_2026", nome: "Rouanet (IN 29/2026)", parametros: ROUANET_IN29_2026 } };
    if (c.tabela === "prestacao_orcamento_versoes") return { data: { id: VERSAO, nome: "Orçamento aprovado", tipo: "aprovado", ato: "Portaria 1", data_ato: "2026-01-10" } };
    if (c.tabela === "prestacao_orcamento_nos") return { data: NOS };
    if (c.tabela === "fn_mcp_prestacao_pode") return { data: cenario.podeEditarNoBanco ?? true };
    return undefined;
  });

  const chamadas: ChamadaDoStorage[] = [];
  const registrar = <T,>(acao: string, argumentos: unknown[], resultado: T): T => {
    chamadas.push({ acao, argumentos });
    return resultado;
  };
  const armazenamento = {
    from: (nome: string) => {
      if (nome !== "documentos") throw new Error(`bucket inesperado: ${nome}`);
      return {
        list: async (pasta: string, opcoes: unknown) => registrar("list", [pasta, opcoes], bucket.list?.(pasta, opcoes) ?? { data: [], error: null }),
        remove: async (caminhos: string[]) => registrar("remove", [caminhos], { data: [], error: null }),
        download: async (caminho: string) => registrar("download", [caminho], bucket.download?.(caminho) ?? { data: null, error: { message: "Object not found" } }),
        upload: async (caminho: string, conteudo: unknown, opcoes: unknown) => registrar("upload", [caminho, conteudo, opcoes], bucket.upload?.(caminho, conteudo, opcoes) ?? { data: { path: caminho }, error: null }),
        createSignedUploadUrl: async (caminho: string) =>
          registrar(
            "createSignedUploadUrl",
            [caminho],
            bucket.assinar?.(caminho) ?? {
              data: { signedUrl: `https://projeto.supabase.co/storage/v1/object/upload/sign/documentos/${caminho}?token=t0k3n`, token: "t0k3n", path: caminho },
              error: null,
            }
          ),
      };
    },
  };

  const emVigor = cenario.emVigor ?? true;
  const contexto: McpAuthContext = {
    userId: USUARIO,
    chaveId: "5c1b0f0e-0000-4000-8000-0000000000c9",
    plataforma: cenario.plataforma ?? "claude",
    organizationIds: [],
    paidOrganizationIds: [],
    scope: cenario.escopo ?? "read",
    modulos: ["prestacao"],
    prestacao: acessoDaPrestacao(
      [{ organization_id: ORG, papel: cenario.papel ?? "colaborador", modulos_acesso: ["prestacao"], prestacao_funcao: null }],
      [{ id: ORG, nome: "Instituto A", modulos_ativos: emVigor ? ["prestacao"] : [], modulos_leitura: emVigor ? [] : ["prestacao"] }]
    ),
  };
  dependenciasDaRota.autenticar = async () => contexto;
  dependenciasDaRota.criarAdmin = () => ({ ...(admin as object), storage: armazenamento }) as never;
  return { consultas, chamadas };
}

/** Como prepararComStorage, só com o registro das consultas (os testes que não olham o Storage). */
export const prepararPrestacao = (cenario: Cenario = {}, extra: Resolvedor = () => undefined) => prepararComStorage(cenario, extra).consultas;

export const pedido = (caminho: string, opcoes: { metodo?: "GET" | "POST"; corpo?: unknown } = {}) =>
  new NextRequest(`${ORIGEM}/api/mcp${caminho}`, {
    method: opcoes.metodo ?? "GET",
    headers: { authorization: "Bearer teste", "content-type": "application/json" },
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  });

export const comId = (id: string) => ({ params: Promise.resolve({ id }) });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = Record<string, any>;
export async function ler(resposta: Response): Promise<{ status: number; corpo: Json }> {
  return { status: resposta.status, corpo: (await resposta.json()) as Json };
}
export const daTabela = (consultas: readonly Consulta[], tabela: string) => consultas.filter((c) => c.tabela === tabela);
