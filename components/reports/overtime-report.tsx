"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, Download, Trash2 } from "lucide-react"
import { format, startOfMonth, endOfMonth } from "date-fns"
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

interface OvertimeReportProps {
  drivers: Driver[]
}

export function OvertimeReport({ drivers }: OvertimeReportProps) {
  const [month, setMonth] = useState<Date | undefined>(new Date())
  const [driverId, setDriverId] = useState<string | undefined>("all") // Updated default value to "all"
  const [isLoading, setIsLoading] = useState(false)
  const [overtimeData, setOvertimeData] = useState<any[] | null>(null)
  const { toast } = useToast()

  const fetchOvertimeReport = async () => {
    if (!month) return

    setIsLoading(true)
    const supabase = getSupabaseClient()

    // Calculate start and end of month
    const start = startOfMonth(month).toISOString().split("T")[0]
    const end = endOfMonth(month).toISOString().split("T")[0]

    try {
      // Build query
      let query = supabase
        .from("overtime_records")
        .select(`
          id,
          driver_id,
          date,
          hours,
          ot_type,
          ot_rate,
          drivers (
            id,
            name,
            staff_id
          )
        `)
        .gte("date", start)
        .lte("date", end)

      // Add driver filter if selected
      if (driverId !== "all") {
        query = query.eq("driver_id", driverId)
      }

      // Execute query
      const { data, error } = await query.order("date")

      if (error) throw error

      // Process data for display
      const processedData = data.map((record) => ({
        id: record.id,
        driver: record.drivers,
        date: record.date,
        hours: record.hours,
        ot_type: record.ot_type,
        ot_rate: record.ot_rate,
        total: record.hours * record.ot_rate,
      }))

      setOvertimeData(processedData)
    } catch (error) {
      console.error("Error fetching overtime data:", error)
      toast({
        title: "Error",
        description: "There was a problem fetching the overtime data.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const exportToExcel = () => {
    if (!overtimeData || !month) return

    try {
      // Prepare data for export
      const exportData = overtimeData.map((record) => {
        let otTypeFormatted = ""
        switch (record.ot_type) {
          case "normal":
            otTypeFormatted = "Normal OT (150%)"
            break
          case "holiday":
            otTypeFormatted = "Holiday OT (200%)"
            break
          case "day_off":
            otTypeFormatted = "Day-off OT (200%)"
            break
          case "night":
            otTypeFormatted = "Night OT (200%)"
            break
        }

        return {
          "Driver Name": record.driver.name,
          "Staff ID": record.driver.staff_id,
          Date: format(new Date(record.date), "PPP"),
          Hours: record.hours,
          "OT Type": otTypeFormatted,
          Rate: record.ot_rate,
          Total: record.total,
        }
      })

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(exportData)

      // Create workbook
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Overtime Report")

      // Generate filename
      const fileName = `overtime_report_${format(month, "yyyy-MM")}.xlsx`

      // Export to file
      XLSX.writeFile(wb, fileName)

      toast({
        title: "Export successful",
        description: `Report exported to ${fileName}`,
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

  // Calculate totals
  const calculateTotals = () => {
    if (!overtimeData) return { totalHours: 0, totalValue: 0 }

    return overtimeData.reduce(
      (acc, record) => {
        acc.totalHours += record.hours
        acc.totalValue += record.total
        return acc
      },
      { totalHours: 0, totalValue: 0 },
    )
  }

  const { totalHours, totalValue } = calculateTotals()

  const handleDelete = async (id: string) => {
    setIsLoading(true)
    const supabase = getSupabaseClient()

    try {
      const { error } = await supabase
        .from("overtime_records")
        .delete()
        .eq("id", id)

      if (error) throw error

      toast({
        title: "Record deleted",
        description: "Overtime record has been deleted successfully.",
      })

      // Refresh the data
      fetchOvertimeReport()
    } catch (error) {
      console.error("Error deleting record:", error)
      toast({
        title: "Error",
        description: "There was a problem deleting the record.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Select Month</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn("w-full justify-start text-left font-normal", !month && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {month ? format(month, "MMMM yyyy") : <span>Pick a month</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={month} onSelect={setMonth} initialFocus />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Driver (Optional)</label>
          <Select value={driverId} onValueChange={setDriverId}>
            <SelectTrigger>
              <SelectValue placeholder="All Drivers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Drivers</SelectItem> {/* Updated value prop to "all" */}
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name} ({driver.staff_id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end space-x-2">
          <Button onClick={fetchOvertimeReport} disabled={!month || isLoading}>
            {isLoading ? "Loading..." : "Generate Report"}
          </Button>

          {overtimeData && (
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="mr-2 h-4 w-4" />
              Export to Excel
            </Button>
          )}
        </div>
      </div>

      {overtimeData && (
        <>
          <div className="border rounded-md">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Hours
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    OT Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overtimeData.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium">{record.driver.name}</div>
                      <div className="text-sm text-muted-foreground">{record.driver.staff_id}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{format(new Date(record.date), "PPP")}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{record.hours}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          "px-2 py-1 text-xs rounded-full",
                          record.ot_type === "normal"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                            : record.ot_type === "holiday"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300"
                              : record.ot_type === "day_off"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                                : "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300",
                        )}
                      >
                        {record.ot_type === "normal" && "Normal"}
                        {record.ot_type === "holiday" && "Holiday"}
                        {record.ot_type === "day_off" && "Day Off"}
                        {record.ot_type === "night" && "Night"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{record.ot_rate}x</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">{record.total.toFixed(2)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-100"
                        onClick={() => handleDelete(record.id)}
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50">
                  <td colSpan={2} className="px-4 py-3 font-medium text-right">
                    Totals:
                  </td>
                  <td className="px-4 py-3 font-medium">{totalHours.toFixed(2)}</td>
                  <td colSpan={2}></td>
                  <td className="px-4 py-3 font-medium">{totalValue.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
