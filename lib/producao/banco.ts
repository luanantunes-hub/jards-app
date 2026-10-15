// O tipo do banco só da produção (plano do módulo, PD0.11).
//
// O `Database` do app (lib/supabase/types.ts) não conhece as tabelas da produção, e a
// produção não pode nascer com `any` nem com um `as` em cada consulta. Este arquivo
// descreve só o que a produção tem no banco, no formato que o @supabase/supabase-js
// espera de um `Database`. O cliente criado com ele (cliente.ts) faz o compilador
// acusar tabela, coluna, valor de lista fechada e função que não existem (a única
// exceção, o texto do `select`, está explicada em cliente.ts).
//
// ─── Formato ────────────────────────────────────────────────────────────────
// Row é o que o banco devolve; Insert é o que se manda para inserir (coluna anulável
// ou com padrão é opcional); Update é tudo opcional. São `type` e não `interface`: a
// interface não passa como `Record<string, unknown>`, e o cliente trataria a tabela
// como inválida. Cada coluna aparece nas três.
//
// ─── De onde vêm os dados ───────────────────────────────────────────────────
// As colunas, a anulabilidade e os padrões são os das migrations da produção
// (supabase/migrations), conferidos contra o banco real em 15/10/2026.
// tests/producao-banco-tipos.test.ts compara este arquivo com elas: uma migration
// que muda tabela, coluna, chave ou função da produção faz o teste falhar até este
// arquivo ser atualizado. Para atualizar: escreva a migration, acrescente a coluna em
// Row, Insert e Update (e a chave em Relationships) e rode o teste, que diz o que falta.
//
// ─── Onde difere do que o conector gera (supabase gen types) ────────────────
// - As listas fechadas do banco (CHECK) usam os tipos de estados.ts, em vez de
//   `string`. O tipo da data vem de vocabulario.ts, onde o tipo mora. O `escopo` de
//   producao_funcoes ainda não tem tipo em estados.ts, e a união está escrita aqui
//   (EscopoDaProducao). Tipo e formato do catálogo (obra, temporada, bloco, espaço)
//   seguem `string`: o banco só confere a forma, para um tipo novo não pedir migration.
// - Functions traz só o que o navegador executa (`grant execute ... to authenticated`).
//   A ficha da pessoa (auth_producao_ficha) e os gatilhos são internos.
// - Nulo onde a função o aceita, que o gerador não sabe: `p_alcada` (nula = a pessoa não
//   aprova) e o id dos três recortes (`p_temporada_id`, `p_espaco_id`, `p_obra_id`): com
//   nulo, a função responde só se a pessoa tem recorte (é assim que auth_producao_ve_obra
//   pergunta à temporada).
// - Relationships não lista as chaves para auth.users (`definido_por` e `quem`): o
//   PostgREST só expõe o schema public, e o gerador também as omite.
//
// ─── O que não está aqui ────────────────────────────────────────────────────
// organizations, empresas_crm, projetos_crm e organization_members aparecem só como
// destino das chaves em Relationships. Para ler essas tabelas, use o cliente comum do
// app (lib/supabase/client.ts ou server.ts): embuti-las numa consulta da produção
// não é tipado.

import type {
  AcaoDoHistorico,
  ExibicaoDoBloco,
  LadoDaTemporada,
  SituacaoDaData,
  SituacaoDaTemporada,
} from "@/lib/producao/estados";
import type { TipoData } from "@/lib/producao/vocabulario";

/** `producao_funcoes.escopo`: a organização inteira, ou só as temporadas e os espaços em que a pessoa está vinculada. */
export type EscopoDaProducao = "organizacao" | "vinculado";

