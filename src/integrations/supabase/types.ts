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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      configuracion: {
        Row: {
          consultorio_id: string
          created_at: string
          duracion_turno: number
          hora_fin: string
          hora_inicio: string
          id: string
          timer_minutos: number
          updated_at: string
          ventana_horaria: number
        }
        Insert: {
          consultorio_id: string
          created_at?: string
          duracion_turno?: number
          hora_fin?: string
          hora_inicio?: string
          id?: string
          timer_minutos?: number
          updated_at?: string
          ventana_horaria?: number
        }
        Update: {
          consultorio_id?: string
          created_at?: string
          duracion_turno?: number
          hora_fin?: string
          hora_inicio?: string
          id?: string
          timer_minutos?: number
          updated_at?: string
          ventana_horaria?: number
        }
        Relationships: []
      }
      consultorios: {
        Row: {
          created_at: string
          direccion: string
          especialidades: string[]
          id: string
          nombre: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          direccion: string
          especialidades?: string[]
          id?: string
          nombre: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          direccion?: string
          especialidades?: string[]
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lista_espera: {
        Row: {
          activo: boolean
          created_at: string
          fecha_registro: string
          id: string
          medico_id: string
          notas: string | null
          paciente_id: string
          prioridad: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          fecha_registro?: string
          id?: string
          medico_id: string
          notas?: string | null
          paciente_id: string
          prioridad?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          fecha_registro?: string
          id?: string
          medico_id?: string
          notas?: string | null
          paciente_id?: string
          prioridad?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lista_espera_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_espera_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      medicos: {
        Row: {
          apellido: string
          consultorio_id: string
          created_at: string
          dias_atencion: number[]
          duracion_turno: number
          especialidad: string
          hora_fin: string
          hora_inicio: string
          id: string
          matricula: string
          nombre: string
          updated_at: string
        }
        Insert: {
          apellido: string
          consultorio_id: string
          created_at?: string
          dias_atencion?: number[]
          duracion_turno?: number
          especialidad: string
          hora_fin?: string
          hora_inicio?: string
          id?: string
          matricula: string
          nombre: string
          updated_at?: string
        }
        Update: {
          apellido?: string
          consultorio_id?: string
          created_at?: string
          dias_atencion?: number[]
          duracion_turno?: number
          especialidad?: string
          hora_fin?: string
          hora_inicio?: string
          id?: string
          matricula?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicos_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          created_at: string
          estado: Database["public"]["Enums"]["notificacion_estado"]
          id: string
          orden: number
          paciente_id: string
          respondido_at: string | null
          timer_expira_at: string
          turno_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: Database["public"]["Enums"]["notificacion_estado"]
          id?: string
          orden?: number
          paciente_id: string
          respondido_at?: string | null
          timer_expira_at: string
          turno_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: Database["public"]["Enums"]["notificacion_estado"]
          id?: string
          orden?: number
          paciente_id?: string
          respondido_at?: string | null
          timer_expira_at?: string
          turno_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "turnos"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          apellido: string
          celular: string
          consultorio_id: string
          created_at: string
          id: string
          nombre: string
          obra_social: string | null
          optin_adelanto: boolean
          updated_at: string
        }
        Insert: {
          apellido: string
          celular: string
          consultorio_id: string
          created_at?: string
          id?: string
          nombre: string
          obra_social?: string | null
          optin_adelanto?: boolean
          updated_at?: string
        }
        Update: {
          apellido?: string
          celular?: string
          consultorio_id?: string
          created_at?: string
          id?: string
          nombre?: string
          obra_social?: string | null
          optin_adelanto?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
        ]
      }
      turnos: {
        Row: {
          cancelado_at: string | null
          created_at: string
          cubierto_at: string | null
          cubierto_por_paciente_id: string | null
          fecha: string
          hora: string
          id: string
          medico_id: string
          motivo: string | null
          notas: string | null
          paciente_id: string | null
          paciente_original_id: string | null
          status: Database["public"]["Enums"]["turno_status"]
          updated_at: string
        }
        Insert: {
          cancelado_at?: string | null
          created_at?: string
          cubierto_at?: string | null
          cubierto_por_paciente_id?: string | null
          fecha: string
          hora: string
          id?: string
          medico_id: string
          motivo?: string | null
          notas?: string | null
          paciente_id?: string | null
          paciente_original_id?: string | null
          status?: Database["public"]["Enums"]["turno_status"]
          updated_at?: string
        }
        Update: {
          cancelado_at?: string | null
          created_at?: string
          cubierto_at?: string | null
          cubierto_por_paciente_id?: string | null
          fecha?: string
          hora?: string
          id?: string
          medico_id?: string
          motivo?: string | null
          notas?: string | null
          paciente_id?: string | null
          paciente_original_id?: string | null
          status?: Database["public"]["Enums"]["turno_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "turnos_cubierto_por_paciente_id_fkey"
            columns: ["cubierto_por_paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_paciente_original_id_fkey"
            columns: ["paciente_original_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      notificacion_estado:
        | "enviado"
        | "entregado"
        | "leido"
        | "confirmado"
        | "rechazado"
        | "expirado"
        | "cancelado"
      turno_status:
        | "confirmado"
        | "pendiente"
        | "caido"
        | "en_proceso"
        | "cubierto"
        | "libre"
        | "sin_cubrir"
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
      notificacion_estado: [
        "enviado",
        "entregado",
        "leido",
        "confirmado",
        "rechazado",
        "expirado",
        "cancelado",
      ],
      turno_status: [
        "confirmado",
        "pendiente",
        "caido",
        "en_proceso",
        "cubierto",
        "libre",
        "sin_cubrir",
      ],
    },
  },
} as const
