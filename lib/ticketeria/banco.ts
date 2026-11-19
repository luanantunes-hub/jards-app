// O tipo do banco só da Ticketeria (T1 do plano em docs/acoes-futuras/estudos/plano-modulo-ticketeria.md).
//
// O `Database` do app (lib/supabase/types.ts) é escrito à mão e não tem as tabelas dos módulos novos; a Produção tem o
// dela em lib/producao/banco.ts. Este arquivo faz o mesmo para a Ticketeria, no formato que o @supabase/supabase-js espera
// de um `Database`: o cliente de cliente.ts faz o compilador acusar tabela, coluna e valor de lista fechada que não existem.
//
// De onde vêm os dados: supabase/migrations/20261118233242_ticketeria_lojas_site.sql (T1) e 20261119002840_ticketeria_eventos.sql (T2), conferidas contra o gerador do conector
// (supabase gen types) em 18/11/2026, depois de aplicada: as mesmas colunas e anulabilidade. tests/ticketeria-banco-tipos.test.ts compara este arquivo com a migration.
// Relationships não lista as chaves para auth.users (`criado_por`): o PostgREST só expõe o schema public.

import type { ClassificacaoIndicativa, SituacaoDoDominio, SituacaoDoEvento, SituacaoDoSite } from "@/lib/ticketeria/estados";
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
