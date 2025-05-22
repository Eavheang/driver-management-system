import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Container } from "@/components/ui/container"
import { MonthlyCalendar } from "@/components/monthly-calendar"
import { DriverMonthlyDayoff } from "@/components/driver-monthly-dayoff"
import { DriverMonthlyDayoffList } from "@/components/driver-monthly-dayoff-list"
import { getSupabaseServer } from "@/lib/supabase/server"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { cookies } from 'next/headers'

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string }
}) {
  const cookieStore = cookies()
  const supabase = getSupabaseServer()

  // Get current date or from query params
  const today = new Date()
  const month = Number(searchParams?.month ?? (today.getMonth() + 1)) - 1
  const year = Number(searchParams?.year ?? today.getFullYear())

  // Create date object for the selected month
  const selectedDate = new Date(year, month)

  // Fetch all drivers
  const { data: drivers, error: driversError } = await supabase
    .from("drivers")
    .select("*")
    .order("name")

  if (driversError) {
    console.error("Error fetching drivers:", driversError)
  }

  // Fetch all shifts
  const { data: shifts, error: shiftsError } = await supabase
    .from("shifts")
    .select("*")
    .order("start_time")

  if (shiftsError) {
    console.error("Error fetching shifts:", shiftsError)
  }

  // Fetch schedules for the selected month
  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0)

  const { data: schedules, error: schedulesError } = await supabase
    .from("schedules")
    .select(`
      *,
      replacements (
        id,
        replacement_driver_id,
        shift_id,
        shifts (
          id,
          name,
          start_time,
          end_time
        )
      )
    `)
    .gte("date", startDate.toISOString().split("T")[0])
    .lte("date", endDate.toISOString().split("T")[0])

  if (schedulesError) {
    console.error("Error fetching schedules:", schedulesError)
  }

  // Navigation URLs
  const prevMonth = new Date(year, month - 1)
  const nextMonth = new Date(year, month + 1)

  const prevMonthUrl = `/schedule?month=${prevMonth.getMonth() + 1}&year=${prevMonth.getFullYear()}`
  const nextMonthUrl = `/schedule?month=${nextMonth.getMonth() + 1}&year=${nextMonth.getFullYear()}`

  return (
    <Container>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Schedule</h1>
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" asChild>
            <Link href={prevMonthUrl}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h2 className="text-lg font-semibold">
            {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h2>
          <Button variant="outline" size="icon" asChild>
            <Link href={nextMonthUrl}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <DriverMonthlyDayoff
          drivers={drivers || []}
          initialMonth={month + 1}
          initialYear={year}
        />
        <DriverMonthlyDayoffList
          drivers={drivers || []}
          initialMonth={month + 1}
          initialYear={year}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <MonthlyCalendar
            year={year}
            month={month}
            drivers={drivers || []}
            schedules={schedules || []}
            shifts={shifts || []}
          />
        </CardContent>
      </Card>
    </Container>
  )
}
