// O tipo do banco só da Ticketeria (T1 do plano em docs/acoes-futuras/estudos/plano-modulo-ticketeria.md).
//
// O `Database` do app (lib/supabase/types.ts) é escrito à mão e não tem as tabelas dos módulos novos; a Produção tem o
// dela em lib/producao/banco.ts. Este arquivo faz o mesmo para a Ticketeria, no formato que o @supabase/supabase-js espera
// de um `Database`: o cliente de cliente.ts faz o compilador acusar tabela, coluna e valor de lista fechada que não existem.
//
// De onde vêm os dados: supabase/migrations/20261118233242_ticketeria_lojas_site.sql (T1), 20261119002840_ticketeria_eventos.sql (T2), 20261119011007_ticketeria_catalogo.sql (T3) e 20261119033509_ticketeria_pagamentos.sql (T4), conferidas contra o gerador do conector
// (supabase gen types) em 18/11/2026, depois de aplicada: as mesmas colunas e anulabilidade. tests/ticketeria-banco-tipos.test.ts compara este arquivo com a migration.
// Relationships não lista as chaves para auth.users (`criado_por`): o PostgREST só expõe o schema public.

import type { CategoriaDoIngresso, ClassificacaoIndicativa, ContaDoRazao, QuemPagaATaxa, SituacaoDoDominio, SituacaoDoEvento, SituacaoDoPedido, SituacaoDoSite, TipoDeTransacao } from "@/lib/ticketeria/estados";
import type { Json } from "@/lib/supabase/types";

