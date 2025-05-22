import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET() {
  try {
    // Initialize Supabase client
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Define shifts
    const shifts = [
      {
        name: "Morning Shift",
        start_time: "07:00:00",
        end_time: "16:00:00",
      },
      {
        name: "Afternoon Shift",
        start_time: "16:00:00",
        end_time: "00:00:00",
      },
      {
        name: "Night Shift",
        start_time: "00:00:00",
        end_time: "07:00:00",
      },
      {
        name: "Project Driver",
        start_time: "08:30:00",
        end_time: "18:00:00",
      },
    ]

    // Insert shifts
    const { data, error } = await supabase.from("shifts").insert(shifts).select()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: "Shifts seeded successfully",
      data,
    })
  } catch (error) {
    console.error("Error seeding shifts:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to seed shifts",
        error: (error as Error).message,
      },
      { status: 500 },
    )
  }
}
