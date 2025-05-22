import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSupabaseServer } from "@/lib/supabase/server"
import { ArrowLeft, Edit } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { DeleteDriverButton } from "@/components/delete-driver-button"

export default async function DriverDetailPage({
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
        is_primary,
        shifts (
          id,
          name,
          start_time,
          end_time
        )
      )
    `)
    .eq("id", params.id)
    .single()

  if (error || !driver) {
    notFound()
  }

  return (
    <div className="container py-10">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="sm" asChild className="mr-4">
          <Link href="/drivers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Drivers
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">{driver.name}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Driver Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Staff ID:</div>
                <div>{driver.staff_id}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Car Number:</div>
                <div>{driver.car_number || "N/A"}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Contact Number:</div>
                <div>{driver.contact_number || "N/A"}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Created:</div>
                <div>{new Date(driver.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assigned Shifts</CardTitle>
          </CardHeader>
          <CardContent>
            {driver.driver_shifts && driver.driver_shifts.length > 0 ? (
              <div className="space-y-4">
                {driver.driver_shifts.map((ds) => (
                  <div key={ds.id} className="p-3 border rounded-md">
                    <div className="font-medium">{ds.shifts?.name}</div>
                    {ds.shifts?.start_time && ds.shifts?.end_time && (
                      <div className="text-sm text-muted-foreground">
                        {ds.shifts.start_time.substring(0, 5)} - {ds.shifts.end_time.substring(0, 5)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground">No shifts assigned</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end space-x-4 mt-6">
        <DeleteDriverButton driverId={driver.id} />
        <Button asChild>
          <Link href={`/drivers/${driver.id}/edit`}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Driver
          </Link>
        </Button>
      </div>
    </div>
  )
}