export type BancoDaTicketeria = {
  public: {
    Tables: {
      ticketeria_lojas: {
        Row: {
          id: string;
          organization_id: string;
          nome: string;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nome: string;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          nome?: string;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_lojas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_sites: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
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
          loja_id: string;
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
          loja_id?: string;
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
            foreignKeyName: "ticketeria_sites_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: true;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_sites_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_site_paginas: {
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
            foreignKeyName: "ticketeria_site_paginas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_site_paginas_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_site_dominios: {
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
            foreignKeyName: "ticketeria_site_dominios_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_site_dominios_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_locais: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          nome: string;
          endereco: string | null;
          cidade: string | null;
          uf: string | null;
          fuso: string;
          arquivado: boolean;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          nome: string;
          endereco?: string | null;
          cidade?: string | null;
          uf?: string | null;
          fuso?: string;
          arquivado?: boolean;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          nome?: string;
          endereco?: string | null;
          cidade?: string | null;
          uf?: string | null;
          fuso?: string;
          arquivado?: boolean;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_locais_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_locais_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_setores: {
        Row: {
          id: string;
          organization_id: string;
          local_id: string;
          nome: string;
          lugares: number;
          ordem: number;
          arquivado: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          local_id: string;
          nome: string;
          lugares: number;
          ordem?: number;
          arquivado?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          local_id?: string;
          nome?: string;
          lugares?: number;
          ordem?: number;
          arquivado?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_setores_local_id_fkey";
            columns: ["local_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_locais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_setores_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_eventos: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          titulo: string;
          descricao: string | null;
          imagem_url: string | null;
          classificacao: ClassificacaoIndicativa | null;
          situacao: SituacaoDoEvento;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          titulo: string;
          descricao?: string | null;
          imagem_url?: string | null;
          classificacao?: ClassificacaoIndicativa | null;
          situacao?: SituacaoDoEvento;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          titulo?: string;
          descricao?: string | null;
          imagem_url?: string | null;
          classificacao?: ClassificacaoIndicativa | null;
          situacao?: SituacaoDoEvento;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_eventos_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_eventos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_sessoes: {
        Row: {
          id: string;
          organization_id: string;
          evento_id: string;
          local_id: string;
          inicio: string;
          fim: string | null;
          abertura_portas: string | null;
          cancelada_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          evento_id: string;
          local_id: string;
          inicio: string;
          fim?: string | null;
          abertura_portas?: string | null;
          cancelada_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          evento_id?: string;
          local_id?: string;
          inicio?: string;
          fim?: string | null;
          abertura_portas?: string | null;
          cancelada_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_sessoes_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_eventos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_sessoes_local_id_fkey";
            columns: ["local_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_locais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_sessoes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_ingressos: {
        Row: {
          id: string;
          organization_id: string;
          evento_id: string;
          setor_id: string;
          nome: string;
          categoria: CategoriaDoIngresso;
          descricao: string | null;
          limite_por_pedido: number;
          publico: boolean;
          ordem: number;
          arquivado: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          evento_id: string;
          setor_id: string;
          nome: string;
          categoria: CategoriaDoIngresso;
          descricao?: string | null;
          limite_por_pedido?: number;
          publico?: boolean;
          ordem?: number;
          arquivado?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          evento_id?: string;
          setor_id?: string;
          nome?: string;
          categoria?: CategoriaDoIngresso;
          descricao?: string | null;
          limite_por_pedido?: number;
          publico?: boolean;
          ordem?: number;
          arquivado?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_ingressos_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_eventos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_ingressos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_ingressos_setor_id_fkey";
            columns: ["setor_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_setores";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_lotes: {
        Row: {
          id: string;
          organization_id: string;
          ingresso_id: string;
          nome: string;
          ordem: number;
          preco_centavos: number;
          quantidade: number;
          vendas_inicio: string | null;
          vendas_fim: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          ingresso_id: string;
          nome: string;
          ordem?: number;
          preco_centavos: number;
          quantidade: number;
          vendas_inicio?: string | null;
          vendas_fim?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          ingresso_id?: string;
          nome?: string;
          ordem?: number;
          preco_centavos?: number;
          quantidade?: number;
          vendas_inicio?: string | null;
          vendas_fim?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_lotes_ingresso_id_fkey";
            columns: ["ingresso_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_ingressos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_lotes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_taxas: {
        Row: {
          id: string;
          loja_id: string | null;
          percentual_bps: number;
          fixo_centavos: number;
          quem_paga: QuemPagaATaxa;
          vigente_desde: string;
          criado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          loja_id?: string | null;
          percentual_bps?: number;
          fixo_centavos?: number;
          quem_paga?: QuemPagaATaxa;
          vigente_desde?: string;
          criado_por?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          loja_id?: string | null;
          percentual_bps?: number;
          fixo_centavos?: number;
          quem_paga?: QuemPagaATaxa;
          vigente_desde?: string;
          criado_por?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_taxas_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_pedidos: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          sessao_id: string;
          codigo: string;
          comprador_nome: string;
          comprador_email: string;
          situacao: SituacaoDoPedido;
          total_centavos: number;
          taxa_centavos: number;
          produtor_centavos: number;
          quem_paga_taxa: QuemPagaATaxa;
          reservado_ate: string;
          provedor: string | null;
          provedor_ref: string | null;
          pago_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          sessao_id: string;
          codigo: string;
          comprador_nome: string;
          comprador_email: string;
          situacao?: SituacaoDoPedido;
          total_centavos: number;
          taxa_centavos: number;
          produtor_centavos: number;
          quem_paga_taxa: QuemPagaATaxa;
          reservado_ate: string;
          provedor?: string | null;
          provedor_ref?: string | null;
          pago_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          sessao_id?: string;
          codigo?: string;
          comprador_nome?: string;
          comprador_email?: string;
          situacao?: SituacaoDoPedido;
          total_centavos?: number;
          taxa_centavos?: number;
          produtor_centavos?: number;
          quem_paga_taxa?: QuemPagaATaxa;
          reservado_ate?: string;
          provedor?: string | null;
          provedor_ref?: string | null;
          pago_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_pedidos_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_pedidos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_pedidos_sessao_id_fkey";
            columns: ["sessao_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_sessoes";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_pedido_itens: {
        Row: {
          id: string;
          organization_id: string;
          pedido_id: string;
          ingresso_id: string;
          lote_id: string;
          quantidade: number;
          preco_centavos: number;
          taxa_centavos: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          pedido_id: string;
          ingresso_id: string;
          lote_id: string;
          quantidade: number;
          preco_centavos: number;
          taxa_centavos: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          pedido_id?: string;
          ingresso_id?: string;
          lote_id?: string;
          quantidade?: number;
          preco_centavos?: number;
          taxa_centavos?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_pedido_itens_ingresso_id_fkey";
            columns: ["ingresso_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_ingressos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_pedido_itens_lote_id_fkey";
            columns: ["lote_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_pedido_itens_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_pedido_itens_pedido_id_fkey";
            columns: ["pedido_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_pedidos";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_transacoes: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          pedido_id: string | null;
          tipo: TipoDeTransacao;
          descricao: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          pedido_id?: string | null;
          tipo: TipoDeTransacao;
          descricao?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          pedido_id?: string | null;
          tipo?: TipoDeTransacao;
          descricao?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_transacoes_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_transacoes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_transacoes_pedido_id_fkey";
            columns: ["pedido_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_pedidos";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_partidas: {
        Row: {
          id: string;
          organization_id: string;
          transacao_id: string;
          conta: ContaDoRazao;
          valor_centavos: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          transacao_id: string;
          conta: ContaDoRazao;
          valor_centavos: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          transacao_id?: string;
          conta?: ContaDoRazao;
          valor_centavos?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_partidas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_partidas_transacao_id_fkey";
            columns: ["transacao_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_transacoes";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_notificacoes_provedor: {
        Row: {
          id: string;
          provedor: string;
          id_externo: string;
          tipo: string;
          pedido_id: string | null;
          payload: Json;
          resultado: string | null;
          recebida_em: string;
          processada_em: string | null;
        };
        Insert: {
          id?: string;
          provedor: string;
          id_externo: string;
          tipo: string;
          pedido_id?: string | null;
          payload: Json;
          resultado?: string | null;
          recebida_em?: string;
          processada_em?: string | null;
        };
        Update: {
          id?: string;
          provedor?: string;
          id_externo?: string;
          tipo?: string;
          pedido_id?: string | null;
          payload?: Json;
          resultado?: string | null;
          recebida_em?: string;
          processada_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_notificacoes_provedor_pedido_id_fkey";
            columns: ["pedido_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_pedidos";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      auth_ticketeria_pode: {
        Args: { p_org: string; p_acao: "ler" | "editar" };
        Returns: boolean;
      };
      fn_ticketeria_site_publicar_pagina: {
        Args: { p_pagina: string };
        Returns: string;
      };
      // As duas abaixo só o servidor executa (chave de serviço); o navegador recebe "permissão negada".
      fn_ticketeria_reservar: {
        Args: { p_sessao: string; p_itens: Json; p_nome: string; p_email: string; p_minutos: number };
        Returns: Json;
      };
      fn_ticketeria_confirmar_pagamento: {
        Args: { p_pedido: string; p_provedor: string; p_ref: string; p_valor_centavos: number };
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

type Tabelas = BancoDaTicketeria["public"]["Tables"];

/** O nome de uma tabela da Ticketeria. */
export type NomeDaTabela = keyof Tabelas;
/** A linha como o banco a devolve. */
export type Linha<T extends NomeDaTabela> = Tabelas[T]["Row"];
