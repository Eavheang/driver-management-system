import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DailyScheduleReport } from "@/components/reports/daily-schedule-report"
import { OvertimeReport } from "@/components/reports/overtime-report"
import { getSupabaseServer } from "@/lib/supabase/server"

export default async function ReportsPage() {
  const supabase = getSupabaseServer()

  // Fetch drivers
  const { data: drivers } = await supabase.from("drivers").select("id, name, staff_id, car_number").order("name")

  // Fetch shifts
  const { data: shifts } = await supabase.from("shifts").select("id, name, start_time, end_time").order("name")

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Reports</h1>

      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList>
          <TabsTrigger value="daily">Daily Schedule</TabsTrigger>
          <TabsTrigger value="overtime">Overtime</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle>Daily Schedule Report</CardTitle>
              <CardDescription>View and export daily driver schedules and replacements</CardDescription>
            </CardHeader>
            <CardContent>
              <DailyScheduleReport drivers={drivers || []} shifts={shifts || []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overtime">
          <Card>
            <CardHeader>
              <CardTitle>Overtime Report</CardTitle>
              <CardDescription>View and export driver overtime records</CardDescription>
            </CardHeader>
            <CardContent>
              <OvertimeReport drivers={drivers || []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
