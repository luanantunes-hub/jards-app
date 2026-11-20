// O tipo do banco só da Ticketeria (T1 do plano em docs/acoes-futuras/estudos/plano-modulo-ticketeria.md).
//
// O `Database` do app (lib/supabase/types.ts) é escrito à mão e não tem as tabelas dos módulos novos; a Produção tem o
// dela em lib/producao/banco.ts. Este arquivo faz o mesmo para a Ticketeria, no formato que o @supabase/supabase-js espera
// de um `Database`: o cliente de cliente.ts faz o compilador acusar tabela, coluna e valor de lista fechada que não existem.
//
// De onde vêm os dados: supabase/migrations/20261118233242_ticketeria_lojas_site.sql (T1), 20261119002840_ticketeria_eventos.sql (T2), 20261119011007_ticketeria_catalogo.sql (T3), 20261119033509_ticketeria_pagamentos.sql (T4) 20261119041904_ticketeria_custo_do_meio.sql (T5), 20261119190000_ticketeria_custo_real_do_pagamento.sql e 20261119210000_ticketeria_validacao_de_saque.sql (o cadeado do repasse), conferidas contra o gerador do conector
// (supabase gen types) em 18/11/2026, depois de aplicada: as mesmas colunas e anulabilidade. tests/ticketeria-banco-tipos.test.ts compara este arquivo com a migration.
// Relationships não lista as chaves para auth.users (`criado_por`): o PostgREST só expõe o schema public.

import type { CategoriaDoIngresso, ClassificacaoIndicativa, ContaDoRazao, MeioDePagamento, QuemPagaATaxa, SituacaoDoDominio, SituacaoDoEvento, SituacaoDoPedido, OrigemDaVersao, SituacaoDoSite, TipoDeImagem, TemaDoSite, TipoDeTransacao, TipoDoCupom } from "@/lib/ticketeria/estados";
import type { Json } from "@/lib/supabase/types";

