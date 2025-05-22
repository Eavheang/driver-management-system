"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Download, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from "xlsx"
import { DatePicker } from "../date-picker"

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

interface DriverShift {
  driver_id: string
  shift_id: string
  drivers: Driver
}

interface Schedule {
  id: string
  driver_id: string
  is_day_off: boolean
  is_annual_leave: boolean
  replacements: Array<{
    id: string
    shift_id: string
    drivers: Driver
  }>
}

interface DailyScheduleReportProps {
  drivers: Driver[]
  shifts: Shift[]
}

// Add interface for processed data
interface ProcessedDriver {
  number: number
  carNumber: string
  driverName: string
  isReplaced: boolean
  replacementDriver?: Driver
}

interface ProcessedShift {
  shiftName: string
  shiftTime: string
  drivers: ProcessedDriver[]
}

export function DailyScheduleReport({ drivers, shifts }: DailyScheduleReportProps) {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [isLoading, setIsLoading] = useState(false)
  const [scheduleData, setScheduleData] = useState<ProcessedShift[] | null>(null)
  const { toast } = useToast()

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const fetchDailySchedule = async () => {
    if (!date) return

    setIsLoading(true)
    const supabase = getSupabaseClient()
    const dateStr = date.toISOString().split("T")[0]

    try {
      // First, fetch all shifts
      const { data: allShifts } = await supabase
        .from("shifts")
        .select("*")
        .order("start_time")

      if (!allShifts) throw new Error("Could not fetch shifts")

      // Then fetch driver assignments and schedules
      const { data: driverShifts } = await supabase
        .from("driver_shifts")
        .select(`
          driver_id,
          shift_id,
          drivers!inner (
            id,
            name,
            staff_id,
            car_number
          )
        `) as { data: DriverShift[] | null }

      if (!driverShifts) throw new Error("Could not fetch driver shifts")

      // Fetch schedules and replacements for the selected date
      const { data: schedules } = await supabase
        .from("schedules")
        .select(`
          id,
          driver_id,
          is_day_off,
          is_annual_leave,
          replacements (
            id,
            shift_id,
            drivers:replacement_driver_id (
              id,
              name,
              staff_id,
              car_number
            )
          )
        `)
        .eq("date", dateStr) as { data: Schedule[] | null }

      if (!schedules) throw new Error("Could not fetch schedules")

      // Process data for each shift
      const processedData = allShifts.map(shift => {
        // Get all drivers assigned to this shift
        const shiftDrivers = driverShifts
          .filter(ds => ds.shift_id === shift.id)
          .map(ds => {
            const schedule = schedules?.find(s => s.driver_id === ds.driver_id)
            const replacement = schedule?.replacements?.find(r => r.shift_id === shift.id)
            
            return {
              number: 0, // Will be set later
              carNumber: ds.drivers.car_number || "N/A",
              driverName: schedule?.is_day_off || schedule?.is_annual_leave
                ? `${ds.drivers.name} (Replaced by ${replacement?.drivers?.name || 'Not assigned'})`
                : ds.drivers.name,
              isReplaced: schedule?.is_day_off || schedule?.is_annual_leave,
              replacementDriver: replacement?.drivers,
            }
          })
          .filter(driver => driver.driverName) // Filter out any undefined drivers
          .sort((a, b) => (a.carNumber === "N/A" ? 1 : b.carNumber === "N/A" ? -1 : a.carNumber.localeCompare(b.carNumber)))
          // Add row numbers
          .map((driver, index) => ({
            ...driver,
            number: index + 1
          }))

        return {
          shiftName: shift.name,
          shiftTime: `(${shift.start_time.substring(0, 5)}-${shift.end_time.substring(0, 5)})`,
          drivers: shiftDrivers
        }
      }) as ProcessedShift[]

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
      // Create workbook with a single sheet
      const wb = XLSX.utils.book_new()
      
      // Prepare data for a single sheet with all shifts
      let rowData: any[] = []
      let currentRow = 0
      let shiftStartRows: number[] = [] // Track the starting row of each shift

      scheduleData.forEach((shiftData, index) => {
        // Store the start row for this shift
        shiftStartRows.push(currentRow)
        
        // Add date and shift header
        rowData[currentRow] = [`${formatDate(date)} ${shiftData.shiftName} ${shiftData.shiftTime}`]
        currentRow++

        // Add column headers
        rowData[currentRow] = ["No", "Car Number", "Driver Name"]
        currentRow++

        // Add driver data
        shiftData.drivers.forEach(driver => {
          rowData[currentRow] = [driver.number, driver.carNumber, driver.driverName]
          currentRow++
        })

        // Add empty row between shifts (except for the last shift)
        if (index < scheduleData.length - 1) {
          rowData[currentRow] = []
          currentRow++
        }
      })

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(rowData)

      // Set column widths
      const columnWidths = [
        { wch: 5 },  // No column
        { wch: 12 }, // Car Number column
        { wch: 40 }, // Driver Name column
      ]
      ws['!cols'] = columnWidths

      // Apply styles
      // Style for date headers
      shiftStartRows.forEach((startRow, i) => {
        const headerCell = XLSX.utils.encode_cell({ r: startRow, c: 0 })
        if (!ws[headerCell]) {
          ws[headerCell] = { v: rowData[startRow][0] }
        }
        ws[headerCell].s = {
          font: { bold: true, color: { rgb: "000000" }, sz: 12 },
          fill: { fgColor: { rgb: "CCCCCC" } },
          alignment: { horizontal: "left" },
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
          }
        }

        // Style for column headers (row after the date header)
        const columnHeaderRow = startRow + 1
        for (let j = 0; j < 3; j++) {
          const cell = XLSX.utils.encode_cell({ r: columnHeaderRow, c: j })
          if (!ws[cell]) {
            ws[cell] = { v: rowData[columnHeaderRow][j] }
          }
          ws[cell].s = {
            font: { bold: true, color: { rgb: "000000" } },
            fill: { fgColor: { rgb: "E6E6E6" } },
            alignment: { horizontal: "center" },
            border: {
              top: { style: "thin" },
              bottom: { style: "thin" },
              left: { style: "thin" },
              right: { style: "thin" }
            }
          }
        }

        // Style for data cells
        const dataStartRow = columnHeaderRow + 1
        const dataEndRow = dataStartRow + scheduleData[i].drivers.length - 1
        for (let row = dataStartRow; row <= dataEndRow; row++) {
          for (let col = 0; col < 3; col++) {
            const cell = XLSX.utils.encode_cell({ r: row, c: col })
            if (ws[cell]) {
              ws[cell].s = {
                border: {
                  top: { style: "thin" },
                  bottom: { style: "thin" },
                  left: { style: "thin" },
                  right: { style: "thin" }
                },
                alignment: { 
                  horizontal: col === 0 ? "center" : "left",
                  vertical: "center"
                }
              }
            }
          }
        }
      })

      // Add the worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Daily Schedule")

      // Generate filename
      const fileName = `daily_schedule_${date.toISOString().split("T")[0]}.xlsx`

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

  useEffect(() => {
    if (date) {
      fetchDailySchedule()
    }
  }, [date])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <DatePicker date={date} onSelect={setDate} />
          <Button onClick={exportToExcel} disabled={!scheduleData || isLoading}>
            Export to Excel
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {scheduleData && (
        <div className="space-y-8">
          {scheduleData.map((shiftData, index) => (
            <div key={index} className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">
                  {formatDate(date!)} {shiftData.shiftName} {shiftData.shiftTime}
                </h3>
              </div>
              <div className="border rounded-md">
                <table className="min-w-full divide-y divide-border">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">
                        No
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Car Number
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Driver Name
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shiftData.drivers.map((driver: any) => (
                      <tr key={driver.number}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {driver.number}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {driver.carNumber}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {driver.isReplaced ? (
                            <span className="text-muted-foreground">
                              {driver.driverName}
                            </span>
                          ) : (
                            driver.driverName
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
