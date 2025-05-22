import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Container } from "@/components/ui/container"
import { getSupabaseServer } from "@/lib/supabase/server"
import { Plus } from "lucide-react"
import Link from "next/link"

export default async function DriversPage() {
  const supabase = getSupabaseServer()

  // Fetch drivers with error handling
  let drivers = []
  let fetchError = null

  try {
    const { data, error } = await supabase
      .from("drivers")
      .select(`
        id,
        name,
        staff_id,
        car_number,
        contact_number,
        driver_shifts (
          id,
          shift_id,
          is_primary,
          shifts (
            id,
            name
          )
        )
      `)
      .order("name")

    if (error) {
      console.error("Error fetching drivers:", error)
      fetchError = error.message
    } else {
      drivers = data || []
    }
  } catch (err) {
    console.error("Failed to fetch drivers:", err)
    fetchError = err instanceof Error ? err.message : "Unknown error occurred"
  }

  return (
    <Container>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Drivers</h1>
        <Button asChild>
          <Link href="/drivers/new" className="flex items-center">
            <Plus className="mr-2 h-4 w-4" />
            Add Driver
          </Link>
        </Button>
      </div>

      {fetchError ? (
        <div className="text-red-500">Error: {fetchError}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {drivers.map((driver: any) => (
            <Link key={driver.id} href={`/drivers/${driver.id}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader>
                  <CardTitle>{driver.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Staff ID</dt>
                      <dd>{driver.staff_id}</dd>
                    </div>
                    {driver.car_number && (
                      <div>
                        <dt className="text-muted-foreground">Car Number</dt>
                        <dd>{driver.car_number}</dd>
                      </div>
                    )}
                    {driver.contact_number && (
                      <div>
                        <dt className="text-muted-foreground">Contact</dt>
                        <dd>{driver.contact_number}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-muted-foreground">Primary Shifts</dt>
                      <dd>
                        {driver.driver_shifts
                          ?.filter((ds: any) => ds.is_primary)
                          .map((ds: any) => ds.shifts?.name)
                          .join(", ") || "None"}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Container>
  )
}
