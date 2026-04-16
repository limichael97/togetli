export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      destination_catalog: {
        Row: {
          average_cost_index: number | null
          average_flight_time_index: number | null
          country: string | null
          created_at: string
          id: string
          image_url: string | null
          name: string
          primary_airport_code: string | null
          region: string | null
          slug: string
          vibe: string | null
        }
        Insert: {
          average_cost_index?: number | null
          average_flight_time_index?: number | null
          country?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          primary_airport_code?: string | null
          region?: string | null
          slug: string
          vibe?: string | null
        }
        Update: {
          average_cost_index?: number | null
          average_flight_time_index?: number | null
          country?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          primary_airport_code?: string | null
          region?: string | null
          slug?: string
          vibe?: string | null
        }
        Relationships: []
      }
      destination_proposals: {
        Row: {
          created_at: string
          custom_name: string | null
          custom_notes: string | null
          destination_catalog_id: string | null
          id: string
          is_recommended: boolean
          proposer_user_id: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_name?: string | null
          custom_notes?: string | null
          destination_catalog_id?: string | null
          id?: string
          is_recommended?: boolean
          proposer_user_id?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_name?: string | null
          custom_notes?: string | null
          destination_catalog_id?: string | null
          id?: string
          is_recommended?: boolean
          proposer_user_id?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "destination_proposals_destination_catalog_id_fkey"
            columns: ["destination_catalog_id"]
            isOneToOne: false
            referencedRelation: "destination_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destination_proposals_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      destination_votes: {
        Row: {
          created_at: string
          destination_proposal_id: string
          id: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          destination_proposal_id: string
          id?: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          destination_proposal_id?: string
          id?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "destination_votes_destination_proposal_id_fkey"
            columns: ["destination_proposal_id"]
            isOneToOne: false
            referencedRelation: "destination_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destination_votes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_days: {
        Row: {
          created_at: string
          day_index: number
          id: string
          label: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_index: number
          id?: string
          label?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_index?: number
          id?: string
          label?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          itinerary_day_id: string
          time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          itinerary_day_id: string
          time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          itinerary_day_id?: string
          time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_items_itinerary_day_id_fkey"
            columns: ["itinerary_day_id"]
            isOneToOne: false
            referencedRelation: "itinerary_days"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_responses: {
        Row: {
          available_date_option_ids: string[]
          created_at: string
          custom_poll_answers: Json
          flight_budget_label: string | null
          id: string
          lodging_budget_label: string | null
          notes: string | null
          submitted_at: string | null
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_date_option_ids?: string[]
          created_at?: string
          custom_poll_answers?: Json
          flight_budget_label?: string | null
          id?: string
          lodging_budget_label?: string | null
          notes?: string | null
          submitted_at?: string | null
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          available_date_option_ids?: string[]
          created_at?: string
          custom_poll_answers?: Json
          flight_budget_label?: string | null
          id?: string
          lodging_budget_label?: string | null
          notes?: string | null
          submitted_at?: string | null
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_responses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          home_airport: string | null
          id: string
          onboarding_completed: boolean
          username: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          home_airport?: string | null
          id: string
          onboarding_completed?: boolean
          username?: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          home_airport?: string | null
          id?: string
          onboarding_completed?: boolean
          username?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      travel_details: {
        Row: {
          arrival_time: string | null
          created_at: string | null
          departure_time: string | null
          flight_number: string | null
          id: string
          notes: string | null
          trip_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          arrival_time?: string | null
          created_at?: string | null
          departure_time?: string | null
          flight_number?: string | null
          id?: string
          notes?: string | null
          trip_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          arrival_time?: string | null
          created_at?: string | null
          departure_time?: string | null
          flight_number?: string | null
          id?: string
          notes?: string | null
          trip_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_details_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_budget_options: {
        Row: {
          created_at: string
          id: string
          is_any: boolean
          label: string
          max_value: number | null
          min_value: number | null
          trip_id: string
          type: Database["public"]["Enums"]["budget_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_any?: boolean
          label: string
          max_value?: number | null
          min_value?: number | null
          trip_id: string
          type: Database["public"]["Enums"]["budget_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_any?: boolean
          label?: string
          max_value?: number | null
          min_value?: number | null
          trip_id?: string
          type?: Database["public"]["Enums"]["budget_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_budget_options_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_date_options: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          label: string | null
          start_date: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          label?: string | null
          start_date: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          label?: string | null
          start_date?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_date_options_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          max_uses: number
          role: Database["public"]["Enums"]["trip_role"]
          token: string
          trip_id: string
          uses: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          max_uses?: number
          role?: Database["public"]["Enums"]["trip_role"]
          token: string
          trip_id: string
          uses?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          max_uses?: number
          role?: Database["public"]["Enums"]["trip_role"]
          token?: string
          trip_id?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "trip_invites_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          can_finalize: boolean
          can_propose: boolean
          can_vote: boolean
          created_at: string
          id: string
          invited_email: string | null
          invited_name: string | null
          is_active: boolean
          role: Database["public"]["Enums"]["trip_role"]
          trip_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          can_finalize?: boolean
          can_propose?: boolean
          can_vote?: boolean
          created_at?: string
          id?: string
          invited_email?: string | null
          invited_name?: string | null
          is_active?: boolean
          role: Database["public"]["Enums"]["trip_role"]
          trip_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          can_finalize?: boolean
          can_propose?: boolean
          can_vote?: boolean
          created_at?: string
          id?: string
          invited_email?: string | null
          invited_name?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["trip_role"]
          trip_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_notes: {
        Row: {
          content: string | null
          created_at: string | null
          created_by: string | null
          id: string
          link: string | null
          title: string | null
          trip_id: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          link?: string | null
          title?: string | null
          trip_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          link?: string | null
          title?: string | null
          trip_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_notes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          created_by: string | null
          creator_id: string
          custom_poll_questions: Json
          final_destination_id: string | null
          final_end_date: string | null
          final_start_date: string | null
          hide_from_creator: boolean
          id: string
          mode: string
          notes: string | null
          planning_mode: string
          poll_sent_at: string | null
          reveal_status: string
          status: string
          title: string | null
          trip_length_days: number | null
          type: Database["public"]["Enums"]["trip_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          creator_id: string
          custom_poll_questions?: Json
          final_destination_id?: string | null
          final_end_date?: string | null
          final_start_date?: string | null
          hide_from_creator?: boolean
          id?: string
          mode?: string
          notes?: string | null
          planning_mode: string
          poll_sent_at?: string | null
          reveal_status?: string
          status?: string
          title?: string | null
          trip_length_days?: number | null
          type: Database["public"]["Enums"]["trip_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          creator_id?: string
          custom_poll_questions?: Json
          final_destination_id?: string | null
          final_end_date?: string | null
          final_start_date?: string | null
          hide_from_creator?: boolean
          id?: string
          mode?: string
          notes?: string | null
          planning_mode?: string
          poll_sent_at?: string | null
          reveal_status?: string
          status?: string
          title?: string | null
          trip_length_days?: number | null
          type?: Database["public"]["Enums"]["trip_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_final_destination_id_fkey"
            columns: ["final_destination_id"]
            isOneToOne: false
            referencedRelation: "destination_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_trip_invite: { Args: { _token: string }; Returns: string }
      create_trip_invite: {
        Args: {
          _role?: Database["public"]["Enums"]["trip_role"]
          _trip_id: string
        }
        Returns: string
      }
      is_trip_admin_or_creator: { Args: { _trip_id: string }; Returns: boolean }
      is_trip_member: { Args: { _trip_id: string }; Returns: boolean }
    }
    Enums: {
      budget_type: "flight" | "lodging"
      trip_role: "creator" | "planner" | "guest"
      trip_type: "bachelor" | "bachelorette" | "joint"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      budget_type: ["flight", "lodging"],
      trip_role: ["creator", "planner", "guest"],
      trip_type: ["bachelor", "bachelorette", "joint"],
    },
  },
} as const
