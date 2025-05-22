"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Download } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from "xlsx"

interface Driver {
  id: string
  name: string
  staff_id: string
  car_number: string | null
}

interface Shift {
  id: string
  name: string
  start_time: string
  end_time: string
}

interface DailyScheduleReportProps {
  drivers: Driver[]
  shifts: Shift[]
}

export function DailyScheduleReport({ drivers, shifts }: DailyScheduleReportProps) {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [isLoading, setIsLoading] = useState(false)
  const [scheduleData, setScheduleData] = useState<any[] | null>(null)
  const { toast } = useToast()

  const fetchDailySchedule = async () => {
    if (!date) return

    setIsLoading(true)
    const supabase = getSupabaseClient()
    const dateStr = date.toISOString().split("T")[0]

    try {
      // Fetch schedules for the selected date
      const { data: schedules, error } = await supabase
        .from("schedules")
        .select(`
          id,
          driver_id,
          is_day_off,
          is_annual_leave,
          drivers (
            id,
            name,
            staff_id,
            car_number
          ),
          replacements (
            id,
            replacement_driver_id,
            shift_id,
            shifts (
              id,
              name
            ),
            drivers:replacement_driver_id (
              id,
              name,
              staff_id,
              car_number
            )
          )
        `)
        .eq("date", dateStr)

      if (error) throw error

      // Process data for display
      const processedData = schedules.map((schedule) => ({
        id: schedule.id,
        driver: schedule.drivers,
        status: schedule.is_annual_leave ? "Annual Leave" : schedule.is_day_off ? "Day Off" : "Working",
        replacements: schedule.replacements.map((replacement) => ({
          id: replacement.id,
          driver: replacement.drivers,
          shift: replacement.shifts,
        })),
      }))

      setScheduleData(processedData)
    } catch (error) {
      console.error("Error fetching schedule:", error)
      toast({
        title: "Error",
        description: "There was a problem fetching the schedule data.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const exportToExcel = () => {
    if (!scheduleData || !date) return

    try {
      // Prepare data for export
      const exportData = scheduleData.map((schedule) => {
        const replacementInfo =
          schedule.replacements.length > 0
            ? schedule.replacements
                .map((r: any) => `${r.driver.name} (${r.driver.staff_id}) - ${r.shift.name}`)
                .join(", ")
            : "None"

        return {
          "Driver Name": schedule.driver.name,
          "Staff ID": schedule.driver.staff_id,
          "Car Number": schedule.driver.car_number || "N/A",
          Status: schedule.status,
          Replacements: replacementInfo,
        }
      })

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(exportData)

      // Create workbook
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Daily Schedule")

      // Generate filename
      const fileName = `daily_schedule_${format(date, "yyyy-MM-dd")}.xlsx`

      // Export to file
      XLSX.writeFile(wb, fileName)

      toast({
        title: "Export successful",
        description: `Schedule exported to ${fileName}`,
      })
    } catch (error) {
      console.error("Error exporting to Excel:", error)
      toast({
        title: "Export failed",
        description: "There was a problem exporting the data to Excel.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Select Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-end space-x-2">
          <Button onClick={fetchDailySchedule} disabled={!date || isLoading}>
            {isLoading ? "Loading..." : "Generate Report"}
          </Button>

          {scheduleData && (
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="mr-2 h-4 w-4" />
              Export to Excel
            </Button>
          )}
        </div>
      </div>

      {scheduleData && (
        <div className="border rounded-md">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Car Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Replacements
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {scheduleData.map((schedule) => (
                <tr key={schedule.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium">{schedule.driver.name}</div>
                    <div className="text-sm text-muted-foreground">{schedule.driver.staff_id}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{schedule.driver.car_number || "N/A"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={cn(
                        "px-2 py-1 text-xs rounded-full",
                        schedule.status === "Working"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300",
                      )}
                    >
                      {schedule.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {schedule.replacements.length > 0 ? (
                      <div className="space-y-2">
                        {schedule.replacements.map((replacement: any) => (
                          <div key={replacement.id} className="text-sm">
                            <div className="font-medium">{replacement.driver.name}</div>
                            <div className="text-muted-foreground">
                              {replacement.driver.staff_id} - {replacement.shift.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
