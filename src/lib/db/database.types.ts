/**
 * Supabase database types (hand-written; run `supabase gen types typescript`
 * after applying migrations to regenerate automatically)
 *
 * Stack contract: database.engine=postgres, database.provider=supabase
 * NOTE: Every table requires Relationships: [] to satisfy GenericTable constraint in @supabase/supabase-js >= 2.x
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TradeType =
  | "roofer"
  | "painter"
  | "electrician"
  | "plumber"
  | "landscaper";
export type UserRole = "owner" | "member";
export type LeadSource = "da" | "manual" | "inbound_sms";
export type LeadStatus =
  | "new"
  | "generating"
  | "draft_ready"
  | "sent"
  | "delivered"
  | "opened"
  | "won"
  | "lost";
export type QuoteStatus =
  | "draft"
  | "approved"
  | "sent"
  | "accepted"
  | "declined";
export type RateCardSource = "live" | "cached" | "learned";
export type SmsEventType = "sent" | "delivered" | "failed" | "opened";
export type FsmProvider = "servicem8" | "tradify";
export type FollowupStage = "d3" | "d7";
export type LineItemKind = "material" | "labour" | "other";

export interface Database {
  public: {
    Tables: {
      crews: {
        Row: {
          id: string;
          business_name: string;
          trade_type: TradeType;
          nsw_licence_number: string;
          licence_verified: boolean;
          licence_verified_at: string | null;
          default_labour_rate_aud: string;
          abn: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["crews"]["Row"],
          "id" | "created_at" | "updated_at" | "licence_verified"
        > &
          Partial<
            Pick<
              Database["public"]["Tables"]["crews"]["Row"],
              "id" | "licence_verified"
            >
          >;
        Update: Partial<Database["public"]["Tables"]["crews"]["Row"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          crew_id: string;
          phone: string;
          role: UserRole;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["users"]["Row"],
          "created_at"
        > &
          Partial<Pick<Database["public"]["Tables"]["users"]["Row"], "role">>;
        Update: Partial<Database["public"]["Tables"]["users"]["Row"]>;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          crew_id: string;
          source: LeadSource;
          da_reference: string | null;
          customer_name: string;
          customer_mobile: string | null;
          customer_email: string | null;
          address: string | null;
          description: string | null;
          status: LeadStatus;
          sms_disabled_followup: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          crew_id: string;
          source: LeadSource;
          da_reference?: string | null;
          customer_name: string;
          customer_mobile?: string | null;
          customer_email?: string | null;
          address?: string | null;
          description?: string | null;
          status?: LeadStatus;
          sms_disabled_followup?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Row"]>;
        Relationships: [];
      };
      photos: {
        Row: {
          id: string;
          lead_id: string;
          gcs_path: string;
          exif_data: Json | null;
          uploaded_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["photos"]["Row"],
          "id" | "uploaded_at"
        > &
          Partial<Pick<Database["public"]["Tables"]["photos"]["Row"], "id">>;
        Update: Partial<Database["public"]["Tables"]["photos"]["Row"]>;
        Relationships: [];
      };
      quotes: {
        Row: {
          id: string;
          lead_id: string;
          crew_id: string;
          status: QuoteStatus;
          subtotal_aud: string | null;
          gst_aud: string | null;
          total_aud: string | null;
          licence_number_snapshot: string | null;
          licence_verified_snapshot: boolean | null;
          statutory_warranty_text: string | null;
          pdf_gcs_path: string | null;
          pdf_signed_url: string | null;
          pdf_signed_url_expires_at: string | null;
          rate_card_source: RateCardSource;
          created_at: string;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          lead_id: string;
          crew_id: string;
          status?: QuoteStatus;
          subtotal_aud?: string | null;
          gst_aud?: string | null;
          total_aud?: string | null;
          licence_number_snapshot?: string | null;
          licence_verified_snapshot?: boolean | null;
          statutory_warranty_text?: string | null;
          pdf_gcs_path?: string | null;
          pdf_signed_url?: string | null;
          pdf_signed_url_expires_at?: string | null;
          rate_card_source?: RateCardSource;
          sent_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["quotes"]["Row"]>;
        Relationships: [];
      };
      quote_line_items: {
        Row: {
          id: string;
          quote_id: string;
          description: string;
          qty: string;
          unit: string;
          unit_price_aud: string;
          confidence_score: number;
          kind: LineItemKind;
          sort_order: number;
        };
        Insert: Omit<
          Database["public"]["Tables"]["quote_line_items"]["Row"],
          "id" | "kind" | "sort_order"
        > &
          Partial<
            Pick<
              Database["public"]["Tables"]["quote_line_items"]["Row"],
              "id" | "kind" | "sort_order"
            >
          >;
        Update: Partial<
          Database["public"]["Tables"]["quote_line_items"]["Row"]
        >;
        Relationships: [];
      };
      quote_acceptances: {
        Row: {
          id: string;
          quote_id: string;
          accepted_at: string;
          ip_address: string;
          user_agent: string;
          customer_name_snapshot: string;
          retention_until: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["quote_acceptances"]["Row"],
          "id" | "accepted_at"
        > &
          Partial<
            Pick<
              Database["public"]["Tables"]["quote_acceptances"]["Row"],
              "id"
            >
          >;
        Update: never; // immutable audit trail
        Relationships: [];
      };
      quote_ai_usage: {
        Row: {
          id: string;
          quote_id: string;
          model_vision: string;
          model_extraction: string;
          input_tokens: number;
          output_tokens: number;
          cost_aud: string;
          cost_overrun: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["quote_ai_usage"]["Row"],
          "id" | "created_at"
        > &
          Partial<Pick<Database["public"]["Tables"]["quote_ai_usage"]["Row"], "id">>;
        Update: Partial<Database["public"]["Tables"]["quote_ai_usage"]["Row"]>;
        Relationships: [];
      };
      sms_events: {
        Row: {
          id: string;
          quote_id: string;
          twilio_message_sid: string | null;
          event_type: SmsEventType;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          twilio_message_sid?: string | null;
          event_type: SmsEventType;
        };
        Update: never; // append-only event log
        Relationships: [];
      };
      job_completions: {
        Row: {
          id: string;
          lead_id: string;
          crew_id: string;
          quoted_amount_aud: string;
          invoiced_amount_aud: string | null;
          trade_type: TradeType;
          completed_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["job_completions"]["Row"],
          "id" | "completed_at"
        > &
          Partial<
            Pick<Database["public"]["Tables"]["job_completions"]["Row"], "id">
          >;
        Update: Partial<
          Pick<
            Database["public"]["Tables"]["job_completions"]["Row"],
            "invoiced_amount_aud"
          >
        >;
        Relationships: [];
      };
      fsm_connections: {
        Row: {
          id: string;
          crew_id: string;
          provider: FsmProvider;
          encrypted_oauth_token: string;
          expires_at: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["fsm_connections"]["Row"],
          "id" | "created_at"
        > &
          Partial<
            Pick<Database["public"]["Tables"]["fsm_connections"]["Row"], "id">
          >;
        Update: Partial<Database["public"]["Tables"]["fsm_connections"]["Row"]>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth_key: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["push_subscriptions"]["Row"],
          "id" | "created_at"
        > &
          Partial<
            Pick<Database["public"]["Tables"]["push_subscriptions"]["Row"], "id">
          >;
        Update: never;
        Relationships: [];
      };
      rate_card_items: {
        Row: {
          id: string;
          supplier: string;
          sku: string;
          description: string;
          price_aud: string;
          fetched_at: string;
          stale: boolean;
        };
        Insert: Omit<
          Database["public"]["Tables"]["rate_card_items"]["Row"],
          "id" | "stale"
        > &
          Partial<
            Pick<Database["public"]["Tables"]["rate_card_items"]["Row"], "id" | "stale">
          >;
        Update: Partial<Database["public"]["Tables"]["rate_card_items"]["Row"]>;
        Relationships: [];
      };
      rate_card_embeddings: {
        Row: {
          id: string;
          rate_card_item_id: string;
          embedding: string; // vector stored as string
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["rate_card_embeddings"]["Row"],
          "id" | "created_at"
        > &
          Partial<Pick<Database["public"]["Tables"]["rate_card_embeddings"]["Row"], "id">>;
        Update: Partial<Database["public"]["Tables"]["rate_card_embeddings"]["Row"]>;
        Relationships: [];
      };
      followup_schedules: {
        Row: {
          id: string;
          lead_id: string;
          stage: FollowupStage;
          fire_at: string;
          fired: boolean;
        };
        Insert: Omit<
          Database["public"]["Tables"]["followup_schedules"]["Row"],
          "id" | "fired"
        > &
          Partial<
            Pick<
              Database["public"]["Tables"]["followup_schedules"]["Row"],
              "id" | "fired"
            >
          >;
        Update: Partial<
          Database["public"]["Tables"]["followup_schedules"]["Row"]
        >;
        Relationships: [];
      };
    };
    Views: {
      [_: string]: {
        Row: Record<string, unknown>;
        Relationships: never[];
      };
    };
    Functions: {
      crew_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
    };
    Enums: Record<string, never>;
  };
}
