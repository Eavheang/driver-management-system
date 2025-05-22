import { DriverForm } from "@/components/driver-form"
import { getSupabaseServer } from "@/lib/supabase/server"

export default async function NewDriverPage() {
  const supabase = getSupabaseServer()

  // Fetch shifts for the form
  const { data: shifts } = await supabase.from("shifts").select("id, name, start_time, end_time").order("name")

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Add New Driver</h1>
      <DriverForm shifts={shifts || []} />
    </div>
  )
}