export type BancoDaProducao = {
  // A versão do PostgREST do projeto: o cliente liga os recursos dela (supabase gen types, 15/10/2026).
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      producao_obras: {
        Row: {
          id: string;
          organization_id: string;
          projeto_id: string | null;
          tipo: string;
          titulo: string;
          descricao: string | null;
          duracao_min: number | null;
          classificacao: string | null;
          icone: string | null;
          cor: string | null;
          companhia_empresa_id: string | null;
          companhia_nome: string | null;
          arquivada: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          projeto_id?: string | null;
          tipo: string;
          titulo: string;
          descricao?: string | null;
          duracao_min?: number | null;
          classificacao?: string | null;
          icone?: string | null;
          cor?: string | null;
          companhia_empresa_id?: string | null;
          companhia_nome?: string | null;
          arquivada?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          projeto_id?: string | null;
          tipo?: string;
          titulo?: string;
          descricao?: string | null;
          duracao_min?: number | null;
          classificacao?: string | null;
          icone?: string | null;
          cor?: string | null;
          companhia_empresa_id?: string | null;
          companhia_nome?: string | null;
          arquivada?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_obras_companhia_empresa_id_fkey";
            columns: ["companhia_empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas_crm";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_obras_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_obras_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos_crm";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_temporadas: {
        Row: {
          id: string;
          organization_id: string;
          projeto_id: string | null;
          obra_id: string | null;
          formato: string;
          lado: LadoDaTemporada;
          tipo: string;
          titulo: string;
          inicio: string | null;
          fim: string | null;
          situacao: SituacaoDaTemporada;
          responsavel_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          projeto_id?: string | null;
          obra_id?: string | null;
          formato: string;
          lado: LadoDaTemporada;
          tipo: string;
          titulo: string;
          inicio?: string | null;
          fim?: string | null;
          situacao?: SituacaoDaTemporada;
          responsavel_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          projeto_id?: string | null;
          obra_id?: string | null;
          formato?: string;
          lado?: LadoDaTemporada;
          tipo?: string;
          titulo?: string;
          inicio?: string | null;
          fim?: string | null;
          situacao?: SituacaoDaTemporada;
          responsavel_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_temporadas_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "producao_obras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_temporadas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_temporadas_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos_crm";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_temporadas_responsavel_fkey";
            columns: ["organization_id", "responsavel_id"];
            isOneToOne: false;
            referencedRelation: "organization_members";
            referencedColumns: ["organization_id", "user_id"];
          },
        ];
      };
      producao_datas: {
        Row: {
          id: string;
          organization_id: string;
          temporada_id: string;
          obra_id: string | null;
          tipo: TipoData;
          data: string;
          data_fim: string | null;
          situacao: SituacaoDaData;
          opcao_ordem: number | null;
          opcao_ate: string | null;
          espaco_id: string | null;
          sala_id: string | null;
          uf: string | null;
          municipio_ibge: string | null;
          fuso: string;
          contratante_empresa_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          temporada_id: string;
          obra_id?: string | null;
          tipo?: TipoData;
          data: string;
          data_fim?: string | null;
          situacao?: SituacaoDaData;
          opcao_ordem?: number | null;
          opcao_ate?: string | null;
          espaco_id?: string | null;
          sala_id?: string | null;
          uf?: string | null;
          municipio_ibge?: string | null;
          fuso?: string;
          contratante_empresa_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          temporada_id?: string;
          obra_id?: string | null;
          tipo?: TipoData;
          data?: string;
          data_fim?: string | null;
          situacao?: SituacaoDaData;
          opcao_ordem?: number | null;
          opcao_ate?: string | null;
          espaco_id?: string | null;
          sala_id?: string | null;
          uf?: string | null;
          municipio_ibge?: string | null;
          fuso?: string;
          contratante_empresa_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_datas_contratante_empresa_id_fkey";
            columns: ["contratante_empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas_crm";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_datas_espaco_id_fkey";
            columns: ["espaco_id"];
            isOneToOne: false;
            referencedRelation: "producao_espacos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_datas_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "producao_obras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_datas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_datas_sala_id_fkey";
            columns: ["sala_id"];
            isOneToOne: false;
            referencedRelation: "producao_salas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_datas_temporada_id_fkey";
            columns: ["temporada_id"];
            isOneToOne: false;
            referencedRelation: "producao_temporadas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_blocos: {
        Row: {
          id: string;
          organization_id: string;
          data_id: string;
          dia: string;
          inicio: string | null;
          fim: string | null;
          exibicao: ExibicaoDoBloco;
          tipo: string;
          titulo: string | null;
          sala_id: string | null;
          confirmado: boolean;
          visivel_para: string[] | null;
          capacidade: number | null;
          ordem: number;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          data_id: string;
          dia: string;
          inicio?: string | null;
          fim?: string | null;
          exibicao?: ExibicaoDoBloco;
          tipo: string;
          titulo?: string | null;
          sala_id?: string | null;
          confirmado?: boolean;
          visivel_para?: string[] | null;
          capacidade?: number | null;
          ordem?: number;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          data_id?: string;
          dia?: string;
          inicio?: string | null;
          fim?: string | null;
          exibicao?: ExibicaoDoBloco;
          tipo?: string;
          titulo?: string | null;
          sala_id?: string | null;
          confirmado?: boolean;
          visivel_para?: string[] | null;
          capacidade?: number | null;
          ordem?: number;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_blocos_data_id_fkey";
            columns: ["data_id"];
            isOneToOne: false;
            referencedRelation: "producao_datas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_blocos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_blocos_sala_id_fkey";
            columns: ["sala_id"];
            isOneToOne: false;
            referencedRelation: "producao_salas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_espacos: {
        Row: {
          id: string;
          organization_id: string;
          nome: string;
          tipo: string;
          proprio: boolean;
          movel: boolean;
          empresa_id: string | null;
          endereco: string | null;
          uf: string | null;
          municipio_ibge: string | null;
          latitude: number | null;
          longitude: number | null;
          capacidade: number | null;
          arquivado: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nome: string;
          tipo: string;
          proprio?: boolean;
          movel?: boolean;
          empresa_id?: string | null;
          endereco?: string | null;
          uf?: string | null;
          municipio_ibge?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          capacidade?: number | null;
          arquivado?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          nome?: string;
          tipo?: string;
          proprio?: boolean;
          movel?: boolean;
          empresa_id?: string | null;
          endereco?: string | null;
          uf?: string | null;
          municipio_ibge?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          capacidade?: number | null;
          arquivado?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_espacos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas_crm";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_espacos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_salas: {
        Row: {
          id: string;
          organization_id: string;
          espaco_id: string;
          nome: string;
          capacidade: number | null;
          arquivada: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          espaco_id: string;
          nome: string;
          capacidade?: number | null;
          arquivada?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          espaco_id?: string;
          nome?: string;
          capacidade?: number | null;
          arquivada?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_salas_espaco_id_fkey";
            columns: ["espaco_id"];
            isOneToOne: false;
            referencedRelation: "producao_espacos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_salas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_historico: {
        Row: {
          id: number;
          organization_id: string;
          entidade: string;
          entidade_id: string;
          acao: AcaoDoHistorico;
          campo: string | null;
          antes: string | null;
          depois: string | null;
          quem: string | null;
          quando: string;
        };
        // O id é gerado pelo banco (identity always): nunca se manda. Quem grava é o gatilho.
        Insert: {
          id?: never;
          organization_id: string;
          entidade: string;
          entidade_id: string;
          acao: AcaoDoHistorico;
          campo?: string | null;
          antes?: string | null;
          depois?: string | null;
          quem?: string | null;
          quando?: string;
        };
        Update: {
          id?: never;
          organization_id?: string;
          entidade?: string;
          entidade_id?: string;
          acao?: AcaoDoHistorico;
          campo?: string | null;
          antes?: string | null;
          depois?: string | null;
          quem?: string | null;
          quando?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_historico_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_funcoes: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          dinheiro: boolean;
          alcada: number | null;
          escopo: EscopoDaProducao;
          definido_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          dinheiro?: boolean;
          alcada?: number | null;
          escopo?: EscopoDaProducao;
          definido_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          dinheiro?: boolean;
          alcada?: number | null;
          escopo?: EscopoDaProducao;
          definido_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_funcoes_membro_fkey";
            columns: ["organization_id", "user_id"];
            isOneToOne: true;
            referencedRelation: "organization_members";
            referencedColumns: ["organization_id", "user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      auth_producao_dinheiro_sem_assinatura: {
        Args: { p_org: string };
        Returns: boolean;
      };
      auth_producao_le_sem_assinatura: {
        Args: { p_org: string };
        Returns: boolean;
      };
      auth_producao_papel_permite: {
        Args: { p_papel: string; p_dinheiro: boolean; p_alcada: number | null; p_acao: string };
        Returns: boolean;
      };
      auth_producao_pode: {
        Args: { p_org: string; p_acao: string };
        Returns: boolean;
      };
      auth_producao_ve_espaco: {
        Args: { p_org: string; p_espaco_id: string | null };
        Returns: boolean;
      };
      auth_producao_ve_historico: {
        Args: { p_org: string; p_entidade: string; p_entidade_id: string };
        Returns: boolean;
      };
      auth_producao_ve_obra: {
        Args: { p_org: string; p_obra_id: string | null };
        Returns: boolean;
      };
      auth_producao_ve_temporada: {
        Args: { p_org: string; p_temporada_id: string | null };
        Returns: boolean;
      };
      fn_producao_definir_funcao: {
        Args: { p_org: string; p_user: string; p_dinheiro: boolean; p_alcada: number | null; p_escopo: EscopoDaProducao };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type Tabelas = BancoDaProducao["public"]["Tables"];

/** O nome de uma tabela da produção. */
export type NomeDaTabela = keyof Tabelas;
/** A linha como o banco a devolve. */
export type Linha<T extends NomeDaTabela> = Tabelas[T]["Row"];
/** O que se manda para inserir: o que é anulável ou tem padrão é opcional. */
export type NovaLinha<T extends NomeDaTabela> = Tabelas[T]["Insert"];
/** O que se manda para alterar: tudo é opcional. */
export type Alteracao<T extends NomeDaTabela> = Tabelas[T]["Update"];
