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
  contact_number: string | null
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
  dayOff?: string
  contact?: string
  alOff?: string
}

interface ProcessedShift {
  shiftName: string
  shiftTime: string
  drivers: ProcessedDriver[]
}

const DAYS_OF_WEEK = [
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" }
]

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
    if (!date) return;

    setIsLoading(true);
    const supabase = getSupabaseClient();
    const dateStr = date.toISOString().split("T")[0];
    const currentMonth = date.getMonth() + 1;
    const currentYear = date.getFullYear();

    try {
      // First, fetch all shifts with proper error handling
      const { data: allShifts, error: shiftsError } = await supabase
        .from("shifts")
        .select("*")
        .order("start_time");

      if (shiftsError) throw new Error(`Could not fetch shifts: ${shiftsError.message}`);
      if (!allShifts) throw new Error("No shifts data returned");

      // Fetch day off patterns for all drivers
      const { data: dayOffPatterns, error: dayOffError } = await supabase
        .from("driver_monthly_dayoff")
        .select("*")
        .eq("month", currentMonth)
        .eq("year", currentYear);

      if (dayOffError) throw new Error(`Could not fetch day off patterns: ${dayOffError.message}`);

      // Fetch schedules and replacements for the selected date
      const { data: schedules, error: schedulesError } = await supabase
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
              car_number,
              contact_number
            )
          )
        `)
        .eq("date", dateStr);

      if (schedulesError) throw new Error(`Could not fetch schedules: ${schedulesError.message}`);

      // Then fetch driver assignments with proper error handling
      const { data: driverShifts, error: driverShiftsError } = await supabase
        .from("driver_shifts")
        .select(`
          driver_id,
          shift_id,
          drivers!inner (
            id,
            name,
            staff_id,
            car_number,
            contact_number
          )
        `) as { data: DriverShift[] | null, error: any };

      if (driverShiftsError) throw new Error(`Could not fetch driver shifts: ${driverShiftsError.message}`);
      if (!driverShifts) throw new Error("No driver shifts data returned");

      // Process data for each shift with better error handling
      const processedData: ProcessedShift[] = allShifts.map(shift => {
        try {
          // Get all drivers assigned to this shift
          const shiftDrivers = driverShifts
            .filter(ds => ds.shift_id === shift.id)
            .map(ds => {
              try {
                const schedule = schedules?.find(s => s.driver_id === ds.driver_id);
                const replacement = schedule?.replacements?.find(r => r.shift_id === shift.id);
                const dayOffPattern = dayOffPatterns?.find(p => p.driver_id === ds.driver_id);
                const dayOffLabel = dayOffPattern 
                  ? DAYS_OF_WEEK.find(d => d.value === dayOffPattern.day_of_week)?.label 
                  : "";

                return {
                  number: 0, // Will be set later
                  carNumber: ds.drivers.car_number || "N/A",
                  driverName: schedule?.is_day_off || schedule?.is_annual_leave
                    ? `${ds.drivers.name} (Replaced by ${replacement?.drivers?.name || 'Not assigned'})`
                    : ds.drivers.name,
                  isReplaced: schedule?.is_day_off || schedule?.is_annual_leave,
                  replacementDriver: replacement?.drivers,
                  dayOff: dayOffLabel || "",
                  contact: ds.drivers.contact_number || "",
                  alOff: schedule?.is_annual_leave ? "AL" : schedule?.is_day_off ? "OFF" : ""
                } as ProcessedDriver;
              } catch (error) {
                console.error("Error processing driver:", error);
                return null;
              }
            })
            .filter((driver): driver is ProcessedDriver => driver !== null)
            .filter(driver => driver.driverName)
            .sort((a, b) => {
              // First sort by day off (Friday to Thursday)
              const dayOrder = {
                "Friday": 0,
                "Saturday": 1,
                "Sunday": 2,
                "Monday": 3,
                "Tuesday": 4,
                "Wednesday": 5,
                "Thursday": 6
              };
              const dayA = dayOrder[a.dayOff as keyof typeof dayOrder] ?? 999;
              const dayB = dayOrder[b.dayOff as keyof typeof dayOrder] ?? 999;
              if (dayA !== dayB) return dayA - dayB;
              
              // Then sort by car number if day off is the same
              return (a.carNumber === "N/A" ? 1 : b.carNumber === "N/A" ? -1 : a.carNumber.localeCompare(b.carNumber));
            })
            .map((driver, index) => ({
              ...driver,
              number: index + 1
            }));

          return {
            shiftName: shift.name,
            shiftTime: `(${shift.start_time.substring(0, 5)}-${shift.end_time.substring(0, 5)})`,
            drivers: shiftDrivers
          };
        } catch (error) {
          console.error("Error processing shift:", error);
          return {
            shiftName: shift.name,
            shiftTime: `(${shift.start_time.substring(0, 5)}-${shift.end_time.substring(0, 5)})`,
            drivers: []
          };
        }
      });

      setScheduleData(processedData);
    } catch (error) {
      console.error("Error fetching schedule:", error);
      toast({
        title: "Error fetching schedules",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
      setScheduleData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!scheduleData || !date) return;

    try {
      const wb = XLSX.utils.book_new();
      let rowData: any[] = [];
      let currentRow = 0;

      // Title Row
      rowData[currentRow] = ["DRIVER'S DAILY SCHEDULE"];
      currentRow++;

      // Date Row
      rowData[currentRow] = [`Date: ${formatDate(date)}`];
      currentRow++;
      currentRow++; // Empty row for spacing

      // Process each shift type
      const shiftTypes = [
        { 
          title: "Morning Shift (07:00-16:00)", 
          startTime: "07:00",
          endTime: "16:00"
        },
        { 
          title: "Afternoon Shift (16:00-00:00)",
          startTime: "16:00",
          endTime: "00:00"
        },
        { 
          title: "Night shift",
          startTime: "00:00",
          endTime: "07:00"
        },
        { 
          title: "PMO (8:30-18:00)",
          startTime: "08:30",
          endTime: "18:00"
        }
      ];

      shiftTypes.forEach((shiftType, shiftIndex) => {
        // Shift Header
        rowData[currentRow] = [shiftType.title];
        const shiftHeaderRow = currentRow;
        currentRow++;

        // Column Headers
        rowData[currentRow] = [
          "No.",
          "Day off",
          "Car Number",
          "Driver Name",
          "AL&OFF",
          "Driver Replace By (ជំនួស)",
          "Remark",
          "Contact"
        ];
        const columnHeaderRow = currentRow;
        currentRow++;

        // Filter and add driver data for this shift
        const shiftDrivers = scheduleData
          .filter(shift => 
            shift.shiftTime === `(${shiftType.startTime}-${shiftType.endTime})`)
          .flatMap(shift => shift.drivers)
          .map((driver, index) => [
            index + 1,
            driver.dayOff || "",
            driver.carNumber,
            driver.driverName,
            driver.alOff || "",
            driver.replacementDriver?.name || "",
            driver.isReplaced ? `OT(${shiftType.startTime}-${shiftType.endTime})` : "",
            driver.contact || ""
          ]);

        shiftDrivers.forEach(driverRow => {
          rowData[currentRow] = driverRow;
          currentRow++;
        });

        currentRow++; // Empty row between shifts
      });

      const ws = XLSX.utils.aoa_to_sheet(rowData);

      // Set column widths
      ws['!cols'] = [
        { wch: 5 },   // No.
        { wch: 10 },  // Day off
        { wch: 12 },  // Car Number
        { wch: 20 },  // Driver Name
        { wch: 8 },   // AL&OFF
        { wch: 25 },  // Driver Replace By
        { wch: 15 },  // Remark
        { wch: 15 }   // Contact
      ];

      // Apply styles
      for (let i = 0; i < rowData.length; i++) {
        const row = rowData[i];
        if (!row || row.length === 0) continue;

        const firstCellValue = String(row[0] || '');

        // Title styling
        if (i === 0) {
          const cell = XLSX.utils.encode_cell({ r: i, c: 0 });
          if (ws[cell]) {
            ws[cell].s = {
              font: { bold: true, sz: 16 },
              fill: { fgColor: { rgb: "FFFF00" } }, // Yellow background
              alignment: { horizontal: "center" }
            };
          }
        }

        // Shift header styling
        if (firstCellValue.includes("Shift") || firstCellValue.includes("PMO")) {
          const cell = XLSX.utils.encode_cell({ r: i, c: 0 });
          if (ws[cell]) {
            ws[cell].s = {
              font: { bold: true, color: { rgb: "FF0000" } }, // Red text
              fill: { fgColor: { rgb: "FFFF00" } }, // Yellow background
              alignment: { horizontal: "center" }
            };
          }
        }

        // Column header styling
        if (firstCellValue === "No.") {
          for (let j = 0; j < 8; j++) {
            const cell = XLSX.utils.encode_cell({ r: i, c: j });
            if (ws[cell]) {
              ws[cell].s = {
                font: { bold: true },
                fill: { fgColor: { rgb: "FFFF00" } }, // Yellow background
                alignment: { horizontal: "center" },
                border: {
                  top: { style: "thin" },
                  bottom: { style: "thin" },
                  left: { style: "thin" },
                  right: { style: "thin" }
                }
              };
            }
          }
        }

        // Data row styling
        if (typeof row[0] === 'number') {
          for (let j = 0; j < 8; j++) {
            const cell = XLSX.utils.encode_cell({ r: i, c: j });
            if (!ws[cell]) continue;

            // Base style for all cells
            const style: any = {
              border: {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" }
              },
              alignment: { 
                horizontal: j === 0 ? "center" : "left",
                vertical: "center"
              }
            };

            // Special styling for day-off column
            const dayOffValue = String(row[1] || '').toLowerCase();
            if (j === 1 && dayOffValue) {
              if (dayOffValue.includes('sun')) {
                style.fill = { fgColor: { rgb: "FF0000" } }; // Red background
              } else if (dayOffValue.includes('sat')) {
                style.fill = { fgColor: { rgb: "FFEB9C" } }; // Light yellow background
              }
            }

            // Special styling for AL&OFF column
            if (j === 4 && row[j] === 'OFF') {
              style.font = { color: { rgb: "FF0000" } }; // Red text
            }

            // Special styling for replacement driver column
            if (j === 5 && row[j]) {
              style.fill = { fgColor: { rgb: "FFA500" } }; // Orange background
            }

            ws[cell].s = style;
          }
        }
      }

      // Add the worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Daily Schedule");

      // Generate filename with date
      const fileName = `driver_daily_schedule_${date.toISOString().split("T")[0]}.xlsx`;

      // Export to file
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Export successful",
        description: `Schedule exported to ${fileName}`,
      });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast({
        title: "Export failed",
        description: "There was a problem exporting the data to Excel.",
        variant: "destructive",
      });
    }
  };

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
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Day Off
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
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {driver.contact}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {driver.dayOff}
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
