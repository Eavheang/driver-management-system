export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      drivers: {
        Row: {
          id: string
          name: string
          staff_id: string
          car_number: string | null
          contact_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          staff_id: string
          car_number?: string | null
          contact_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          staff_id?: string
          car_number?: string | null
          contact_number?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      shifts: {
        Row: {
          id: string
          name: string
          start_time: string
          end_time: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          start_time: string
          end_time: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          start_time?: string
          end_time?: string
          created_at?: string
          updated_at?: string
        }
      }
      driver_shifts: {
        Row: {
          id: string
          driver_id: string
          shift_id: string
          is_primary: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          driver_id: string
          shift_id: string
          is_primary?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          driver_id?: string
          shift_id?: string
          is_primary?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      schedules: {
        Row: {
          id: string
          driver_id: string
          date: string
          is_day_off: boolean
          is_annual_leave: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          driver_id: string
          date: string
          is_day_off?: boolean
          is_annual_leave?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          driver_id?: string
          date?: string
          is_day_off?: boolean
          is_annual_leave?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      replacements: {
        Row: {
          id: string
          schedule_id: string
          replacement_driver_id: string
          shift_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          schedule_id: string
          replacement_driver_id: string
          shift_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          schedule_id?: string
          replacement_driver_id?: string
          shift_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      overtime_records: {
        Row: {
          id: string
          driver_id: string
          date: string
          hours: number
          ot_type: 'replacement' | 'extension' | 'special'
          ot_rate: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          driver_id: string
          date: string
          hours: number
          ot_type: 'replacement' | 'extension' | 'special'
          ot_rate?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          driver_id?: string
          date?: string
          hours?: number
          ot_type?: 'replacement' | 'extension' | 'special'
          ot_rate?: number
          created_at?: string
          updated_at?: string
        }
      }
      holidays: {
        Row: {
          id: string
          name: string
          date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          date?: string
          created_at?: string
          updated_at?: string
        }
      }
      driver_monthly_dayoff: {
        Row: {
          id: string
          driver_id: string
          month: number
          year: number
          day_of_week: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          driver_id: string
          month: number
          year: number
          day_of_week: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          driver_id?: string
          month?: number
          year?: number
          day_of_week?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
