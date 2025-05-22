import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getSupabaseServer } from "@/lib/supabase/server"
import { Calendar, Clock, Users, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { DatabaseConnectionStatus } from "@/components/database-connection-status"
import { cn } from "@/lib/utils"
import type { Database } from "@/lib/supabase/database.types"

type OvertimeRecord = Database["public"]["Tables"]["overtime_records"]["Row"]
type Schedule = Database["public"]["Tables"]["schedules"]["Row"] & {
  replacements: Array<{ id: string }>
}

export default async function Home() {
  const supabase = getSupabaseServer()

  // Get current date and month range
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  // Fetch counts for dashboard with error handling
  let driversCount = 0
  let totalOvertimeHours = 0
  let pendingReplacements = 0
  let fetchError = null

  try {
    // Fetch drivers count
    const { count: dCount, error: dError } = await supabase
      .from("drivers")
      .select("id", { count: "exact", head: true })

    if (dError) throw dError
    driversCount = dCount || 0

    // Fetch total overtime hours for current month
    const { data: overtimeData, error: otError } = await supabase
      .from("overtime_records")
      .select("hours")
      .gte("date", startOfMonth.toISOString().split("T")[0])
      .lte("date", endOfMonth.toISOString().split("T")[0])
      .returns<Pick<OvertimeRecord, "hours">[]>()

    if (otError) throw otError
    totalOvertimeHours = overtimeData?.reduce((sum, record) => sum + (record.hours || 0), 0) || 0

    // Fetch pending replacements (schedules with day off or annual leave but no replacement)
    const { data: scheduleData, error: sError } = await supabase
      .from("schedules")
      .select(`
        id,
        replacements (id)
      `)
      .gte("date", today.toISOString().split("T")[0])
      .or("is_day_off.eq.true,is_annual_leave.eq.true")
      .returns<Schedule[]>()

    if (sError) throw sError
    pendingReplacements = scheduleData?.filter(schedule => 
      schedule && Array.isArray(schedule.replacements) && schedule.replacements.length === 0
    )?.length || 0

  } catch (err) {
    console.error("Failed to fetch dashboard data:", err)
    fetchError = err instanceof Error ? err.message : "Unknown error occurred"
  }

  const formattedDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      <div className="mb-6">
        <DatabaseConnectionStatus />
      </div>

      {fetchError && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6" role="alert">
          <p className="font-bold">Warning</p>
          <p>There was an issue connecting to the database: {fetchError}</p>
          <p className="text-sm mt-2">Some features may not work correctly until this is resolved.</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{driversCount}</div>
            <p className="text-xs text-muted-foreground">Registered drivers in the system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Date</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formattedDate}</div>
            <p className="text-xs text-muted-foreground">View today's schedule</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overtime Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOvertimeHours.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Total overtime hours this month</p>
          </CardContent>
        </Card>

        <Link href="/schedule" className="block">
          <Card className={pendingReplacements > 0 ? "border-red-500" : undefined}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Replacements</CardTitle>
              <AlertTriangle className={cn("h-4 w-4", pendingReplacements > 0 ? "text-red-500" : "text-muted-foreground")} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingReplacements}</div>
              <p className="text-xs text-muted-foreground">Drivers needing replacement</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and actions</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Link href="/schedule" className="flex items-center p-3 rounded-lg hover:bg-muted">
              <Calendar className="mr-2 h-5 w-5" />
              <div>View Monthly Schedule</div>
            </Link>
            <Link href="/drivers/new" className="flex items-center p-3 rounded-lg hover:bg-muted">
              <Users className="mr-2 h-5 w-5" />
              <div>Add New Driver</div>
            </Link>
            <Link href="/reports" className="flex items-center p-3 rounded-lg hover:bg-muted">
              <Clock className="mr-2 h-5 w-5" />
              <div>Generate Reports</div>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Overview</CardTitle>
            <CardDescription>Driver schedule management system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>This system helps you manage driver schedules across three shifts:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Morning Shift (7:00am to 16:00pm)</li>
              <li>Afternoon shift (16:00pm to 0:00am)</li>
              <li>Night shift (0:00am to 7:00am)</li>
              <li>Project driver (8:30am to 18:00pm)</li>
            </ul>
            <p>You can manage day-offs, replacements, and generate reports for driver schedules.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
