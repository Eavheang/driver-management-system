import { DriverForm } from "@/components/driver-form"
import { getSupabaseServer } from "@/lib/supabase/server"
import { notFound } from "next/navigation"

export default async function EditDriverPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = getSupabaseServer()

  // Fetch driver details
  const { data: driver, error } = await supabase
    .from("drivers")
    .select(`
      *,
      driver_shifts (
        id,
        shift_id,
        is_primary
      )
    `)
    .eq("id", params.id)
    .single()

  if (error || !driver) {
    notFound()
  }

  // Fetch shifts
  const { data: shifts } = await supabase.from("shifts").select("id, name, start_time, end_time").order("name")

  // Prepare initial data for the form
  const initialData = {
    ...driver,
    shifts:
      shifts?.map((shift) => ({
        id: shift.id,
        is_primary: driver.driver_shifts.some((ds) => ds.shift_id === shift.id && ds.is_primary),
      })) || [],
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Edit Driver</h1>
      <DriverForm shifts={shifts || []} initialData={initialData} />
    </div>
  )
}