export type BancoDaTicketeria = {
  public: {
    Tables: {
      ticketeria_lojas: {
        Row: {
          id: string;
          organization_id: string;
          nome: string;
          parcelas_max: number;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nome: string;
          parcelas_max?: number;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          nome?: string;
          parcelas_max?: number;
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
          tema: TemaDoSite;
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
          tema?: TemaDoSite;
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
          tema?: TemaDoSite;
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
          numerado: boolean;
          corredor_no_meio: boolean;
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
          numerado?: boolean;
          corredor_no_meio?: boolean;
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
          numerado?: boolean;
          corredor_no_meio?: boolean;
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
          slug: string;
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
          slug?: string;
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
          slug?: string;
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
          meio: MeioDePagamento | null;
          parcelas: number | null;
          custo_meio_centavos: number;
          custo_meio_real_centavos: number | null;
          pago_em: string | null;
          created_at: string;
          updated_at: string;
          ingressos_enviados_em: string | null;
          reembolsado_em: string | null;
          termos_versao: string | null;
          termos_aceitos_em: string | null;
          novidades_versao: string | null;
          novidades_aceitas_em: string | null;
          comprador_whatsapp: string | null;
          cupom_id: string | null;
          cupom_codigo: string | null;
          desconto_centavos: number;
          origem_canal: string | null;
          origem_acao: string | null;
          origem_referencia: string | null;
          origem_utm: Json | null;
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
          meio?: MeioDePagamento | null;
          parcelas?: number | null;
          custo_meio_centavos?: number;
          custo_meio_real_centavos?: number | null;
          pago_em?: string | null;
          created_at?: string;
          updated_at?: string;
          ingressos_enviados_em?: string | null;
          reembolsado_em?: string | null;
          termos_versao?: string | null;
          termos_aceitos_em?: string | null;
          novidades_versao?: string | null;
          novidades_aceitas_em?: string | null;
          comprador_whatsapp?: string | null;
          cupom_id?: string | null;
          cupom_codigo?: string | null;
          origem_canal?: string | null;
          origem_acao?: string | null;
          origem_referencia?: string | null;
          origem_utm?: Json | null;
          desconto_centavos?: number;
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
          meio?: MeioDePagamento | null;
          parcelas?: number | null;
          custo_meio_centavos?: number;
          custo_meio_real_centavos?: number | null;
          pago_em?: string | null;
          created_at?: string;
          updated_at?: string;
          ingressos_enviados_em?: string | null;
          reembolsado_em?: string | null;
          termos_versao?: string | null;
          termos_aceitos_em?: string | null;
          novidades_versao?: string | null;
          novidades_aceitas_em?: string | null;
          comprador_whatsapp?: string | null;
          cupom_id?: string | null;
          cupom_codigo?: string | null;
          origem_canal?: string | null;
          origem_acao?: string | null;
          origem_referencia?: string | null;
          origem_utm?: Json | null;
          desconto_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_pedidos_cupom_id_fkey";
            columns: ["cupom_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_cupons";
            referencedColumns: ["id"];
          },
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
          desconto_centavos: number;
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
          desconto_centavos?: number;
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
          desconto_centavos?: number;
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
      ticketeria_acoes_divulgacao: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          evento_id: string | null;
          nome: string;
          canal: string;
          inicio: string;
          fim: string;
          gasto_centavos: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          evento_id?: string | null;
          nome: string;
          canal: string;
          inicio: string;
          fim: string;
          gasto_centavos?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          evento_id?: string | null;
          nome?: string;
          canal?: string;
          inicio?: string;
          fim?: string;
          gasto_centavos?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_acoes_divulgacao_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_eventos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_acoes_divulgacao_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_acoes_divulgacao_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_envios: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          canal: string;
          assunto: string;
          mensagem: string;
          sessao_id: string | null;
          acao: string | null;
          segmento: string;
          destinatarios: number;
          enviados: number;
          falhas: number;
          situacao: string;
          created_by: string | null;
          created_at: string;
          enviado_em: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          canal?: string;
          assunto: string;
          mensagem: string;
          sessao_id?: string | null;
          acao?: string | null;
          segmento: string;
          destinatarios?: number;
          enviados?: number;
          falhas?: number;
          situacao?: string;
          created_by?: string | null;
          created_at?: string;
          enviado_em?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          canal?: string;
          assunto?: string;
          mensagem?: string;
          sessao_id?: string | null;
          acao?: string | null;
          segmento?: string;
          destinatarios?: number;
          enviados?: number;
          falhas?: number;
          situacao?: string;
          created_by?: string | null;
          created_at?: string;
          enviado_em?: string | null;
        };
        Relationships: [];
      };
      ticketeria_envio_destinatarios: {
        Row: {
          id: string;
          organization_id: string;
          envio_id: string;
          email: string;
          nome: string;
          token: string;
          situacao: string;
          provedor_id: string | null;
          enviado_em: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          envio_id: string;
          email: string;
          nome: string;
          token?: string;
          situacao?: string;
          provedor_id?: string | null;
          enviado_em?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          envio_id?: string;
          email?: string;
          nome?: string;
          token?: string;
          situacao?: string;
          provedor_id?: string | null;
          enviado_em?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ticketeria_saidas: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          email: string;
          saiu_em: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          email: string;
          saiu_em?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          email?: string;
          saiu_em?: string;
        };
        Relationships: [];
      };
      ticketeria_conexoes_midia: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          provedor: string;
          situacao: string;
          conta_externa_id: string | null;
          conta_gerente_id: string | null;
          conta_nome: string | null;
          moeda: string | null;
          token_secret_id: string | null;
          token_expira_em: string | null;
          ultima_leitura_em: string | null;
          ultimo_erro: string | null;
          lido_desde: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          provedor: string;
          situacao?: string;
          conta_externa_id?: string | null;
          conta_gerente_id?: string | null;
          conta_nome?: string | null;
          moeda?: string | null;
          token_secret_id?: string | null;
          token_expira_em?: string | null;
          ultima_leitura_em?: string | null;
          ultimo_erro?: string | null;
          lido_desde?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          provedor?: string;
          situacao?: string;
          conta_externa_id?: string | null;
          conta_gerente_id?: string | null;
          conta_nome?: string | null;
          moeda?: string | null;
          token_secret_id?: string | null;
          token_expira_em?: string | null;
          ultima_leitura_em?: string | null;
          ultimo_erro?: string | null;
          lido_desde?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_conexoes_midia_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_conexoes_midia_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_visitas_diarias: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          conexao_id: string;
          dia: string;
          origem: string;
          canal: string;
          sessoes: number;
          usuarios: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          conexao_id: string;
          dia: string;
          origem: string;
          canal: string;
          sessoes?: number;
          usuarios?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          conexao_id?: string;
          dia?: string;
          origem?: string;
          canal?: string;
          sessoes?: number;
          usuarios?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_visitas_diarias_conexao_id_fkey";
            columns: ["conexao_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_conexoes_midia";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_visitas_diarias_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_visitas_diarias_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_importacoes: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          tipo: string;
          arquivo: string;
          periodo_inicio: string;
          periodo_fim: string;
          linhas: number;
          total_ingressos: number;
          total_valor_centavos: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          tipo: string;
          arquivo: string;
          periodo_inicio: string;
          periodo_fim: string;
          linhas: number;
          total_ingressos?: number;
          total_valor_centavos?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          tipo?: string;
          arquivo?: string;
          periodo_inicio?: string;
          periodo_fim?: string;
          linhas?: number;
          total_ingressos?: number;
          total_valor_centavos?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_importacoes_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_importacoes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_historico_vendas: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          importacao_id: string;
          dia: string;
          canal: string;
          ingressos: number;
          valor_centavos: number;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          importacao_id: string;
          dia: string;
          canal: string;
          ingressos?: number;
          valor_centavos?: number;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          importacao_id?: string;
          dia?: string;
          canal?: string;
          ingressos?: number;
          valor_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_historico_vendas_importacao_id_fkey";
            columns: ["importacao_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_importacoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_historico_vendas_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_historico_vendas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_historico_gasto: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          importacao_id: string;
          dia: string;
          canal: string;
          gasto_centavos: number;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          importacao_id: string;
          dia: string;
          canal: string;
          gasto_centavos?: number;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          importacao_id?: string;
          dia?: string;
          canal?: string;
          gasto_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_historico_gasto_importacao_id_fkey";
            columns: ["importacao_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_importacoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_historico_gasto_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_historico_gasto_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_mmm_execucoes: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          situacao: string;
          motivo: string | null;
          motor: string | null;
          versao_motor: string | null;
          semanas: number | null;
          confianca: string | null;
          r_hat_maximo: number | null;
          divergencias: number | null;
          ess_minimo: number | null;
          base_porcento: number | null;
          base_baixo: number | null;
          base_alto: number | null;
          created_at: string;
          base_partes: Json;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          situacao: string;
          motivo?: string | null;
          motor?: string | null;
          versao_motor?: string | null;
          semanas?: number | null;
          confianca?: string | null;
          r_hat_maximo?: number | null;
          divergencias?: number | null;
          ess_minimo?: number | null;
          base_porcento?: number | null;
          base_baixo?: number | null;
          base_alto?: number | null;
          created_at?: string;
          base_partes?: Json;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          situacao?: string;
          motivo?: string | null;
          motor?: string | null;
          versao_motor?: string | null;
          semanas?: number | null;
          confianca?: string | null;
          r_hat_maximo?: number | null;
          divergencias?: number | null;
          ess_minimo?: number | null;
          base_porcento?: number | null;
          base_baixo?: number | null;
          base_alto?: number | null;
          created_at?: string;
          base_partes?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_mmm_execucoes_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_mmm_execucoes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_datas_de_pico: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          dia: string;
          nome: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          dia: string;
          nome: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          dia?: string;
          nome?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_datas_de_pico_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_datas_de_pico_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_mmm_canais: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          execucao_id: string;
          canal: string;
          porcento: number;
          intervalo_baixo: number;
          intervalo_alto: number;
          ingressos: number;
          gasto_centavos: number;
          custo_por_ingresso_centavos: number | null;
          saturacao_gasto_centavos: number | null;
          margem_grande: boolean;
          gasto_constante: boolean;
          curva: Json;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          execucao_id: string;
          canal: string;
          porcento: number;
          intervalo_baixo: number;
          intervalo_alto: number;
          ingressos?: number;
          gasto_centavos?: number;
          custo_por_ingresso_centavos?: number | null;
          saturacao_gasto_centavos?: number | null;
          margem_grande?: boolean;
          gasto_constante?: boolean;
          curva?: Json;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          execucao_id?: string;
          canal?: string;
          porcento?: number;
          intervalo_baixo?: number;
          intervalo_alto?: number;
          ingressos?: number;
          gasto_centavos?: number;
          custo_por_ingresso_centavos?: number | null;
          saturacao_gasto_centavos?: number | null;
          margem_grande?: boolean;
          gasto_constante?: boolean;
          curva?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_mmm_canais_execucao_id_fkey";
            columns: ["execucao_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_mmm_execucoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_mmm_canais_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_mmm_canais_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_midia_diaria: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          conexao_id: string;
          canal: string;
          dia: string;
          gasto_centavos: number;
          impressoes: number;
          alcance: number;
          cliques: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          conexao_id: string;
          canal: string;
          dia: string;
          gasto_centavos?: number;
          impressoes?: number;
          alcance?: number;
          cliques?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          conexao_id?: string;
          canal?: string;
          dia?: string;
          gasto_centavos?: number;
          impressoes?: number;
          alcance?: number;
          cliques?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_midia_diaria_conexao_id_fkey";
            columns: ["conexao_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_conexoes_midia";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_midia_diaria_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_midia_diaria_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_cupons: {
        Row: {
          id: string;
          organization_id: string;
          evento_id: string;
          ingresso_id: string | null;
          codigo: string;
          tipo: TipoDoCupom;
          valor: number;
          limite_usos: number | null;
          valido_ate: string | null;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          evento_id: string;
          ingresso_id?: string | null;
          codigo: string;
          tipo: TipoDoCupom;
          valor: number;
          limite_usos?: number | null;
          valido_ate?: string | null;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          evento_id?: string;
          ingresso_id?: string | null;
          codigo?: string;
          tipo?: TipoDoCupom;
          valor?: number;
          limite_usos?: number | null;
          valido_ate?: string | null;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_cupons_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_eventos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_cupons_ingresso_id_fkey";
            columns: ["ingresso_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_ingressos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_cupons_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_espera: {
        Row: {
          id: string;
          organization_id: string;
          sessao_id: string;
          ingresso_id: string;
          nome: string;
          email: string;
          quantidade: number;
          token: string;
          avisado_em: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          sessao_id: string;
          ingresso_id: string;
          nome: string;
          email: string;
          quantidade: number;
          token?: string;
          avisado_em?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          sessao_id?: string;
          ingresso_id?: string;
          nome?: string;
          email?: string;
          quantidade?: number;
          token?: string;
          avisado_em?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_espera_ingresso_id_fkey";
            columns: ["ingresso_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_ingressos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_espera_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_espera_sessao_id_fkey";
            columns: ["sessao_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_sessoes";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_assentos: {
        Row: {
          id: string;
          organization_id: string;
          setor_id: string;
          fileira: string;
          numero: number;
          bloqueado: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          setor_id: string;
          fileira: string;
          numero: number;
          bloqueado?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          setor_id?: string;
          fileira?: string;
          numero?: number;
          bloqueado?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_assentos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_assentos_setor_id_fkey";
            columns: ["setor_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_setores";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_pedido_assentos: {
        Row: {
          id: string;
          organization_id: string;
          pedido_id: string;
          sessao_id: string;
          ingresso_id: string;
          assento_id: string | null;
          fileira: string;
          numero: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          pedido_id: string;
          sessao_id: string;
          ingresso_id: string;
          assento_id?: string | null;
          fileira: string;
          numero: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          pedido_id?: string;
          sessao_id?: string;
          ingresso_id?: string;
          assento_id?: string | null;
          fileira?: string;
          numero?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_pedido_assentos_assento_id_fkey";
            columns: ["assento_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_assentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_pedido_assentos_ingresso_id_fkey";
            columns: ["ingresso_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_ingressos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_pedido_assentos_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_pedido_assentos_pedido_id_fkey";
            columns: ["pedido_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_pedidos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_pedido_assentos_sessao_id_fkey";
            columns: ["sessao_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_sessoes";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_porta_desfeitas: {
        Row: {
          id: string;
          organization_id: string;
          ingresso_emitido_id: string;
          sessao_id: string;
          usado_em: string;
          usado_por: string | null;
          desfeito_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          ingresso_emitido_id: string;
          sessao_id: string;
          usado_em: string;
          usado_por?: string | null;
          desfeito_por?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          ingresso_emitido_id?: string;
          sessao_id?: string;
          usado_em?: string;
          usado_por?: string | null;
          desfeito_por?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_porta_desfeitas_ingresso_emitido_id_fkey";
            columns: ["ingresso_emitido_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_ingressos_emitidos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_porta_desfeitas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_porta_desfeitas_sessao_id_fkey";
            columns: ["sessao_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_sessoes";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_bilheteiros: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          user_id: string;
          nome: string;
          ativo: boolean;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          user_id: string;
          nome: string;
          ativo?: boolean;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          user_id?: string;
          nome?: string;
          ativo?: boolean;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_bilheteiros_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_bilheteiros_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_porta_links: {
        Row: {
          id: string;
          organization_id: string;
          sessao_id: string;
          rotulo: string;
          token: string;
          valido_ate: string;
          ativo: boolean;
          criado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          sessao_id: string;
          rotulo: string;
          token: string;
          valido_ate: string;
          ativo?: boolean;
          criado_por?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          sessao_id?: string;
          rotulo?: string;
          token?: string;
          valido_ate?: string;
          ativo?: boolean;
          criado_por?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_porta_links_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_porta_links_sessao_id_fkey";
            columns: ["sessao_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_sessoes";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_chaves_publicas: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          chave: string;
          ativa: boolean;
          girada_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          chave: string;
          ativa?: boolean;
          girada_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          chave?: string;
          ativa?: boolean;
          girada_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_chaves_publicas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_chaves_publicas_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: true;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_webhooks: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          url: string;
          segredo: string;
          eventos: string[];
          ativo: boolean;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          url: string;
          segredo: string;
          eventos: string[];
          ativo?: boolean;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          url?: string;
          segredo?: string;
          eventos?: string[];
          ativo?: boolean;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_webhooks_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_webhooks_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_lojas";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_webhook_entregas: {
        Row: {
          id: string;
          organization_id: string;
          webhook_id: string;
          tipo: string;
          dados: Json;
          estado: string;
          tentativas: number;
          proxima_tentativa: string;
          ultimo_status: number | null;
          ultimo_erro: string | null;
          enviada_em: string | null;
          created_at: string;
          atualizada_em: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          webhook_id: string;
          tipo: string;
          dados: Json;
          estado?: string;
          tentativas?: number;
          proxima_tentativa?: string;
          ultimo_status?: number | null;
          ultimo_erro?: string | null;
          enviada_em?: string | null;
          created_at?: string;
          atualizada_em?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          webhook_id?: string;
          tipo?: string;
          dados?: Json;
          estado?: string;
          tentativas?: number;
          proxima_tentativa?: string;
          ultimo_status?: number | null;
          ultimo_erro?: string | null;
          enviada_em?: string | null;
          created_at?: string;
          atualizada_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_webhook_entregas_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_webhook_entregas_webhook_id_fkey";
            columns: ["webhook_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_webhooks";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_site_versoes: {
        Row: {
          id: string;
          organization_id: string;
          pagina_id: string;
          origem: OrigemDaVersao;
          blocos: Json;
          criado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          pagina_id: string;
          origem: OrigemDaVersao;
          blocos: Json;
          criado_por?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          pagina_id?: string;
          origem?: OrigemDaVersao;
          blocos?: Json;
          criado_por?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_site_versoes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticketeria_site_versoes_pagina_id_fkey";
            columns: ["pagina_id"];
            isOneToOne: false;
            referencedRelation: "ticketeria_site_paginas";
            referencedColumns: ["id"];
          },
        ];
      };
      ticketeria_site_imagens: {
        Row: {
          id: string;
          organization_id: string;
          caminho: string;
          nome: string;
          tipo: TipoDeImagem;
          bytes: number;
          largura: number;
          altura: number;
          criado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          caminho: string;
          nome: string;
          tipo: TipoDeImagem;
          bytes: number;
          largura: number;
          altura: number;
          criado_por?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          caminho?: string;
          nome?: string;
          tipo?: TipoDeImagem;
          bytes?: number;
          largura?: number;
          altura?: number;
          criado_por?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticketeria_site_imagens_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
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
      ticketeria_custos_meio: {
        Row: {
          id: string;
          provedor: string;
          meio: MeioDePagamento;
          parcelas_de: number;
          parcelas_ate: number;
          percentual_bps: number;
          fixo_centavos: number;
          vigente_desde: string;
          criado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          provedor?: string;
          meio: MeioDePagamento;
          parcelas_de: number;
          parcelas_ate: number;
          percentual_bps?: number;
          fixo_centavos?: number;
          vigente_desde?: string;
          criado_por?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          provedor?: string;
          meio?: MeioDePagamento;
          parcelas_de?: number;
          parcelas_ate?: number;
          percentual_bps?: number;
          fixo_centavos?: number;
          vigente_desde?: string;
          criado_por?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ticketeria_contas_asaas: {
        Row: {
          id: string;
          organization_id: string;
          loja_id: string;
          asaas_account_id: string;
          wallet_id: string;
          cpf_cnpj: string;
          situacao: string;
          created_at: string;
          updated_at: string;
          chave_secret_id: string | null;
          banco_codigo: string | null;
          agencia: string | null;
          conta: string | null;
          conta_digito: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          loja_id: string;
          asaas_account_id: string;
          wallet_id: string;
          cpf_cnpj: string;
          situacao?: string;
          created_at?: string;
          updated_at?: string;
          chave_secret_id?: string | null;
          banco_codigo?: string | null;
          agencia?: string | null;
          conta?: string | null;
          conta_digito?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          loja_id?: string;
          asaas_account_id?: string;
          wallet_id?: string;
          cpf_cnpj?: string;
          situacao?: string;
          created_at?: string;
          updated_at?: string;
          chave_secret_id?: string | null;
          banco_codigo?: string | null;
          agencia?: string | null;
          conta?: string | null;
          conta_digito?: string | null;
        };
        Relationships: [];
      };
      ticketeria_reembolsos: {
        Row: {
          id: string;
          email_id: string;
          remetente: string;
          assunto: string;
          codigo_lido: string | null;
          recebido_em: string;
          pedido_id: string | null;
          organization_id: string | null;
          situacao: string;
          motivo: string | null;
          valor_centavos: number | null;
          pago_em: string | null;
          estorno_ref: string | null;
          origem: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email_id: string;
          remetente: string;
          assunto: string;
          codigo_lido?: string | null;
          recebido_em: string;
          pedido_id?: string | null;
          organization_id?: string | null;
          situacao?: string;
          motivo?: string | null;
          valor_centavos?: number | null;
          pago_em?: string | null;
          estorno_ref?: string | null;
          origem?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email_id?: string;
          remetente?: string;
          assunto?: string;
          codigo_lido?: string | null;
          recebido_em?: string;
          pedido_id?: string | null;
          organization_id?: string | null;
          situacao?: string;
          motivo?: string | null;
          valor_centavos?: number | null;
          pago_em?: string | null;
          estorno_ref?: string | null;
          origem?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ticketeria_reembolso_links: {
        Row: {
          id: string;
          pedido_id: string;
          token_hash: string;
          pedido_em: string;
          expira_em: string;
          usado_em: string | null;
          invalidado_em: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          pedido_id: string;
          token_hash: string;
          pedido_em?: string;
          expira_em: string;
          usado_em?: string | null;
          invalidado_em?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          pedido_id?: string;
          token_hash?: string;
          pedido_em?: string;
          expira_em?: string;
          usado_em?: string | null;
          invalidado_em?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ticketeria_trocas_de_conta: {
        Row: {
          id: string;
          loja_id: string;
          pedida_por: string;
          banco_codigo: string;
          agencia: string;
          conta: string;
          conta_digito: string | null;
          codigo_hash: string;
          codigo_expira_em: string;
          tentativas: number;
          confirmada_em: string | null;
          efetiva_em: string | null;
          cancelada_em: string | null;
          aplicada_em: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          loja_id: string;
          pedida_por: string;
          banco_codigo: string;
          agencia: string;
          conta: string;
          conta_digito?: string | null;
          codigo_hash: string;
          codigo_expira_em: string;
          tentativas?: number;
          confirmada_em?: string | null;
          efetiva_em?: string | null;
          cancelada_em?: string | null;
          aplicada_em?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          loja_id?: string;
          pedida_por?: string;
          banco_codigo?: string;
          agencia?: string;
          conta?: string;
          conta_digito?: string | null;
          codigo_hash?: string;
          codigo_expira_em?: string;
          tentativas?: number;
          confirmada_em?: string | null;
          efetiva_em?: string | null;
          cancelada_em?: string | null;
          aplicada_em?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ticketeria_ingressos_emitidos: {
        Row: {
          id: string;
          organization_id: string;
          pedido_id: string;
          item_id: string;
          ingresso_id: string;
          sessao_id: string;
          codigo: string;
          nome: string;
          assento_rotulo: string | null;
          preco_centavos: number;
          usado_em: string | null;
          cancelado_em: string | null;
          usado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          pedido_id: string;
          item_id: string;
          ingresso_id: string;
          sessao_id: string;
          codigo: string;
          nome: string;
          assento_rotulo?: string | null;
          preco_centavos: number;
          usado_em?: string | null;
          cancelado_em?: string | null;
          usado_por?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          pedido_id?: string;
          item_id?: string;
          ingresso_id?: string;
          sessao_id?: string;
          codigo?: string;
          nome?: string;
          assento_rotulo?: string | null;
          preco_centavos?: number;
          usado_em?: string | null;
          cancelado_em?: string | null;
          usado_por?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ticketeria_validacoes_saque: {
        Row: {
          id: string;
          provedor: string;
          tipo: string;
          id_externo: string;
          cpf_cnpj: string | null;
          valor_centavos: number;
          decisao: string;
          motivo: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          provedor?: string;
          tipo: string;
          id_externo: string;
          cpf_cnpj?: string | null;
          valor_centavos: number;
          decisao: string;
          motivo: string;
          payload: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          provedor?: string;
          tipo?: string;
          id_externo?: string;
          cpf_cnpj?: string | null;
          valor_centavos?: number;
          decisao?: string;
          motivo?: string;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      ticketeria_transferencias_autorizadas: {
        Row: {
          id: string;
          tipo: string;
          valor_centavos: number;
          motivo: string;
          expira_em: string;
          usada_em: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tipo: string;
          valor_centavos: number;
          motivo: string;
          expira_em?: string;
          usada_em?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tipo?: string;
          valor_centavos?: number;
          motivo?: string;
          expira_em?: string;
          usada_em?: string | null;
          created_at?: string;
        };
        Relationships: [];
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
      // A pessoa logada chama: as lojas em que ela é bilheteira ligada ([{ id, loja_id, loja, nome }]).
      fn_ticketeria_bilheteiro_atual: {
        Args: Record<string, never>;
        Returns: Json;
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
      fn_ticketeria_reservar_com_cupom: {
        Args: { p_sessao: string; p_itens: Json; p_nome: string; p_email: string; p_minutos: number; p_codigo: string | null };
        Returns: Json;
      };
      fn_ticketeria_aplicar_cupom: {
        Args: { p_pedido: string; p_codigo: string };
        Returns: Json;
      };
      fn_ticketeria_cupom_conferir: {
        Args: { p_sessao: string; p_codigo: string; p_fora?: string | null; p_travar?: boolean };
        Returns: Json;
      };
      fn_ticketeria_livres: {
        Args: { p_sessao: string; p_ingresso: string };
        Returns: number;
      };
      fn_ticketeria_espera_entrar: {
        Args: { p_sessao: string; p_ingresso: string; p_nome: string; p_email: string; p_quantidade: number };
        Returns: string;
      };
      fn_ticketeria_espera_sair: {
        Args: { p_token: string };
        Returns: boolean;
      };
      fn_ticketeria_novidades_sair: {
        Args: { p_token: string };
        Returns: boolean;
      };
      fn_ticketeria_espera_avisar: {
        Args: { p_loja: string; p_sessao: string; p_ingresso: string; p_quantas: number };
        Returns: Json;
      };
      fn_ticketeria_espera_desfazer_aviso: {
        Args: { p_ids: string[] };
        Returns: number;
      };
      fn_ticketeria_salvar_mapa: {
        Args: { p_setor: string; p_fileiras: Json; p_corredor?: boolean };
        Returns: Json;
      };
      fn_ticketeria_mapa_do_setor: {
        Args: { p_setor: string };
        Returns: Json;
      };
      fn_ticketeria_reservar_com_lugares: {
        Args: { p_sessao: string; p_itens: Json; p_nome: string; p_email: string; p_minutos: number; p_codigo: string | null; p_lugares: Json | null };
        Returns: Json;
      };
      fn_ticketeria_mapa_da_sessao: {
        Args: { p_sessao: string; p_ingresso: string };
        Returns: Json;
      };
      fn_ticketeria_lugares_livres_do_setor: {
        Args: { p_sessao: string; p_setor: string };
        Returns: number;
      };
      fn_ticketeria_porta_buscar: {
        Args: { p_loja: string; p_sessao: string; p_termo: string };
        Returns: Json;
      };
      fn_ticketeria_porta_desfazer: {
        Args: { p_loja: string; p_sessao: string; p_codigo: string; p_usuario: string | null };
        Returns: Json;
      };
      fn_ticketeria_porta_relatorio: {
        Args: { p_loja: string; p_sessao: string };
        Returns: Json;
      };
      fn_ticketeria_porta_lista: {
        Args: { p_loja: string; p_sessao: string };
        Returns: Json;
      };
      fn_ticketeria_chave_publica_garantir: {
        Args: { p_loja: string };
        Returns: Json;
      };
      fn_ticketeria_chave_publica_girar: {
        Args: { p_loja: string };
        Returns: Json;
      };
      fn_ticketeria_chave_publica_ligar: {
        Args: { p_loja: string; p_ligada: boolean };
        Returns: Json;
      };
      fn_ticketeria_chave_publica_resolver: {
        Args: { p_chave: string };
        Returns: Json;
      };
      fn_ticketeria_webhooks_enfileirar: {
        Args: { p_loja: string; p_tipo: string; p_dados: Json };
        Returns: number;
      };
      fn_ticketeria_webhook_criar: {
        Args: { p_loja: string; p_url: string; p_eventos: string[]; p_usuario: string | null };
        Returns: Json;
      };
      fn_ticketeria_webhook_mudar: {
        Args: { p_loja: string; p_id: string; p_url: string | null; p_eventos: string[] | null; p_ativo: boolean | null };
        Returns: boolean;
      };
      fn_ticketeria_webhook_girar: {
        Args: { p_loja: string; p_id: string };
        Returns: Json;
      };
      fn_ticketeria_webhook_apagar: {
        Args: { p_loja: string; p_id: string };
        Returns: boolean;
      };
      fn_ticketeria_webhook_teste: {
        Args: { p_loja: string; p_id: string };
        Returns: string;
      };
      fn_ticketeria_webhook_entregas: {
        Args: { p_loja: string; p_id: string; p_limite: number };
        Returns: Json;
      };
      fn_ticketeria_webhooks_reivindicar: {
        Args: { p_limite: number };
        Returns: Json;
      };
      fn_ticketeria_webhooks_registrar: {
        Args: { p_entrega: string; p_ok: boolean; p_status: number | null; p_erro: string | null };
        Returns: string;
      };
      fn_ticketeria_webhooks_limpar: {
        Args: { p_dias: number };
        Returns: number;
      };
      fn_ticketeria_site_restaurar_versao: {
        Args: { p_versao: string };
        Returns: Json;
      };
      fn_ticketeria_porta_link_criar: {
        Args: { p_loja: string; p_sessao: string; p_rotulo: string; p_usuario: string | null };
        Returns: Json;
      };
      fn_ticketeria_porta_link_listar: {
        Args: { p_loja: string; p_sessao: string };
        Returns: Json;
      };
      fn_ticketeria_porta_link_revogar: {
        Args: { p_loja: string; p_link: string };
        Returns: boolean;
      };
      fn_ticketeria_porta_equipe_resumo: {
        Args: { p_token: string };
        Returns: Json;
      };
      fn_ticketeria_porta_equipe_conferir: {
        Args: { p_token: string; p_codigo: string };
        Returns: Json;
      };
      fn_ticketeria_porta_equipe_buscar: {
        Args: { p_token: string; p_termo: string };
        Returns: Json;
      };
      fn_ticketeria_definir_meio: {
        Args: { p_pedido: string; p_meio: MeioDePagamento; p_parcelas: number | null };
        Returns: Json;
      };
      fn_ticketeria_custo_do_meio: {
        Args: { p_provedor: string; p_meio: MeioDePagamento; p_parcelas: number | null; p_liquido_centavos: number };
        Returns: number;
      };
      fn_ticketeria_confirmar_pagamento: {
        Args: { p_pedido: string; p_provedor: string; p_ref: string; p_valor_centavos: number };
        Returns: string;
      };
      fn_ticketeria_registrar_conta_asaas: {
        Args: { p_loja: string; p_asaas_account_id: string; p_wallet_id: string; p_cpf_cnpj: string; p_chave: string; p_situacao?: string };
        Returns: string;
      };
      fn_ticketeria_definir_conta_destino: {
        Args: { p_loja: string; p_banco: string; p_agencia: string; p_conta: string; p_digito?: string | null };
        Returns: string;
      };
      fn_ticketeria_chave_da_conta_asaas: {
        Args: { p_loja: string };
        Returns: string | null;
      };
      fn_ticketeria_situacao_da_conta_asaas: {
        Args: { p_loja: string; p_situacao: string };
        Returns: string;
      };
      fn_ticketeria_aplicar_trocas_vencidas: {
        Args: Record<string, never>;
        Returns: number;
      };
      fn_ticketeria_troca_pedir: {
        Args: { p_loja: string; p_user: string; p_banco: string; p_agencia: string; p_conta: string; p_digito: string | null; p_codigo_hash: string; p_codigo_expira_em: string };
        Returns: string;
      };
      fn_ticketeria_troca_confirmar: {
        Args: { p_loja: string; p_user: string; p_codigo_hash: string };
        Returns: Json;
      };
      fn_ticketeria_troca_cancelar: {
        Args: { p_loja: string };
        Returns: number;
      };
      fn_ticketeria_troca_estado: {
        Args: { p_loja: string };
        Returns: Json;
      };
      fn_ticketeria_ocupados: {
        Args: { p_sessao: string; p_lote: string; p_fora?: string | null };
        Returns: number;
      };
      fn_ticketeria_reembolso_registrar: {
        Args: { p_email_id: string; p_remetente: string; p_assunto: string; p_codigo: string | null; p_recebido_em: string };
        Returns: Json;
      };
      fn_ticketeria_pedido_para_reembolso: {
        Args: { p_codigo: string };
        Returns: Json;
      };
      fn_ticketeria_reembolso_reivindicar: {
        Args: { p_reembolso: string; p_pedido: string };
        Returns: boolean;
      };
      fn_ticketeria_reembolso_marcar: {
        Args: { p_reembolso: string; p_situacao: string; p_motivo: string; p_pedido?: string | null };
        Returns: undefined;
      };
      fn_ticketeria_reembolso_autorizar_estorno: {
        Args: { p_reembolso: string };
        Returns: string;
      };
      fn_ticketeria_reembolso_concluir: {
        Args: { p_reembolso: string; p_partidas: Json; p_estorno_ref: string };
        Returns: Json;
      };
      fn_ticketeria_conferir_ingresso: {
        Args: { p_loja: string; p_sessao: string; p_codigo: string; p_usuario: string | null };
        Returns: Json;
      };
      fn_ticketeria_porta_resumo: {
        Args: { p_loja: string; p_sessao: string };
        Returns: Json;
      };
      fn_ticketeria_reembolso_reabrir: {
        Args: { p_reembolso: string; p_loja: string };
        Returns: Json;
      };
      fn_ticketeria_reembolso_link_pedir: {
        Args: { p_pedido: string; p_hash: string };
        Returns: Json;
      };
      fn_ticketeria_reembolso_link_ver: {
        Args: { p_pedido: string; p_hash: string };
        Returns: Json;
      };
      fn_ticketeria_reembolso_link_consumir: {
        Args: { p_pedido: string; p_hash: string };
        Returns: Json;
      };
      fn_ticketeria_midia_guardar_conexao: {
        Args: { p_loja: string; p_provedor: string; p_token: string; p_expira_em: string | null };
        Returns: string;
      };
      fn_ticketeria_midia_token: {
        Args: { p_conexao: string };
        Returns: string | null;
      };
      fn_ticketeria_midia_escolher_conta: {
        Args: { p_conexao: string; p_conta: string; p_nome: string; p_moeda: string };
        Returns: undefined;
      };
      fn_ticketeria_midia_gravar_dias: {
        Args: { p_conexao: string; p_dias: Json };
        Returns: number;
      };
      fn_ticketeria_midia_marcar: {
        Args: { p_conexao: string; p_ok: boolean; p_erro: string | null; p_token_invalido: boolean; p_lido_desde: string | null };
        Returns: undefined;
      };
      fn_ticketeria_midia_definir_gerente: {
        Args: { p_conexao: string; p_gerente: string | null };
        Returns: undefined;
      };
      fn_ticketeria_midia_gravar_visitas: {
        Args: { p_conexao: string; p_visitas: Json };
        Returns: number;
      };
      fn_ticketeria_historico_importar: {
        Args: { p_loja: string; p_tipo: string; p_arquivo: string; p_linhas: Json };
        Returns: string;
      };
      fn_ticketeria_historico_desfazer: {
        Args: { p_importacao: string; p_loja: string };
        Returns: undefined;
      };
      fn_ticketeria_mmm_gravar: {
        Args: { p_loja: string; p_resultado: Json };
        Returns: string;
      };
      fn_ticketeria_mmm_falhou: {
        Args: { p_loja: string; p_motivo: string };
        Returns: string;
      };
      fn_ticketeria_midia_desconectar: {
        Args: { p_conexao: string };
        Returns: undefined;
      };
      fn_ticketeria_registrar_aceite: {
        Args: { p_pedido: string; p_versao: string };
        Returns: undefined;
      };
      fn_ticketeria_registrar_novidades: {
        Args: { p_pedido: string; p_versao: string; p_whatsapp: string | null };
        Returns: undefined;
      };
      fn_ticketeria_registrar_origem: {
        Args: { p_pedido: string; p_canal: string | null; p_acao: string | null; p_referencia: string | null; p_utm: Json | null };
        Returns: undefined;
      };
      fn_ticketeria_emitir_ingressos: {
        Args: { p_pedido: string };
        Returns: number;
      };
      fn_ticketeria_reivindicar_envio: {
        Args: { p_pedido: string };
        Returns: boolean;
      };
      fn_ticketeria_liberar_envio: {
        Args: { p_pedido: string };
        Returns: undefined;
      };
      fn_ticketeria_ingressos_do_pedido: {
        Args: { p_pedido: string };
        Returns: Json;
      };
      fn_ticketeria_validar_saque: {
        Args: { p_tipo: string; p_id_externo: string; p_destino: string; p_cpf_cnpj: string | null; p_valor_centavos: number; p_payload: Json; p_provedor?: string };
        Returns: Json;
      };
      fn_ticketeria_saldo_liberavel: {
        Args: { p_cpf_cnpj: string; p_agora?: string };
        Returns: number;
      };
      fn_ticketeria_confirmar_pagamento_real: {
        Args: { p_pedido: string; p_provedor: string; p_ref: string; p_valor_centavos: number; p_liquido_centavos: number | null };
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
