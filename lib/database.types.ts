/**
 * lib/database.types.ts
 * Tipos gerados manualmente para espelhar supabase/schema.sql.
 *
 * Cada tabela inclui obrigatoriamente Row / Insert / Update / Relationships
 * para que o cliente `@supabase/supabase-js` NUNCA colapse os tipos de
 * insert/update para `never[]` (bug comum quando `Relationships` é omitido
 * ou tipado incorretamente).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string;
          auth_user_id: string;
          nome: string;
          email: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          nome: string;
          email: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string;
          nome?: string;
          email?: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      operacoes: {
        Row: {
          id: string;
          usuario_id: string;
          tipo: 'deposito' | 'saque' | 'aposta' | 'ganho' | 'ajuste' | 'taxa';
          valor: number;
          descricao: string;
          data: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          tipo: 'deposito' | 'saque' | 'aposta' | 'ganho' | 'ajuste' | 'taxa';
          valor: number;
          descricao: string;
          data?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          tipo?: 'deposito' | 'saque' | 'aposta' | 'ganho' | 'ajuste' | 'taxa';
          valor?: number;
          descricao?: string;
          data?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'operacoes_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      extrato: {
        Row: {
          id: string;
          usuario_id: string;
          operacao_id: string;
          saldo_apos: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          operacao_id: string;
          saldo_apos: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          operacao_id?: string;
          saldo_apos?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'extrato_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'extrato_operacao_id_fkey';
            columns: ['operacao_id'];
            isOneToOne: false;
            referencedRelation: 'operacoes';
            referencedColumns: ['id'];
          },
        ];
      };
      metas: {
        Row: {
          id: string;
          usuario_id: string;
          titulo: string;
          valor_alvo: number;
          quantidade_alvo: number | null;
          quantidade_atual: number;
          concluida: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          titulo: string;
          valor_alvo: number;
          quantidade_alvo?: number | null;
          quantidade_atual?: number;
          concluida?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          titulo?: string;
          valor_alvo?: number;
          quantidade_alvo?: number | null;
          quantidade_atual?: number;
          concluida?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'metas_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      activity_feed: {
        Row: {
          id: string;
          usuario_id: string;
          tipo_evento: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          tipo_evento: string;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          tipo_evento?: string;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_feed_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      vw_saldo_atual: {
        Row: {
          usuario_id: string;
          saldo: number;
          atualizado_em: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vw_saldo_atual_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: true;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      checar_progresso_metas_qtd_dep: {
        Args: { p_usuario_id: string };
        Returns: void;
      };
      obter_saldo_usuario: {
        Args: { p_usuario_id: string };
        Returns: number;
      };
    };
    Enums: {
      operacao_tipo: 'deposito' | 'saque' | 'aposta' | 'ganho' | 'ajuste' | 'taxa';
    };
    CompositeTypes: Record<string, never>;
  };
}
