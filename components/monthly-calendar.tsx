"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DayScheduleDialog } from "./day-schedule-dialog"
import { cn } from "@/lib/utils"

interface Driver {
  id: string
  name: string
  staff_id: string
}

interface Schedule {
  id: string
  driver_id: string
  date: string
  is_day_off: boolean
  is_annual_leave: boolean
  replacements: Array<{
    id: string
    replacement_driver_id: string
    shift_id: string
    shifts: {
      id: string
      name: string
    }
  }>
}

interface Shift {
  id: string
  name: string
}

interface MonthlyCalendarProps {
  year: number
  month: number
  drivers: Driver[]
  schedules: Schedule[]
  shifts: Shift[]
}

export function MonthlyCalendar({ year, month, drivers, schedules, shifts }: MonthlyCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Get all dates in the month
  const getDaysInMonth = () => {
    const date = new Date(year, month, 1)
    const days = []
    const lastDay = new Date(year, month + 1, 0).getDate()

    // Add empty cells for days before the first day of the month
    const firstDayOfWeek = date.getDay()
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let i = 1; i <= lastDay; i++) {
      days.push(new Date(year, month, i))
    }

    return days
  }

  const days = getDaysInMonth()
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  // Get schedules for a specific date
  const getSchedulesForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0]
    return schedules.filter(schedule => schedule.date === dateStr)
  }

  // Check if a date has any schedules
  const hasSchedules = (date: Date) => {
    const dateSchedules = getSchedulesForDate(date)
    return dateSchedules.length > 0
  }

  // Get schedule summary for a date
  const getScheduleSummary = (date: Date) => {
    const dateSchedules = getSchedulesForDate(date)
    const dayOffs = dateSchedules.filter(s => s.is_day_off).length
    const annualLeaves = dateSchedules.filter(s => s.is_annual_leave).length
    return {
      dayOffs,
      annualLeaves,
      total: dateSchedules.length
    }
  }

  return (
    <div className="w-full">
      {/* Calendar header */}
      <div className="grid grid-cols-7 gap-px bg-muted p-2 text-center text-sm font-medium">
        {weekDays.map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-muted">
        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="bg-background min-h-[120px]" />
          }

          const summary = getScheduleSummary(day)
          const isToday = new Date().toDateString() === day.toDateString()

          return (
            <Button
              key={day.toISOString()}
              variant="ghost"
              className={cn(
                "h-full min-h-[120px] w-full flex flex-col items-start justify-start p-2 hover:bg-muted/50",
                isToday && "bg-yellow-100/50 dark:bg-yellow-900/10",
                hasSchedules(day) && "bg-background"
              )}
              onClick={() => setSelectedDate(day)}
            >
              <span className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-full text-sm",
                isToday && "bg-primary text-primary-foreground"
              )}>
                {day.getDate()}
              </span>
              {summary.total > 0 && (
                <div className="mt-1 w-full space-y-1 text-left text-xs">
                  {summary.dayOffs > 0 && (
                    <div className="rounded bg-blue-100 dark:bg-blue-900/20 px-1 py-0.5 text-blue-700 dark:text-blue-300">
                      {summary.dayOffs} Day Off
                    </div>
                  )}
                  {summary.annualLeaves > 0 && (
                    <div className="rounded bg-green-100 dark:bg-green-900/20 px-1 py-0.5 text-green-700 dark:text-green-300">
                      {summary.annualLeaves} Annual Leave
                    </div>
                  )}
                </div>
              )}
            </Button>
          )
        })}
      </div>

      {/* Day schedule dialog */}
      {selectedDate && (
        <DayScheduleDialog
          date={selectedDate}
          drivers={drivers}
          schedules={getSchedulesForDate(selectedDate)}
          shifts={shifts}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  )
}
