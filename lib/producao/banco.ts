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
// (supabase/migrations), conferidos contra o banco real em 15/10/2026. A tabela
// producao_arquivos e as três funções dos arquivos (PD0.14) foram escritas a partir das
// migrations antes de elas serem aplicadas: conferir com o gerador depois de aplicá-las. As
// quatro tabelas da equipe e auth_producao_ve_pessoa (PD1.9) também, a partir de
// *_producao_equipe.sql, aplicada sem mudança em 30/10/2026.
// tests/producao-banco-tipos.test.ts compara este arquivo com elas: uma migration
// que muda tabela, coluna, chave ou função da produção faz o teste falhar até este
// arquivo ser atualizado. Para atualizar: escreva a migration, acrescente a coluna em
// Row, Insert e Update (e a chave em Relationships) e rode o teste, que diz o que falta.
//
// ─── Onde difere do que o conector gera (supabase gen types) ────────────────
// - As listas fechadas do banco (CHECK) usam os tipos de estados.ts, em vez de
//   `string`. O tipo da data vem de vocabulario.ts, onde o tipo mora, e o da pasta de
//   producao_arquivos (PastaDeArquivo) vem da função de borda que escreve o caminho
//   dos arquivos (supabase/functions/_shared/producao-caminho.ts, sem imports). O
//   `escopo` de producao_funcoes ainda não tem tipo em estados.ts, e a união está
//   escrita aqui (EscopoDaProducao). Tipo e formato do catálogo (obra, temporada, bloco, espaço)
//   seguem `string`: o banco só confere a forma, para um tipo novo não pedir migration.
// - Functions traz só o que o navegador executa (`grant execute ... to authenticated`).
//   A ficha da pessoa (auth_producao_ficha) e os gatilhos são internos.
// - Nulo onde a função o aceita, que o gerador não sabe: `p_alcada` (nula = a pessoa não
//   aprova) e o id dos três recortes (`p_temporada_id`, `p_espaco_id`, `p_obra_id`): com
//   nulo, a função responde só se a pessoa tem recorte (é assim que auth_producao_ve_obra
//   pergunta à temporada).
// - Relationships não lista as chaves para auth.users (`definido_por`, `quem` e
//   `enviado_por`): o PostgREST só expõe o schema public, e o gerador também as omite.
//
// ─── O que não está aqui ────────────────────────────────────────────────────
// organizations, empresas_crm, projetos_crm e organization_members aparecem só como
// destino das chaves em Relationships. Para ler essas tabelas, use o cliente comum do
// app (lib/supabase/client.ts ou server.ts): embuti-las numa consulta da produção
// não é tipado.

import type {
  AcaoDoHistorico,
  ConfirmacaoDaEscala,
  ExibicaoDoBloco,
  LadoDaTemporada,
  SituacaoDaData,
  SituacaoDaTemporada,
  CategoriaDoItem,
  DonoDoItem,
  SituacaoDaPauta,
  FaseDeEnergia,
  EstadoDoEquipamento,
  SecaoDoRider,
  TipoDeManutencao,
  TipoDeObjetoDaPlanta,
  TipoDePlanta,
  SituacaoDaTarefa,
  SituacaoDaLicenca,
  LadoDoAcerto,
  TipoDeCampoDoAcerto,
  VisibilidadeDoAcerto,
  DestinoDoAcerto,
  SituacaoDoAcerto,
  SituacaoDoSite,
  SituacaoDoDominio,
  SituacaoDoItemDoAcerto,
  TipoDeLicenca,
  SituacaoDoVinculo,
  TipoDeCartaoDoDia, CategoriaDoVeiculo, CombustivelDoVeiculo, ContratacaoDoVeiculo, TipoDeDocumentoDoVeiculo, TipoDeDeslocamento, SituacaoDoVoluntario, SituacaoDoConvidado, SituacaoDoPedido, SituacaoDaFatura, TipoDeAcordo, SentidoDoAcordo, SituacaoDoAcordo, SituacaoDoOrcamento, CategoriaDoOrcamento, PapelNoAcerto, FormaDoAcerto, SituacaoDoAcertoDoBordero, SituacaoDoBordero, FormaDaDeducao, PosicaoNaExposicao, LuzDaObra, CategoriaDaCota, SituacaoDaTurma, SituacaoDaMatricula, SituacaoDoAgendamento, TipoDeAcessibilidade, SituacaoDaAcessibilidade, ResultadoDaLeitura, TipoDeOcorrencia, GravidadeDaOcorrencia, TipoDoItemDoChecklist, SituacaoDaConferencia, RespostaDoConvite } from "@/lib/producao/estados";
import type { TipoData } from "@/lib/producao/vocabulario";
import type { PastaDeArquivo } from "@/supabase/functions/_shared/producao-caminho";

/** `producao_funcoes.escopo`: a organização inteira, ou só as temporadas e os espaços em que a pessoa está vinculada. */
export type EscopoDaProducao = "organizacao" | "vinculado";

