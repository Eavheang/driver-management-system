"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface Driver {
  id: string
  name: string
  staff_id: string
}

interface DriverMonthlyDayoffProps {
  drivers: Driver[]
  initialMonth?: number
  initialYear?: number
}

const DAYS_OF_WEEK = [
  { value: "6", label: "Sunday" },
  { value: "0", label: "Monday" },
  { value: "1", label: "Tuesday" },
  { value: "2", label: "Wednesday" },
  { value: "3", label: "Thursday" },
  { value: "4", label: "Friday" },
  { value: "5", label: "Saturday" },
]

export function DriverMonthlyDayoff({ drivers, initialMonth, initialYear }: DriverMonthlyDayoffProps) {
  const [selectedDriver, setSelectedDriver] = useState<string>("")
  const [selectedMonth, setSelectedMonth] = useState<string>(
    initialMonth ? initialMonth.toString() : (new Date().getMonth() + 1).toString()
  )
  const [selectedYear, setSelectedYear] = useState<string>(
    initialYear ? initialYear.toString() : new Date().getFullYear().toString()
  )
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const supabase = getSupabaseClient()

  // Generate array of months
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString(),
    label: new Date(2000, i).toLocaleString('default', { month: 'long' })
  }))

  // Generate array of years (current year and next year)
  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear + 1].map(year => ({
    value: year.toString(),
    label: year.toString()
  }))

  const handleSubmit = async () => {
    if (!selectedDriver || !selectedMonth || !selectedYear || !selectedDayOfWeek) {
      toast({
        title: "Error",
        description: "Please fill in all fields.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // First, check if there are any existing day-off patterns for this driver in the selected month
      const { data: existingPattern, error: fetchError } = await supabase
        .from("driver_monthly_dayoff")
        .select("*")
        .eq("driver_id", selectedDriver)
        .eq("month", parseInt(selectedMonth))
        .eq("year", parseInt(selectedYear))
        .maybeSingle()

      if (fetchError) {
        console.error("Error checking existing pattern:", fetchError)
        throw new Error(fetchError.message)
      }

      let operation
      const dayOfWeek = selectedDayOfWeek === "7" ? 0 : parseInt(selectedDayOfWeek) // Convert Sunday from 7 to 0

      if (existingPattern) {
        // Update existing pattern
        operation = supabase
          .from("driver_monthly_dayoff")
          .update({
            day_of_week: dayOfWeek,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingPattern.id)
      } else {
        // Insert new pattern
        operation = supabase
          .from("driver_monthly_dayoff")
          .insert({
            driver_id: selectedDriver,
            month: parseInt(selectedMonth),
            year: parseInt(selectedYear),
            day_of_week: dayOfWeek,
          })
      }

      const { error: operationError } = await operation

      if (operationError) {
        console.error("Database operation error:", operationError)
        throw new Error(operationError.message)
      }

      toast({
        title: "Success",
        description: "Monthly day-off pattern has been set successfully.",
      })

      // Reset form
      setSelectedDayOfWeek("")
      setSelectedDriver("")
      
      // Refresh the page to show updated calendar
      router.refresh()
    } catch (error) {
      console.error("Error setting monthly day-off:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "There was a problem setting the monthly day-off pattern.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Set Monthly Day-Off Pattern</span>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Driver</label>
          <Select
            value={selectedDriver}
            onValueChange={setSelectedDriver}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a driver" />
            </SelectTrigger>
            <SelectContent>
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name} ({driver.staff_id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Month</label>
          <Select
            value={selectedMonth}
            onValueChange={setSelectedMonth}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Year</label>
          <Select
            value={selectedYear}
            onValueChange={setSelectedYear}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year.value} value={year.value}>
                  {year.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Day of Week</label>
          <Select
            value={selectedDayOfWeek}
            onValueChange={setSelectedDayOfWeek}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select day of week" />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OF_WEEK.map((day) => (
                <SelectItem key={day.value} value={day.value}>
                  {day.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Setting Pattern...
            </>
          ) : (
            'Set Monthly Day-Off Pattern'
          )}
        </Button>
      </CardContent>
    </Card>
  )
} 