/** Uma coluna jsonb (os blocos de `producao_modelos_dia`). */
export type Json = string | number | boolean | null | { [chave: string]: Json } | Json[];

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
          iniciado_em: string | null;
          terminado_em: string | null;
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
          iniciado_em?: string | null;
          terminado_em?: string | null;
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
          iniciado_em?: string | null;
          terminado_em?: string | null;
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
      producao_acessos_equipe: {
        Row: {
          id: string;
          organization_id: string;
          pessoa_id: string;
          email: string;
          user_id: string | null;
          convidado_por: string | null;
          aceito_em: string | null;
          revogado_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          pessoa_id: string;
          email: string;
          user_id?: string | null;
          convidado_por?: string | null;
          aceito_em?: string | null;
          revogado_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          pessoa_id?: string;
          email?: string;
          user_id?: string | null;
          convidado_por?: string | null;
          aceito_em?: string | null;
          revogado_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_acessos_equipe_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_acessos_equipe_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: true;
            referencedRelation: "producao_pessoas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_acessibilidade: {
        Row: {
          id: string;
          organization_id: string;
          sessao_id: string;
          tipo: TipoDeAcessibilidade;
          situacao: SituacaoDaAcessibilidade;
          pessoa_id: string | null;
          lugares: number | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          sessao_id: string;
          tipo: TipoDeAcessibilidade;
          situacao?: SituacaoDaAcessibilidade;
          pessoa_id?: string | null;
          lugares?: number | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          sessao_id?: string;
          tipo?: TipoDeAcessibilidade;
          situacao?: SituacaoDaAcessibilidade;
          pessoa_id?: string | null;
          lugares?: number | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_acessibilidade_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_acessibilidade_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "producao_pessoas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_acessibilidade_sessao_id_fkey";
            columns: ["sessao_id"];
            isOneToOne: false;
            referencedRelation: "producao_sessoes";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_arquivos: {
        Row: {
          id: string;
          organization_id: string;
          temporada_id: string;
          data_id: string | null;
          pasta: PastaDeArquivo;
          storage_path: string;
          nome: string;
          tipo: string;
          tamanho: number;
          sha256: string;
          enviado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        // Quem está logado altera só `nome` e `data_id` (privilégio por coluna); o gatilho recusa o resto.
        // `enviado_por` é quem está logado (o padrão é auth.uid(), e o gatilho recusa outro valor).
        Insert: {
          id?: string;
          organization_id: string;
          temporada_id: string;
          data_id?: string | null;
          pasta: PastaDeArquivo;
          storage_path: string;
          nome: string;
          tipo: string;
          tamanho: number;
          sha256: string;
          enviado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          temporada_id?: string;
          data_id?: string | null;
          pasta?: PastaDeArquivo;
          storage_path?: string;
          nome?: string;
          tipo?: string;
          tamanho?: number;
          sha256?: string;
          enviado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_arquivos_data_id_fkey";
            columns: ["data_id"];
            isOneToOne: false;
            referencedRelation: "producao_datas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_arquivos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_arquivos_temporada_id_fkey";
            columns: ["temporada_id"];
            isOneToOne: false;
            referencedRelation: "producao_temporadas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_cartoes_dia: {
        Row: {
          id: string;
          organization_id: string;
          data_id: string;
          tipo: TipoDeCartaoDoDia;
          titulo: string | null;
          inicio: string | null;
          fim: string | null;
          endereco: string | null;
          localizador: string | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          data_id: string;
          tipo: TipoDeCartaoDoDia;
          titulo?: string | null;
          inicio?: string | null;
          fim?: string | null;
          endereco?: string | null;
          localizador?: string | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          data_id?: string;
          tipo?: TipoDeCartaoDoDia;
          titulo?: string | null;
          inicio?: string | null;
          fim?: string | null;
          endereco?: string | null;
          localizador?: string | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_cartoes_dia_data_id_fkey";
            columns: ["data_id"];
            isOneToOne: false;
            referencedRelation: "producao_datas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_cartoes_dia_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_modelos_dia: {
        Row: {
          id: string;
          organization_id: string;
          nome: string;
          blocos: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nome: string;
          blocos: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          nome?: string;
          blocos?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_modelos_dia_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_pautas: {
        Row: {
          id: string;
          organization_id: string;
          sala_id: string;
          titulo: string;
          contratante: string | null;
          inicio: string;
          fim: string;
          situacao: SituacaoDaPauta;
          ordem_na_fila: number | null;
          valida_ate: string | null;
          data_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          sala_id: string;
          titulo: string;
          contratante?: string | null;
          inicio: string;
          fim: string;
          situacao?: SituacaoDaPauta;
          ordem_na_fila?: number | null;
          valida_ate?: string | null;
          data_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          sala_id?: string;
          titulo?: string;
          contratante?: string | null;
          inicio?: string;
          fim?: string;
          situacao?: SituacaoDaPauta;
          ordem_na_fila?: number | null;
          valida_ate?: string | null;
          data_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_pautas_data_id_fkey";
            columns: ["data_id"];
            isOneToOne: false;
            referencedRelation: "producao_datas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_pautas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_pautas_sala_id_fkey";
            columns: ["sala_id"];
            isOneToOne: false;
            referencedRelation: "producao_salas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_itens: {
        Row: {
          id: string;
          organization_id: string;
          nome: string;
          categoria: CategoriaDoItem;
          dono: DonoDoItem;
          obra_id: string | null;
          espaco_id: string | null;
          fornecedor: string | null;
          locacao_inicio: string | null;
          locacao_fim: string | null;
          devolvido_em: string | null;
          quantidade: number;
          comprimento_cm: number | null;
          largura_cm: number | null;
          altura_cm: number | null;
          peso_kg: number | null;
          serie: string | null;
          potencia_w: number | null;
          canais: number | null;
          notas: string | null;
          arquivado: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nome: string;
          categoria?: CategoriaDoItem;
          dono?: DonoDoItem;
          obra_id?: string | null;
          espaco_id?: string | null;
          fornecedor?: string | null;
          locacao_inicio?: string | null;
          locacao_fim?: string | null;
          devolvido_em?: string | null;
          quantidade?: number;
          comprimento_cm?: number | null;
          largura_cm?: number | null;
          altura_cm?: number | null;
          peso_kg?: number | null;
          serie?: string | null;
          potencia_w?: number | null;
          canais?: number | null;
          notas?: string | null;
          arquivado?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          nome?: string;
          categoria?: CategoriaDoItem;
          dono?: DonoDoItem;
          obra_id?: string | null;
          espaco_id?: string | null;
          fornecedor?: string | null;
          locacao_inicio?: string | null;
          locacao_fim?: string | null;
          devolvido_em?: string | null;
          quantidade?: number;
          comprimento_cm?: number | null;
          largura_cm?: number | null;
          altura_cm?: number | null;
          peso_kg?: number | null;
          serie?: string | null;
          potencia_w?: number | null;
          canais?: number | null;
          notas?: string | null;
          arquivado?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_itens_espaco_id_fkey";
            columns: ["espaco_id"];
            isOneToOne: false;
            referencedRelation: "producao_espacos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_itens_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "producao_obras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_itens_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_itens_valores: {
        Row: {
          item_id: string;
          organization_id: string;
          valor_unitario: number | null;
          valor_locacao: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          item_id: string;
          organization_id: string;
          valor_unitario?: number | null;
          valor_locacao?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          item_id?: string;
          organization_id?: string;
          valor_unitario?: number | null;
          valor_locacao?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_itens_valores_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: true;
            referencedRelation: "producao_itens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_itens_valores_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_item_datas: {
        Row: {
          id: string;
          organization_id: string;
          item_id: string;
          data_id: string;
          quantidade: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          item_id: string;
          data_id: string;
          quantidade?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          item_id?: string;
          data_id?: string;
          quantidade?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_item_datas_data_id_fkey";
            columns: ["data_id"];
            isOneToOne: false;
            referencedRelation: "producao_datas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_item_datas_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "producao_itens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_item_datas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_plantas: {
        Row: {
          id: string;
          organization_id: string;
          nome: string;
          tipo: TipoDePlanta;
          largura_m: number;
          profundidade_m: number;
          espaco_id: string | null;
          sala_id: string | null;
          data_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nome: string;
          tipo?: TipoDePlanta;
          largura_m: number;
          profundidade_m: number;
          espaco_id?: string | null;
          sala_id?: string | null;
          data_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          nome?: string;
          tipo?: TipoDePlanta;
          largura_m?: number;
          profundidade_m?: number;
          espaco_id?: string | null;
          sala_id?: string | null;
          data_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_plantas_data_id_fkey";
            columns: ["data_id"];
            isOneToOne: false;
            referencedRelation: "producao_datas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_plantas_espaco_id_fkey";
            columns: ["espaco_id"];
            isOneToOne: false;
            referencedRelation: "producao_espacos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_plantas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_plantas_sala_id_fkey";
            columns: ["sala_id"];
            isOneToOne: false;
            referencedRelation: "producao_salas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_planta_objetos: {
        Row: {
          id: string;
          organization_id: string;
          planta_id: string;
          item_id: string | null;
          sala_id: string | null;
          rotulo: string;
          x_m: number;
          y_m: number;
          largura_m: number;
          profundidade_m: number;
          rotacao_graus: number;
          tipo: TipoDeObjetoDaPlanta;
          canais: number | null;
          potencia_w: number | null;
          circuito: string | null;
          fase: FaseDeEnergia | null;
          canal_inicial: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          planta_id: string;
          item_id?: string | null;
          sala_id?: string | null;
          rotulo: string;
          x_m?: number;
          y_m?: number;
          largura_m?: number;
          profundidade_m?: number;
          rotacao_graus?: number;
          tipo?: TipoDeObjetoDaPlanta;
          canais?: number | null;
          potencia_w?: number | null;
          circuito?: string | null;
          fase?: FaseDeEnergia | null;
          canal_inicial?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          planta_id?: string;
          item_id?: string | null;
          sala_id?: string | null;
          rotulo?: string;
          x_m?: number;
          y_m?: number;
          largura_m?: number;
          profundidade_m?: number;
          rotacao_graus?: number;
          tipo?: TipoDeObjetoDaPlanta;
          canais?: number | null;
          potencia_w?: number | null;
          circuito?: string | null;
          fase?: FaseDeEnergia | null;
          canal_inicial?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_planta_objetos_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "producao_itens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_planta_objetos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_planta_objetos_planta_id_fkey";
            columns: ["planta_id"];
            isOneToOne: false;
            referencedRelation: "producao_plantas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_planta_objetos_sala_id_fkey";
            columns: ["sala_id"];
            isOneToOne: false;
            referencedRelation: "producao_salas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_riders: {
        Row: {
          id: string;
          organization_id: string;
          nome: string;
          planta_id: string | null;
          obra_id: string | null;
          palco_largura_min_m: number | null;
          palco_profundidade_min_m: number | null;
          observacoes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nome: string;
          planta_id?: string | null;
          obra_id?: string | null;
          palco_largura_min_m?: number | null;
          palco_profundidade_min_m?: number | null;
          observacoes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          nome?: string;
          planta_id?: string | null;
          obra_id?: string | null;
          palco_largura_min_m?: number | null;
          palco_profundidade_min_m?: number | null;
          observacoes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_riders_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "producao_obras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_riders_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_riders_planta_id_fkey";
            columns: ["planta_id"];
            isOneToOne: false;
            referencedRelation: "producao_plantas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_rider_itens: {
        Row: {
          id: string;
          organization_id: string;
          rider_id: string;
          secao: SecaoDoRider;
          texto: string;
          quantidade: number | null;
          obrigatorio: boolean;
          ordem: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          rider_id: string;
          secao?: SecaoDoRider;
          texto: string;
          quantidade?: number | null;
          obrigatorio?: boolean;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          rider_id?: string;
          secao?: SecaoDoRider;
          texto?: string;
          quantidade?: number | null;
          obrigatorio?: boolean;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_rider_itens_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_rider_itens_rider_id_fkey";
            columns: ["rider_id"];
            isOneToOne: false;
            referencedRelation: "producao_riders";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_espaco_fichas: {
        Row: {
          espaco_id: string;
          organization_id: string;
          funcionamento: string | null;
          acessibilidade: string | null;
          carga_descarga: string | null;
          doca_altura_m: number | null;
          veiculo_max_m: number | null;
          contato_nome: string | null;
          contato_telefone: string | null;
          contato_email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          espaco_id: string;
          organization_id: string;
          funcionamento?: string | null;
          acessibilidade?: string | null;
          carga_descarga?: string | null;
          doca_altura_m?: number | null;
          veiculo_max_m?: number | null;
          contato_nome?: string | null;
          contato_telefone?: string | null;
          contato_email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          espaco_id?: string;
          organization_id?: string;
          funcionamento?: string | null;
          acessibilidade?: string | null;
          carga_descarga?: string | null;
          doca_altura_m?: number | null;
          veiculo_max_m?: number | null;
          contato_nome?: string | null;
          contato_telefone?: string | null;
          contato_email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_espaco_fichas_espaco_id_fkey";
            columns: ["espaco_id"];
            isOneToOne: true;
            referencedRelation: "producao_espacos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_espaco_fichas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_sala_fichas: {
        Row: {
          sala_id: string;
          organization_id: string;
          palco_boca_m: number | null;
          palco_profundidade_m: number | null;
          palco_altura_m: number | null;
          palco_piso: string | null;
          som_sistema: string | null;
          som_canais_entrada: number | null;
          luz_descricao: string | null;
          luz_refletores: number | null;
          energia_kva: number | null;
          energia_tensao_v: number | null;
          energia_fases: number | null;
          camarins_quantidade: number | null;
          camarins_capacidade: number | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          sala_id: string;
          organization_id: string;
          palco_boca_m?: number | null;
          palco_profundidade_m?: number | null;
          palco_altura_m?: number | null;
          palco_piso?: string | null;
          som_sistema?: string | null;
          som_canais_entrada?: number | null;
          luz_descricao?: string | null;
          luz_refletores?: number | null;
          energia_kva?: number | null;
          energia_tensao_v?: number | null;
          energia_fases?: number | null;
          camarins_quantidade?: number | null;
          camarins_capacidade?: number | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          sala_id?: string;
          organization_id?: string;
          palco_boca_m?: number | null;
          palco_profundidade_m?: number | null;
          palco_altura_m?: number | null;
          palco_piso?: string | null;
          som_sistema?: string | null;
          som_canais_entrada?: number | null;
          luz_descricao?: string | null;
          luz_refletores?: number | null;
          energia_kva?: number | null;
          energia_tensao_v?: number | null;
          energia_fases?: number | null;
          camarins_quantidade?: number | null;
          camarins_capacidade?: number | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_sala_fichas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_sala_fichas_sala_id_fkey";
            columns: ["sala_id"];
            isOneToOne: true;
            referencedRelation: "producao_salas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_equipamentos: {
        Row: {
          id: string;
          organization_id: string;
          espaco_id: string;
          sala_id: string | null;
          nome: string;
          categoria: CategoriaDoItem;
          quantidade: number;
          estado: EstadoDoEquipamento;
          observacoes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          espaco_id: string;
          sala_id?: string | null;
          nome: string;
          categoria?: CategoriaDoItem;
          quantidade?: number;
          estado?: EstadoDoEquipamento;
          observacoes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          espaco_id?: string;
          sala_id?: string | null;
          nome?: string;
          categoria?: CategoriaDoItem;
          quantidade?: number;
          estado?: EstadoDoEquipamento;
          observacoes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_equipamentos_espaco_id_fkey";
            columns: ["espaco_id"];
            isOneToOne: false;
            referencedRelation: "producao_espacos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_equipamentos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_equipamentos_sala_id_fkey";
            columns: ["sala_id"];
            isOneToOne: false;
            referencedRelation: "producao_salas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_manutencoes: {
        Row: {
          id: string;
          organization_id: string;
          equipamento_id: string;
          tipo: TipoDeManutencao;
          descricao: string;
          prevista_para: string;
          feita_em: string | null;
          recorrencia_dias: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          equipamento_id: string;
          tipo?: TipoDeManutencao;
          descricao: string;
          prevista_para: string;
          feita_em?: string | null;
          recorrencia_dias?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          equipamento_id?: string;
          tipo?: TipoDeManutencao;
          descricao?: string;
          prevista_para?: string;
          feita_em?: string | null;
          recorrencia_dias?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_manutencoes_equipamento_id_fkey";
            columns: ["equipamento_id"];
            isOneToOne: false;
            referencedRelation: "producao_equipamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_manutencoes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_veiculos: {
        Row: {
          id: string;
          organization_id: string;
          nome: string;
          placa: string | null;
          modelo: string | null;
          ano: number | null;
          categoria: CategoriaDoVeiculo;
          combustivel: CombustivelDoVeiculo;
          contratacao: ContratacaoDoVeiculo;
          fornecedor: string | null;
          consumo_km_por_litro: number | null;
          capacidade_carga_kg: number | null;
          capacidade_volume_m3: number | null;
          lugares: number | null;
          notas: string | null;
          arquivado: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nome: string;
          placa?: string | null;
          modelo?: string | null;
          ano?: number | null;
          categoria?: CategoriaDoVeiculo;
          combustivel?: CombustivelDoVeiculo;
          contratacao?: ContratacaoDoVeiculo;
          fornecedor?: string | null;
          consumo_km_por_litro?: number | null;
          capacidade_carga_kg?: number | null;
          capacidade_volume_m3?: number | null;
          lugares?: number | null;
          notas?: string | null;
          arquivado?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          nome?: string;
          placa?: string | null;
          modelo?: string | null;
          ano?: number | null;
          categoria?: CategoriaDoVeiculo;
          combustivel?: CombustivelDoVeiculo;
          contratacao?: ContratacaoDoVeiculo;
          fornecedor?: string | null;
          consumo_km_por_litro?: number | null;
          capacidade_carga_kg?: number | null;
          capacidade_volume_m3?: number | null;
          lugares?: number | null;
          notas?: string | null;
          arquivado?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_veiculos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_veiculo_documentos: {
        Row: {
          id: string;
          organization_id: string;
          veiculo_id: string;
          tipo: TipoDeDocumentoDoVeiculo;
          numero: string | null;
          validade: string | null;
          observacoes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          veiculo_id: string;
          tipo?: TipoDeDocumentoDoVeiculo;
          numero?: string | null;
          validade?: string | null;
          observacoes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          veiculo_id?: string;
          tipo?: TipoDeDocumentoDoVeiculo;
          numero?: string | null;
          validade?: string | null;
          observacoes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_veiculo_documentos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_veiculo_documentos_veiculo_id_fkey";
            columns: ["veiculo_id"];
            isOneToOne: false;
            referencedRelation: "producao_veiculos";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_deslocamentos: {
        Row: {
          id: string;
          organization_id: string;
          data_id: string;
          tipo: TipoDeDeslocamento;
          origem: string | null;
          destino: string | null;
          saida: string | null;
          chegada: string | null;
          veiculo_id: string | null;
          motorista_id: string | null;
          companhia: string | null;
          localizador: string | null;
          notas: string | null;
          odometro_saida_km: number | null;
          odometro_chegada_km: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          data_id: string;
          tipo?: TipoDeDeslocamento;
          origem?: string | null;
          destino?: string | null;
          saida?: string | null;
          chegada?: string | null;
          veiculo_id?: string | null;
          motorista_id?: string | null;
          companhia?: string | null;
          localizador?: string | null;
          notas?: string | null;
          odometro_saida_km?: number | null;
          odometro_chegada_km?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          data_id?: string;
          tipo?: TipoDeDeslocamento;
          origem?: string | null;
          destino?: string | null;
          saida?: string | null;
          chegada?: string | null;
          veiculo_id?: string | null;
          motorista_id?: string | null;
          companhia?: string | null;
          localizador?: string | null;
          notas?: string | null;
          odometro_saida_km?: number | null;
          odometro_chegada_km?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_deslocamentos_data_id_fkey";
            columns: ["data_id"];
            isOneToOne: false;
            referencedRelation: "producao_datas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_deslocamentos_motorista_id_fkey";
            columns: ["motorista_id"];
            isOneToOne: false;
            referencedRelation: "producao_pessoas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_deslocamentos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_deslocamentos_veiculo_id_fkey";
            columns: ["veiculo_id"];
            isOneToOne: false;
            referencedRelation: "producao_veiculos";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_hospedagens: {
        Row: {
          id: string;
          organization_id: string;
          temporada_id: string;
          hotel: string;
          endereco: string | null;
          entrada: string | null;
          saida: string | null;
          localizador: string | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          temporada_id: string;
          hotel: string;
          endereco?: string | null;
          entrada?: string | null;
          saida?: string | null;
          localizador?: string | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          temporada_id?: string;
          hotel?: string;
          endereco?: string | null;
          entrada?: string | null;
          saida?: string | null;
          localizador?: string | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_hospedagens_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_hospedagens_temporada_id_fkey";
            columns: ["temporada_id"];
            isOneToOne: false;
            referencedRelation: "producao_temporadas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_quartos: {
        Row: {
          id: string;
          organization_id: string;
          hospedagem_id: string;
          nome: string;
          capacidade: number;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          hospedagem_id: string;
          nome: string;
          capacidade?: number;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          hospedagem_id?: string;
          nome?: string;
          capacidade?: number;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_quartos_hospedagem_id_fkey";
            columns: ["hospedagem_id"];
            isOneToOne: false;
            referencedRelation: "producao_hospedagens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_quartos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_ocupantes: {
        Row: {
          id: string;
          organization_id: string;
          hospedagem_id: string;
          quarto_id: string;
          pessoa_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          hospedagem_id: string;
          quarto_id: string;
          pessoa_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          hospedagem_id?: string;
          quarto_id?: string;
          pessoa_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_ocupantes_hospedagem_id_fkey";
            columns: ["hospedagem_id"];
            isOneToOne: false;
            referencedRelation: "producao_hospedagens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_ocupantes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_ocupantes_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "producao_pessoas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_ocupantes_quarto_id_fkey";
            columns: ["quarto_id"];
            isOneToOne: false;
            referencedRelation: "producao_quartos";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_deslocamento_pessoas: {
        Row: {
          id: string;
          organization_id: string;
          deslocamento_id: string;
          pessoa_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          deslocamento_id: string;
          pessoa_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          deslocamento_id?: string;
          pessoa_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_deslocamento_pessoas_deslocamento_id_fkey";
            columns: ["deslocamento_id"];
            isOneToOne: false;
            referencedRelation: "producao_deslocamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_deslocamento_pessoas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_deslocamento_pessoas_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "producao_pessoas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_convites: {
        Row: {
          id: string;
          organization_id: string;
          temporada_id: string;
          pessoa_id: string;
          token_hash: string | null;
          link_expira_em: string | null;
          link_revogado_em: string | null;
          resposta: RespostaDoConvite;
          chegada_dia: string | null;
          chegada_hora: string | null;
          saida_dia: string | null;
          saida_hora: string | null;
          observacao: string | null;
          respondido_em: string | null;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          temporada_id: string;
          pessoa_id: string;
          token_hash?: string | null;
          link_expira_em?: string | null;
          link_revogado_em?: string | null;
          resposta?: RespostaDoConvite;
          chegada_dia?: string | null;
          chegada_hora?: string | null;
          saida_dia?: string | null;
          saida_hora?: string | null;
          observacao?: string | null;
          respondido_em?: string | null;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          temporada_id?: string;
          pessoa_id?: string;
          token_hash?: string | null;
          link_expira_em?: string | null;
          link_revogado_em?: string | null;
          resposta?: RespostaDoConvite;
          chegada_dia?: string | null;
          chegada_hora?: string | null;
          saida_dia?: string | null;
          saida_hora?: string | null;
          observacao?: string | null;
          respondido_em?: string | null;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_convites_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_convites_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "producao_pessoas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_convites_temporada_id_fkey";
            columns: ["temporada_id"];
            isOneToOne: false;
            referencedRelation: "producao_temporadas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_checklist_itens: {
        Row: {
          id: string;
          organization_id: string;
          deslocamento_id: string;
          tipo: TipoDoItemDoChecklist;
          nome: string;
          quantidade: number;
          item_id: string | null;
          saida: SituacaoDaConferencia;
          saida_em: string | null;
          volta: SituacaoDaConferencia;
          volta_em: string | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          deslocamento_id: string;
          tipo?: TipoDoItemDoChecklist;
          nome: string;
          quantidade?: number;
          item_id?: string | null;
          saida?: SituacaoDaConferencia;
          saida_em?: string | null;
          volta?: SituacaoDaConferencia;
          volta_em?: string | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          deslocamento_id?: string;
          tipo?: TipoDoItemDoChecklist;
          nome?: string;
          quantidade?: number;
          item_id?: string | null;
          saida?: SituacaoDaConferencia;
          saida_em?: string | null;
          volta?: SituacaoDaConferencia;
          volta_em?: string | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_checklist_itens_deslocamento_id_fkey";
            columns: ["deslocamento_id"];
            isOneToOne: false;
            referencedRelation: "producao_deslocamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_checklist_itens_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "producao_itens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_checklist_itens_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_abastecimentos: {
        Row: {
          id: string;
          organization_id: string;
          deslocamento_id: string;
          pessoa_id: string | null;
          litros: number;
          combustivel: CombustivelDoVeiculo;
          posto: string | null;
          quando: string;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          deslocamento_id: string;
          pessoa_id?: string | null;
          litros: number;
          combustivel?: CombustivelDoVeiculo;
          posto?: string | null;
          quando?: string;
          notas?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          deslocamento_id?: string;
          pessoa_id?: string | null;
          litros?: number;
          combustivel?: CombustivelDoVeiculo;
          posto?: string | null;
          quando?: string;
          notas?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_abastecimentos_deslocamento_id_fkey";
            columns: ["deslocamento_id"];
            isOneToOne: false;
            referencedRelation: "producao_deslocamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_abastecimentos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_abastecimentos_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "producao_pessoas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_ocorrencias: {
        Row: {
          id: string;
          organization_id: string;
          data_id: string;
          tipo: TipoDeOcorrencia;
          gravidade: GravidadeDaOcorrencia;
          descricao: string;
          providencia: string | null;
          ocorreu_em: string;
          resolvida: boolean;
          resolvida_em: string | null;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          data_id: string;
          tipo?: TipoDeOcorrencia;
          gravidade?: GravidadeDaOcorrencia;
          descricao: string;
          providencia?: string | null;
          ocorreu_em?: string;
          resolvida?: boolean;
          resolvida_em?: string | null;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          data_id?: string;
          tipo?: TipoDeOcorrencia;
          gravidade?: GravidadeDaOcorrencia;
          descricao?: string;
          providencia?: string | null;
          ocorreu_em?: string;
          resolvida?: boolean;
          resolvida_em?: string | null;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_ocorrencias_data_id_fkey";
            columns: ["data_id"];
            isOneToOne: false;
            referencedRelation: "producao_datas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_ocorrencias_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_voluntarios_links: {
        Row: {
          id: string;
          organization_id: string;
          temporada_id: string;
          token_hash: string | null;
          titulo: string | null;
          vagas: number | null;
          expira_em: string | null;
          revogado_em: string | null;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          temporada_id: string;
          token_hash?: string | null;
          titulo?: string | null;
          vagas?: number | null;
          expira_em?: string | null;
          revogado_em?: string | null;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          temporada_id?: string;
          token_hash?: string | null;
          titulo?: string | null;
          vagas?: number | null;
          expira_em?: string | null;
          revogado_em?: string | null;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_voluntarios_links_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_voluntarios_links_temporada_id_fkey";
            columns: ["temporada_id"];
            isOneToOne: true;
            referencedRelation: "producao_temporadas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_voluntarios: {
        Row: {
          id: string;
          organization_id: string;
          temporada_id: string;
          nome: string;
          email: string | null;
          telefone: string | null;
          disponibilidade: string | null;
          consentiu_em: string;
          situacao: SituacaoDoVoluntario;
          pessoa_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          temporada_id: string;
          nome: string;
          email?: string | null;
          telefone?: string | null;
          disponibilidade?: string | null;
          consentiu_em?: string;
          situacao?: SituacaoDoVoluntario;
          pessoa_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          temporada_id?: string;
          nome?: string;
          email?: string | null;
          telefone?: string | null;
          disponibilidade?: string | null;
          consentiu_em?: string;
          situacao?: SituacaoDoVoluntario;
          pessoa_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_voluntarios_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_voluntarios_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "producao_pessoas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_voluntarios_temporada_id_fkey";
            columns: ["temporada_id"];
            isOneToOne: false;
            referencedRelation: "producao_temporadas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_credencial_tipos: {
        Row: {
          id: string;
          organization_id: string;
          nome: string;
          cota_por_sessao: number | null;
          arquivado: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nome: string;
          cota_por_sessao?: number | null;
          arquivado?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          nome?: string;
          cota_por_sessao?: number | null;
          arquivado?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_credencial_tipos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_convidados: {
        Row: {
          id: string;
          organization_id: string;
          sessao_id: string;
          tipo_id: string;
          nome: string;
          afiliacao: string | null;
          quantidade: number;
          situacao: SituacaoDoConvidado;
          solicitante: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          sessao_id: string;
          tipo_id: string;
          nome: string;
          afiliacao?: string | null;
          quantidade?: number;
          situacao?: SituacaoDoConvidado;
          solicitante?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          sessao_id?: string;
          tipo_id?: string;
          nome?: string;
          afiliacao?: string | null;
          quantidade?: number;
          situacao?: SituacaoDoConvidado;
          solicitante?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_convidados_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_convidados_sessao_id_fkey";
            columns: ["sessao_id"];
            isOneToOne: false;
            referencedRelation: "producao_sessoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_convidados_tipo_id_fkey";
            columns: ["tipo_id"];
            isOneToOne: false;
            referencedRelation: "producao_credencial_tipos";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_credenciais: {
        Row: {
          id: string;
          organization_id: string;
          sessao_id: string;
          convidado_id: string;
          token_hash: string;
          entradas: number;
          ultima_entrada_em: string | null;
          revogada_em: string | null;
          emitida_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          sessao_id: string;
          convidado_id: string;
          token_hash: string;
          entradas?: number;
          ultima_entrada_em?: string | null;
          revogada_em?: string | null;
          emitida_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          sessao_id?: string;
          convidado_id?: string;
          token_hash?: string;
          entradas?: number;
          ultima_entrada_em?: string | null;
          revogada_em?: string | null;
          emitida_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_credenciais_convidado_id_fkey";
            columns: ["convidado_id"];
            isOneToOne: true;
            referencedRelation: "producao_convidados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_credenciais_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_credenciais_sessao_id_fkey";
            columns: ["sessao_id"];
            isOneToOne: false;
            referencedRelation: "producao_sessoes";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_porta_leituras: {
        Row: {
          id: string;
          organization_id: string;
          sessao_id: string;
          credencial_id: string | null;
          resultado: ResultadoDaLeitura;
          motivo: string | null;
          lida_em: string;
          lida_por: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          sessao_id: string;
          credencial_id?: string | null;
          resultado: ResultadoDaLeitura;
          motivo?: string | null;
          lida_em?: string;
          lida_por?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          sessao_id?: string;
          credencial_id?: string | null;
          resultado?: ResultadoDaLeitura;
          motivo?: string | null;
          lida_em?: string;
          lida_por?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "producao_porta_leituras_credencial_id_fkey";
            columns: ["credencial_id"];
            isOneToOne: false;
            referencedRelation: "producao_credenciais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_porta_leituras_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_porta_leituras_sessao_id_fkey";
            columns: ["sessao_id"];
            isOneToOne: false;
            referencedRelation: "producao_sessoes";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_convidados_links: {
        Row: {
          id: string;
          organization_id: string;
          sessao_id: string;
          token_hash: string;
          titulo: string | null;
          corte_em: string;
          limite: number;
          revogado_em: string | null;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          sessao_id: string;
          token_hash: string;
          titulo?: string | null;
          corte_em: string;
          limite?: number;
          revogado_em?: string | null;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          sessao_id?: string;
          token_hash?: string;
          titulo?: string | null;
          corte_em?: string;
          limite?: number;
          revogado_em?: string | null;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_convidados_links_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_convidados_links_sessao_id_fkey";
            columns: ["sessao_id"];
            isOneToOne: true;
            referencedRelation: "producao_sessoes";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_visitas_horarios: {
        Row: {
          id: string;
          organization_id: string;
          espaco_id: string;
          dia: string;
          inicio: string;
          fim: string;
          capacidade: number;
          publico_avulso: number | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          espaco_id: string;
          dia: string;
          inicio: string;
          fim: string;
          capacidade: number;
          publico_avulso?: number | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          espaco_id?: string;
          dia?: string;
          inicio?: string;
          fim?: string;
          capacidade?: number;
          publico_avulso?: number | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_visitas_horarios_espaco_id_fkey";
            columns: ["espaco_id"];
            isOneToOne: false;
            referencedRelation: "producao_espacos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_visitas_horarios_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_visitas_agendamentos: {
        Row: {
          id: string;
          organization_id: string;
          horario_id: string;
          grupo: string;
          responsavel: string;
          email: string | null;
          telefone: string | null;
          pessoas: number;
          situacao: SituacaoDoAgendamento;
          presentes: number | null;
          observacao: string | null;
          consentiu_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          horario_id: string;
          grupo: string;
          responsavel: string;
          email?: string | null;
          telefone?: string | null;
          pessoas: number;
          situacao?: SituacaoDoAgendamento;
          presentes?: number | null;
          observacao?: string | null;
          consentiu_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          horario_id?: string;
          grupo?: string;
          responsavel?: string;
          email?: string | null;
          telefone?: string | null;
          pessoas?: number;
          situacao?: SituacaoDoAgendamento;
          presentes?: number | null;
          observacao?: string | null;
          consentiu_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_visitas_agendamentos_horario_id_fkey";
            columns: ["horario_id"];
            isOneToOne: false;
            referencedRelation: "producao_visitas_horarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_visitas_agendamentos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_visitas_links: {
        Row: {
          id: string;
          organization_id: string;
          espaco_id: string;
          token_hash: string;
          titulo: string | null;
          expira_em: string;
          revogado_em: string | null;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          espaco_id: string;
          token_hash: string;
          titulo?: string | null;
          expira_em: string;
          revogado_em?: string | null;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          espaco_id?: string;
          token_hash?: string;
          titulo?: string | null;
          expira_em?: string;
          revogado_em?: string | null;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_visitas_links_espaco_id_fkey";
            columns: ["espaco_id"];
            isOneToOne: true;
            referencedRelation: "producao_espacos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_visitas_links_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_turmas: {
        Row: {
          id: string;
          organization_id: string;
          nome: string;
          inicio: string | null;
          fim: string | null;
          vagas: number | null;
          frequencia_minima: number;
          situacao: SituacaoDaTurma;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nome: string;
          inicio?: string | null;
          fim?: string | null;
          vagas?: number | null;
          frequencia_minima?: number;
          situacao?: SituacaoDaTurma;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          nome?: string;
          inicio?: string | null;
          fim?: string | null;
          vagas?: number | null;
          frequencia_minima?: number;
          situacao?: SituacaoDaTurma;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_turmas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_turma_aulas: {
        Row: {
          id: string;
          organization_id: string;
          turma_id: string;
          dia: string;
          inicio: string;
          fim: string;
          tema: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          turma_id: string;
          dia: string;
          inicio: string;
          fim: string;
          tema?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          turma_id?: string;
          dia?: string;
          inicio?: string;
          fim?: string;
          tema?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_turma_aulas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_turma_aulas_turma_id_fkey";
            columns: ["turma_id"];
            isOneToOne: false;
            referencedRelation: "producao_turmas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_matriculas: {
        Row: {
          id: string;
          organization_id: string;
          turma_id: string;
          nome: string;
          email: string | null;
          telefone: string | null;
          situacao: SituacaoDaMatricula;
          certificado_emitido_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          turma_id: string;
          nome: string;
          email?: string | null;
          telefone?: string | null;
          situacao?: SituacaoDaMatricula;
          certificado_emitido_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          turma_id?: string;
          nome?: string;
          email?: string | null;
          telefone?: string | null;
          situacao?: SituacaoDaMatricula;
          certificado_emitido_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_matriculas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_matriculas_turma_id_fkey";
            columns: ["turma_id"];
            isOneToOne: false;
            referencedRelation: "producao_turmas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_presencas: {
        Row: {
          id: string;
          organization_id: string;
          aula_id: string;
          matricula_id: string;
          presente: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          aula_id: string;
          matricula_id: string;
          presente?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          aula_id?: string;
          matricula_id?: string;
          presente?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_presencas_aula_id_fkey";
            columns: ["aula_id"];
            isOneToOne: false;
            referencedRelation: "producao_turma_aulas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_presencas_matricula_id_fkey";
            columns: ["matricula_id"];
            isOneToOne: false;
            referencedRelation: "producao_matriculas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_presencas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_setores: {
        Row: {
          id: string;
          organization_id: string;
          sala_id: string;
          nome: string;
          lugares: number;
          ordem: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          sala_id: string;
          nome: string;
          lugares: number;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          sala_id?: string;
          nome?: string;
          lugares?: number;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_setores_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_setores_sala_id_fkey";
            columns: ["sala_id"];
            isOneToOne: false;
            referencedRelation: "producao_salas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_setor_cotas: {
        Row: {
          id: string;
          organization_id: string;
          sessao_id: string;
          setor_id: string;
          categoria: CategoriaDaCota;
          lugares: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          sessao_id: string;
          setor_id: string;
          categoria: CategoriaDaCota;
          lugares: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          sessao_id?: string;
          setor_id?: string;
          categoria?: CategoriaDaCota;
          lugares?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_setor_cotas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_setor_cotas_sessao_id_fkey";
            columns: ["sessao_id"];
            isOneToOne: false;
            referencedRelation: "producao_sessoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_setor_cotas_setor_id_fkey";
            columns: ["setor_id"];
            isOneToOne: false;
            referencedRelation: "producao_setores";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_expografia: {
        Row: {
          id: string;
          organization_id: string;
          sala_id: string;
          item_id: string;
          posicao: PosicaoNaExposicao;
          altura_instalacao_cm: number | null;
          ordem_montagem: number;
          luz: LuzDaObra;
          lux: number | null;
          notas: string | null;
          instalada_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          sala_id: string;
          item_id: string;
          posicao?: PosicaoNaExposicao;
          altura_instalacao_cm?: number | null;
          ordem_montagem?: number;
          luz?: LuzDaObra;
          lux?: number | null;
          notas?: string | null;
          instalada_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          sala_id?: string;
          item_id?: string;
          posicao?: PosicaoNaExposicao;
          altura_instalacao_cm?: number | null;
          ordem_montagem?: number;
          luz?: LuzDaObra;
          lux?: number | null;
          notas?: string | null;
          instalada_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_expografia_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_expografia_sala_id_fkey";
            columns: ["sala_id"];
            isOneToOne: false;
            referencedRelation: "producao_salas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_expografia_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "producao_itens";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_borderos: {
        Row: {
          id: string;
          organization_id: string;
          sessao_id: string;
          publico_casa: number | null;
          situacao: SituacaoDoBordero;
          observacao: string | null;
          fechado_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          sessao_id: string;
          publico_casa?: number | null;
          situacao?: SituacaoDoBordero;
          observacao?: string | null;
          fechado_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          sessao_id?: string;
          publico_casa?: number | null;
          situacao?: SituacaoDoBordero;
          observacao?: string | null;
          fechado_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_borderos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_borderos_sessao_id_fkey";
            columns: ["sessao_id"];
            isOneToOne: true;
            referencedRelation: "producao_sessoes";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_bordero_receitas: {
        Row: {
          id: string;
          organization_id: string;
          bordero_id: string;
          categoria: string;
          quantidade: number;
          valor_unitario: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          bordero_id: string;
          categoria: string;
          quantidade?: number;
          valor_unitario?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          bordero_id?: string;
          categoria?: string;
          quantidade?: number;
          valor_unitario?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_bordero_receitas_bordero_id_fkey";
            columns: ["bordero_id"];
            isOneToOne: false;
            referencedRelation: "producao_borderos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_bordero_receitas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_bordero_deducoes: {
        Row: {
          id: string;
          organization_id: string;
          bordero_id: string;
          nome: string;
          forma: FormaDaDeducao;
          valor: number;
          beneficiario: string | null;
          ordem: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          bordero_id: string;
          nome: string;
          forma?: FormaDaDeducao;
          valor?: number;
          beneficiario?: string | null;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          bordero_id?: string;
          nome?: string;
          forma?: FormaDaDeducao;
          valor?: number;
          beneficiario?: string | null;
          ordem?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_bordero_deducoes_bordero_id_fkey";
            columns: ["bordero_id"];
            isOneToOne: false;
            referencedRelation: "producao_borderos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_bordero_deducoes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_bordero_acertos: {
        Row: {
          id: string;
          organization_id: string;
          bordero_id: string;
          parte: string;
          papel: PapelNoAcerto;
          forma: FormaDoAcerto;
          valor: number;
          situacao: SituacaoDoAcertoDoBordero;
          aprovado_por: string | null;
          aprovado_em: string | null;
          pago_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          bordero_id: string;
          parte: string;
          papel?: PapelNoAcerto;
          forma?: FormaDoAcerto;
          valor?: number;
          situacao?: SituacaoDoAcertoDoBordero;
          aprovado_por?: string | null;
          aprovado_em?: string | null;
          pago_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          bordero_id?: string;
          parte?: string;
          papel?: PapelNoAcerto;
          forma?: FormaDoAcerto;
          valor?: number;
          situacao?: SituacaoDoAcertoDoBordero;
          aprovado_por?: string | null;
          aprovado_em?: string | null;
          pago_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_bordero_acertos_bordero_id_fkey";
            columns: ["bordero_id"];
            isOneToOne: false;
            referencedRelation: "producao_borderos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_bordero_acertos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_orcamentos: {
        Row: {
          id: string;
          organization_id: string;
          temporada_id: string;
          nome: string;
          situacao: SituacaoDoOrcamento;
          aprovado_por: string | null;
          aprovado_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          temporada_id: string;
          nome?: string;
          situacao?: SituacaoDoOrcamento;
          aprovado_por?: string | null;
          aprovado_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          temporada_id?: string;
          nome?: string;
          situacao?: SituacaoDoOrcamento;
          aprovado_por?: string | null;
          aprovado_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_orcamentos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_orcamentos_temporada_id_fkey";
            columns: ["temporada_id"];
            isOneToOne: false;
            referencedRelation: "producao_temporadas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_orcamento_linhas: {
        Row: {
          id: string;
          organization_id: string;
          orcamento_id: string;
          categoria: CategoriaDoOrcamento;
          descricao: string;
          estimativa: number | null;
          aprovado: number | null;
          revisado: number | null;
          comprometido: number;
          pago: number;
          ordem: number;
          formula: string | null;
          acordo_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          orcamento_id: string;
          categoria?: CategoriaDoOrcamento;
          descricao: string;
          estimativa?: number | null;
          aprovado?: number | null;
          revisado?: number | null;
          comprometido?: number;
          pago?: number;
          ordem?: number;
          formula?: string | null;
          acordo_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          orcamento_id?: string;
          categoria?: CategoriaDoOrcamento;
          descricao?: string;
          estimativa?: number | null;
          aprovado?: number | null;
          revisado?: number | null;
          comprometido?: number;
          pago?: number;
          ordem?: number;
          formula?: string | null;
          acordo_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_orcamento_linhas_acordo_id_fkey";
            columns: ["acordo_id"];
            isOneToOne: false;
            referencedRelation: "producao_acordos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_orcamento_linhas_orcamento_id_fkey";
            columns: ["orcamento_id"];
            isOneToOne: false;
            referencedRelation: "producao_orcamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_orcamento_linhas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_orcamento_variaveis: {
        Row: {
          id: string;
          organization_id: string;
          orcamento_id: string;
          nome: string;
          rotulo: string | null;
          valor: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          orcamento_id: string;
          nome: string;
          rotulo?: string | null;
          valor?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          orcamento_id?: string;
          nome?: string;
          rotulo?: string | null;
          valor?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_orcamento_variaveis_orcamento_id_fkey";
            columns: ["orcamento_id"];
            isOneToOne: false;
            referencedRelation: "producao_orcamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_orcamento_variaveis_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_acordos: {
        Row: {
          id: string;
          organization_id: string;
          temporada_id: string;
          contraparte: string;
          tipo: TipoDeAcordo;
          sentido: SentidoDoAcordo;
          situacao: SituacaoDoAcordo;
          valor_fixo: number | null;
          garantia: number | null;
          percentual_bilheteria: number | null;
          bonus_publico: number | null;
          bonus_valor: number | null;
          despesas_nossas: string | null;
          despesas_da_contraparte: string | null;
          retencoes: string | null;
          observacao: string | null;
          assinado_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          temporada_id: string;
          contraparte: string;
          tipo?: TipoDeAcordo;
          sentido?: SentidoDoAcordo;
          situacao?: SituacaoDoAcordo;
          valor_fixo?: number | null;
          garantia?: number | null;
          percentual_bilheteria?: number | null;
          bonus_publico?: number | null;
          bonus_valor?: number | null;
          despesas_nossas?: string | null;
          despesas_da_contraparte?: string | null;
          retencoes?: string | null;
          observacao?: string | null;
          assinado_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          temporada_id?: string;
          contraparte?: string;
          tipo?: TipoDeAcordo;
          sentido?: SentidoDoAcordo;
          situacao?: SituacaoDoAcordo;
          valor_fixo?: number | null;
          garantia?: number | null;
          percentual_bilheteria?: number | null;
          bonus_publico?: number | null;
          bonus_valor?: number | null;
          despesas_nossas?: string | null;
          despesas_da_contraparte?: string | null;
          retencoes?: string | null;
          observacao?: string | null;
          assinado_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_acordos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_acordos_temporada_id_fkey";
            columns: ["temporada_id"];
            isOneToOne: false;
            referencedRelation: "producao_temporadas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_acordo_datas: {
        Row: {
          id: string;
          organization_id: string;
          acordo_id: string;
          data_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          acordo_id: string;
          data_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          acordo_id?: string;
          data_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_acordo_datas_acordo_id_fkey";
            columns: ["acordo_id"];
            isOneToOne: false;
            referencedRelation: "producao_acordos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_acordo_datas_data_id_fkey";
            columns: ["data_id"];
            isOneToOne: false;
            referencedRelation: "producao_datas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_acordo_datas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_lancamentos: {
        Row: {
          id: string;
          organization_id: string;
          temporada_id: string;
          descricao: string;
          favorecido: string | null;
          documento: string | null;
          data: string;
          valor: number;
          observacao: string | null;
          pedido_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          temporada_id: string;
          descricao: string;
          favorecido?: string | null;
          documento?: string | null;
          data: string;
          valor: number;
          observacao?: string | null;
          pedido_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          temporada_id?: string;
          descricao?: string;
          favorecido?: string | null;
          documento?: string | null;
          data?: string;
          valor?: number;
          observacao?: string | null;
          pedido_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_lancamentos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_lancamentos_pedido_id_fkey";
            columns: ["pedido_id"];
            isOneToOne: false;
            referencedRelation: "producao_pedidos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_lancamentos_temporada_id_fkey";
            columns: ["temporada_id"];
            isOneToOne: false;
            referencedRelation: "producao_temporadas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_lancamento_linhas: {
        Row: {
          id: string;
          organization_id: string;
          lancamento_id: string;
          orcamento_linha_id: string;
          valor: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          lancamento_id: string;
          orcamento_linha_id: string;
          valor: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          lancamento_id?: string;
          orcamento_linha_id?: string;
          valor?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_lancamento_linhas_lancamento_id_fkey";
            columns: ["lancamento_id"];
            isOneToOne: false;
            referencedRelation: "producao_lancamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_lancamento_linhas_orcamento_linha_id_fkey";
            columns: ["orcamento_linha_id"];
            isOneToOne: false;
            referencedRelation: "producao_orcamento_linhas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_lancamento_linhas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_faturas: {
        Row: {
          id: string;
          organization_id: string;
          temporada_id: string;
          acordo_id: string | null;
          contratante: string;
          descricao: string;
          situacao: SituacaoDaFatura;
          valor: number;
          retencoes: number;
          nota_numero: string | null;
          emissao: string | null;
          vencimento: string | null;
          observacao: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          temporada_id: string;
          acordo_id?: string | null;
          contratante: string;
          descricao: string;
          situacao?: SituacaoDaFatura;
          valor: number;
          retencoes?: number;
          nota_numero?: string | null;
          emissao?: string | null;
          vencimento?: string | null;
          observacao?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          temporada_id?: string;
          acordo_id?: string | null;
          contratante?: string;
          descricao?: string;
          situacao?: SituacaoDaFatura;
          valor?: number;
          retencoes?: number;
          nota_numero?: string | null;
          emissao?: string | null;
          vencimento?: string | null;
          observacao?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_faturas_acordo_id_fkey";
            columns: ["acordo_id"];
            isOneToOne: false;
            referencedRelation: "producao_acordos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_faturas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_faturas_temporada_id_fkey";
            columns: ["temporada_id"];
            isOneToOne: false;
            referencedRelation: "producao_temporadas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_fatura_parcelas: {
        Row: {
          id: string;
          organization_id: string;
          fatura_id: string;
          rotulo: string | null;
          valor: number;
          vencimento: string;
          recebido_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          fatura_id: string;
          rotulo?: string | null;
          valor: number;
          vencimento: string;
          recebido_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          fatura_id?: string;
          rotulo?: string | null;
          valor?: number;
          vencimento?: string;
          recebido_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_fatura_parcelas_fatura_id_fkey";
            columns: ["fatura_id"];
            isOneToOne: false;
            referencedRelation: "producao_faturas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_fatura_parcelas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_pedidos: {
        Row: {
          id: string;
          organization_id: string;
          temporada_id: string;
          orcamento_linha_id: string | null;
          solicitante_id: string | null;
          descricao: string;
          favorecido: string | null;
          valor: number;
          justificativa: string | null;
          situacao: SituacaoDoPedido;
          aprovado_por: string | null;
          aprovado_em: string | null;
          motivo_recusa: string | null;
          pendencia: string | null;
          pendencia_ate: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          temporada_id: string;
          orcamento_linha_id?: string | null;
          solicitante_id?: string | null;
          descricao: string;
          favorecido?: string | null;
          valor: number;
          justificativa?: string | null;
          situacao?: SituacaoDoPedido;
          aprovado_por?: string | null;
          aprovado_em?: string | null;
          motivo_recusa?: string | null;
          pendencia?: string | null;
          pendencia_ate?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          temporada_id?: string;
          orcamento_linha_id?: string | null;
          solicitante_id?: string | null;
          descricao?: string;
          favorecido?: string | null;
          valor?: number;
          justificativa?: string | null;
          situacao?: SituacaoDoPedido;
          aprovado_por?: string | null;
          aprovado_em?: string | null;
          motivo_recusa?: string | null;
          pendencia?: string | null;
          pendencia_ate?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_pedidos_orcamento_linha_id_fkey";
            columns: ["orcamento_linha_id"];
            isOneToOne: false;
            referencedRelation: "producao_orcamento_linhas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_pedidos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_pedidos_temporada_id_fkey";
            columns: ["temporada_id"];
            isOneToOne: false;
            referencedRelation: "producao_temporadas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_turnos: {
        Row: {
          id: string;
          organization_id: string;
          espaco_id: string;
          pessoa_id: string;
          pauta_id: string | null;
          dia: string;
          inicio: string;
          fim: string;
          funcao: string | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          espaco_id: string;
          pessoa_id: string;
          pauta_id?: string | null;
          dia: string;
          inicio: string;
          fim: string;
          funcao?: string | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          espaco_id?: string;
          pessoa_id?: string;
          pauta_id?: string | null;
          dia?: string;
          inicio?: string;
          fim?: string;
          funcao?: string | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_turnos_espaco_id_fkey";
            columns: ["espaco_id"];
            isOneToOne: false;
            referencedRelation: "producao_espacos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_turnos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_turnos_pauta_id_fkey";
            columns: ["pauta_id"];
            isOneToOne: false;
            referencedRelation: "producao_pautas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_turnos_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "producao_pessoas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_notas: {
        Row: {
          id: string;
          organization_id: string;
          data_id: string;
          texto: string;
          autor: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          data_id: string;
          texto: string;
          autor?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          data_id?: string;
          texto?: string;
          autor?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_notas_data_id_fkey";
            columns: ["data_id"];
            isOneToOne: false;
            referencedRelation: "producao_datas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_notas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_modelos_acerto: {
        Row: {
          id: string;
          organization_id: string;
          nome: string;
          lado: LadoDoAcerto;
          tipo_producao: string | null;
          campos: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nome: string;
          lado?: LadoDoAcerto;
          tipo_producao?: string | null;
          campos?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          nome?: string;
          lado?: LadoDoAcerto;
          tipo_producao?: string | null;
          campos?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_modelos_acerto_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_acertos: {
        Row: {
          id: string;
          organization_id: string;
          data_id: string;
          modelo_nome: string;
          lado: LadoDoAcerto;
          situacao: SituacaoDoAcerto;
          token_hash: string | null;
          link_expira_em: string | null;
          link_revogado_em: string | null;
          respondente_nome: string | null;
          respondente_email: string | null;
          respondido_em: string | null;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          data_id: string;
          modelo_nome: string;
          lado?: LadoDoAcerto;
          situacao?: SituacaoDoAcerto;
          token_hash?: string | null;
          link_expira_em?: string | null;
          link_revogado_em?: string | null;
          respondente_nome?: string | null;
          respondente_email?: string | null;
          respondido_em?: string | null;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          data_id?: string;
          modelo_nome?: string;
          lado?: LadoDoAcerto;
          situacao?: SituacaoDoAcerto;
          token_hash?: string | null;
          link_expira_em?: string | null;
          link_revogado_em?: string | null;
          respondente_nome?: string | null;
          respondente_email?: string | null;
          respondido_em?: string | null;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_acertos_data_id_fkey";
            columns: ["data_id"];
            isOneToOne: false;
            referencedRelation: "producao_datas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_acertos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_acerto_itens: {
        Row: {
          id: string;
          organization_id: string;
          acerto_id: string;
          ordem: number;
          chave: string;
          secao: string;
          rotulo: string;
          tipo: TipoDeCampoDoAcerto;
          opcoes: Json;
          destino: DestinoDoAcerto;
          visibilidade: VisibilidadeDoAcerto;
          ajuda: string | null;
          valor_atual: string | null;
          resposta: string | null;
          situacao: SituacaoDoItemDoAcerto;
          motivo: string | null;
          revisado_por: string | null;
          revisado_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          acerto_id: string;
          ordem?: number;
          chave: string;
          secao: string;
          rotulo: string;
          tipo?: TipoDeCampoDoAcerto;
          opcoes?: Json;
          destino?: DestinoDoAcerto;
          visibilidade?: VisibilidadeDoAcerto;
          ajuda?: string | null;
          valor_atual?: string | null;
          resposta?: string | null;
          situacao?: SituacaoDoItemDoAcerto;
          motivo?: string | null;
          revisado_por?: string | null;
          revisado_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          acerto_id?: string;
          ordem?: number;
          chave?: string;
          secao?: string;
          rotulo?: string;
          tipo?: TipoDeCampoDoAcerto;
          opcoes?: Json;
          destino?: DestinoDoAcerto;
          visibilidade?: VisibilidadeDoAcerto;
          ajuda?: string | null;
          valor_atual?: string | null;
          resposta?: string | null;
          situacao?: SituacaoDoItemDoAcerto;
          motivo?: string | null;
          revisado_por?: string | null;
          revisado_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_acerto_itens_acerto_id_fkey";
            columns: ["acerto_id"];
            isOneToOne: false;
            referencedRelation: "producao_acertos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_acerto_itens_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_sessoes: {
        Row: {
          id: string;
          organization_id: string;
          pauta_id: string;
          dia: string;
          inicio: string;
          fim: string;
          titulo: string | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          pauta_id: string;
          dia: string;
          inicio: string;
          fim: string;
          titulo?: string | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          pauta_id?: string;
          dia?: string;
          inicio?: string;
          fim?: string;
          titulo?: string | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_sessoes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_sessoes_pauta_id_fkey";
            columns: ["pauta_id"];
            isOneToOne: false;
            referencedRelation: "producao_pautas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_programacao_links: {
        Row: {
          id: string;
          organization_id: string;
          espaco_id: string;
          titulo: string | null;
          token_hash: string;
          revogado_em: string | null;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          espaco_id: string;
          titulo?: string | null;
          token_hash: string;
          revogado_em?: string | null;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          espaco_id?: string;
          titulo?: string | null;
          token_hash?: string;
          revogado_em?: string | null;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_programacao_links_espaco_id_fkey";
            columns: ["espaco_id"];
            isOneToOne: false;
            referencedRelation: "producao_espacos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_programacao_links_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_sites: {
        Row: {
          id: string;
          organization_id: string;
          espaco_id: string;
          nome: string;
          titulo: string | null;
          cor: string;
          situacao: SituacaoDoSite;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          espaco_id: string;
          nome: string;
          titulo?: string | null;
          cor?: string;
          situacao?: SituacaoDoSite;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          espaco_id?: string;
          nome?: string;
          titulo?: string | null;
          cor?: string;
          situacao?: SituacaoDoSite;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_sites_espaco_id_fkey";
            columns: ["espaco_id"];
            isOneToOne: false;
            referencedRelation: "producao_espacos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_sites_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_site_paginas: {
        Row: {
          id: string;
          organization_id: string;
          site_id: string;
          slug: string;
          titulo: string;
          ordem: number;
          blocos: Json;
          blocos_publicados: Json | null;
          publicada_em: string | null;
          descricao: string | null;
          imagem_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          site_id: string;
          slug: string;
          titulo: string;
          ordem?: number;
          blocos?: Json;
          blocos_publicados?: Json | null;
          publicada_em?: string | null;
          descricao?: string | null;
          imagem_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          site_id?: string;
          slug?: string;
          titulo?: string;
          ordem?: number;
          blocos?: Json;
          blocos_publicados?: Json | null;
          publicada_em?: string | null;
          descricao?: string | null;
          imagem_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_site_paginas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_site_paginas_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "producao_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_site_dominios: {
        Row: {
          id: string;
          organization_id: string;
          site_id: string;
          dominio: string;
          situacao: SituacaoDoDominio;
          token_verificacao: string;
          erro: string | null;
          verificado_em: string | null;
          conferido_em: string | null;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          site_id: string;
          dominio: string;
          situacao?: SituacaoDoDominio;
          token_verificacao: string;
          erro?: string | null;
          verificado_em?: string | null;
          conferido_em?: string | null;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          site_id?: string;
          dominio?: string;
          situacao?: SituacaoDoDominio;
          token_verificacao?: string;
          erro?: string | null;
          verificado_em?: string | null;
          conferido_em?: string | null;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_site_dominios_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_site_dominios_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "producao_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_licencas: {
        Row: {
          id: string;
          organization_id: string;
          data_id: string;
          tipo: TipoDeLicenca;
          situacao: SituacaoDaLicenca;
          responsavel_pessoa_id: string | null;
          prazo_dias: number | null;
          validade: string | null;
          protocolo: string | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          data_id: string;
          tipo?: TipoDeLicenca;
          situacao?: SituacaoDaLicenca;
          responsavel_pessoa_id?: string | null;
          prazo_dias?: number | null;
          validade?: string | null;
          protocolo?: string | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          data_id?: string;
          tipo?: TipoDeLicenca;
          situacao?: SituacaoDaLicenca;
          responsavel_pessoa_id?: string | null;
          prazo_dias?: number | null;
          validade?: string | null;
          protocolo?: string | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_licencas_data_id_fkey";
            columns: ["data_id"];
            isOneToOne: false;
            referencedRelation: "producao_datas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_licencas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_licencas_responsavel_pessoa_id_fkey";
            columns: ["responsavel_pessoa_id"];
            isOneToOne: false;
            referencedRelation: "producao_pessoas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_tarefas: {
        Row: {
          id: string;
          organization_id: string;
          data_id: string;
          titulo: string;
          modelo: string | null;
          prazo: string | null;
          prazo_dias: number | null;
          responsavel_pessoa_id: string | null;
          funcao: string | null;
          situacao: SituacaoDaTarefa;
          concluida_em: string | null;
          licenca_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          data_id: string;
          titulo: string;
          modelo?: string | null;
          prazo?: string | null;
          prazo_dias?: number | null;
          responsavel_pessoa_id?: string | null;
          funcao?: string | null;
          situacao?: SituacaoDaTarefa;
          concluida_em?: string | null;
          licenca_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          data_id?: string;
          titulo?: string;
          modelo?: string | null;
          prazo?: string | null;
          prazo_dias?: number | null;
          responsavel_pessoa_id?: string | null;
          funcao?: string | null;
          situacao?: SituacaoDaTarefa;
          concluida_em?: string | null;
          licenca_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_tarefas_data_id_fkey";
            columns: ["data_id"];
            isOneToOne: false;
            referencedRelation: "producao_datas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_tarefas_licenca_id_fkey";
            columns: ["licenca_id"];
            isOneToOne: false;
            referencedRelation: "producao_licencas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_tarefas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_tarefas_responsavel_pessoa_id_fkey";
            columns: ["responsavel_pessoa_id"];
            isOneToOne: false;
            referencedRelation: "producao_pessoas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_pessoas: {
        Row: {
          id: string;
          organization_id: string;
          nome: string;
          nome_artistico: string | null;
          email: string | null;
          telefone: string | null;
          tipo: string;
          user_id: string | null;
          arquivada: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nome: string;
          nome_artistico?: string | null;
          email?: string | null;
          telefone?: string | null;
          tipo?: string;
          user_id?: string | null;
          arquivada?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          nome?: string;
          nome_artistico?: string | null;
          email?: string | null;
          telefone?: string | null;
          tipo?: string;
          user_id?: string | null;
          arquivada?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_pessoas_membro_fkey";
            columns: ["organization_id", "user_id"];
            isOneToOne: true;
            referencedRelation: "organization_members";
            referencedColumns: ["organization_id", "user_id"];
          },
          {
            foreignKeyName: "producao_pessoas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_vinculos: {
        Row: {
          id: string;
          organization_id: string;
          pessoa_id: string;
          temporada_id: string | null;
          espaco_id: string | null;
          funcao: string;
          grupo: string | null;
          inicio: string | null;
          fim: string | null;
          situacao: SituacaoDoVinculo;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          pessoa_id: string;
          temporada_id?: string | null;
          espaco_id?: string | null;
          funcao: string;
          grupo?: string | null;
          inicio?: string | null;
          fim?: string | null;
          situacao?: SituacaoDoVinculo;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          pessoa_id?: string;
          temporada_id?: string | null;
          espaco_id?: string | null;
          funcao?: string;
          grupo?: string | null;
          inicio?: string | null;
          fim?: string | null;
          situacao?: SituacaoDoVinculo;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_vinculos_espaco_id_fkey";
            columns: ["espaco_id"];
            isOneToOne: false;
            referencedRelation: "producao_espacos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_vinculos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_vinculos_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "producao_pessoas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_vinculos_temporada_id_fkey";
            columns: ["temporada_id"];
            isOneToOne: false;
            referencedRelation: "producao_temporadas";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_vinculos_valores: {
        Row: {
          vinculo_id: string;
          organization_id: string;
          cache: number | null;
          diaria: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          vinculo_id: string;
          organization_id: string;
          cache?: number | null;
          diaria?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          vinculo_id?: string;
          organization_id?: string;
          cache?: number | null;
          diaria?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_vinculos_valores_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_vinculos_valores_vinculo_id_fkey";
            columns: ["vinculo_id"];
            isOneToOne: true;
            referencedRelation: "producao_vinculos";
            referencedColumns: ["id"];
          },
        ];
      };
      producao_escalas: {
        Row: {
          id: string;
          organization_id: string;
          pessoa_id: string;
          data_id: string;
          funcao: string | null;
          chamada: string | null;
          saida: string | null;
          confirmacao: ConfirmacaoDaEscala;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          pessoa_id: string;
          data_id: string;
          funcao?: string | null;
          chamada?: string | null;
          saida?: string | null;
          confirmacao?: ConfirmacaoDaEscala;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          pessoa_id?: string;
          data_id?: string;
          funcao?: string | null;
          chamada?: string | null;
          saida?: string | null;
          confirmacao?: ConfirmacaoDaEscala;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producao_escalas_data_id_fkey";
            columns: ["data_id"];
            isOneToOne: false;
            referencedRelation: "producao_datas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_escalas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producao_escalas_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "producao_pessoas";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      auth_producao_arquivo_pode: {
        Args: { p_nome: string; p_acao: string };
        Returns: boolean;
      };
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
      auth_producao_pasta_pode: {
        Args: { p_org: string; p_pasta: string; p_acao: string };
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
      auth_producao_ve_pessoa: {
        Args: { p_org: string; p_pessoa_id: string };
        Returns: boolean;
      };
      auth_producao_ve_temporada: {
        Args: { p_org: string; p_temporada_id: string | null };
        Returns: boolean;
      };
      fn_producao_pedido_mudar: {
        Args: { p_pedido: string; p_passo: string; p_motivo: string };
        Returns: undefined;
      };
      fn_producao_convite_gerar: {
        Args: { p_temporada: string; p_pessoas: string[]; p_dias: number };
        Returns: Json;
      };
      fn_producao_voluntarios_gerar_link: {
        Args: { p_temporada: string; p_dias: number; p_titulo: string; p_vagas: number };
        Returns: string;
      };
      fn_producao_credenciais_emitir: {
        Args: { p_sessao: string };
        Returns: Json;
      };
      fn_producao_credencial_achar: {
        Args: { p_sessao: string; p_codigo: string };
        Returns: string;
      };
      fn_producao_credencial_reemitir: {
        Args: { p_convidado: string };
        Returns: string;
      };
      fn_producao_porta_ler: {
        Args: { p_sessao: string; p_codigo: string };
        Returns: Json;
      };
      fn_producao_convidados_gerar_link: {
        Args: { p_sessao: string; p_corte: string; p_titulo: string; p_limite: number };
        Returns: string;
      };
      fn_producao_visitas_gerar_link: {
        Args: { p_espaco: string; p_dias: number; p_titulo: string };
        Returns: string;
      };
      fn_producao_voluntario_aprovar: {
        Args: { p_voluntario: string };
        Returns: string;
      };
      fn_producao_acerto_criar: {
        Args: { p_data: string; p_modelo: string; p_valores: Json };
        Returns: string;
      };
      fn_producao_acerto_novo_link: {
        Args: { p_acerto: string; p_dias: number };
        Returns: string;
      };
      fn_producao_acerto_revisar: {
        Args: { p_item: string; p_aprovar: boolean; p_motivo: string };
        Returns: string;
      };
      fn_producao_programacao_criar_link: {
        Args: { p_espaco: string; p_titulo: string };
        Returns: string;
      };
      fn_producao_site_publicar_pagina: {
        Args: { p_pagina: string };
        Returns: string;
      };
      fn_producao_caminho_partes: {
        Args: { p_nome: string };
        Returns: string[];
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
