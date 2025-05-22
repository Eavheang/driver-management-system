"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface Driver {
  id: string
  name: string
  staff_id: string
}

interface Shift {
  id: string
  name: string
  start_time: string
  end_time: string
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
      start_time: string
      end_time: string
    }
  }>
}

interface DayScheduleDialogProps {
  date: Date
  drivers: Driver[]
  schedules: Schedule[]
  shifts: Shift[]
  onClose: () => void
}

export function DayScheduleDialog({ date, drivers = [], schedules = [], shifts = [], onClose }: DayScheduleDialogProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const [selectedShift, setSelectedShift] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  const handleClose = () => {
    setIsOpen(false)
    onClose()
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  // Calculate OT hours between two time strings
  const calculateOTHours = (startTime: string, endTime: string) => {
    // For replacement shifts, always return 8 hours as per business rule
    return 8
  }

  // Handle setting day off or annual leave
  const handleScheduleUpdate = async (driverId: string, type: "day_off" | "annual_leave") => {
    setLoading(true)
    const supabase = getSupabaseClient()
    const dateStr = date.toISOString().split("T")[0]

    try {
      // Check if schedule exists
      const { data: existingSchedule } = await supabase
        .from("schedules")
        .select("id, is_day_off, is_annual_leave")
        .eq("driver_id", driverId)
        .eq("date", dateStr)
        .maybeSingle()

      if (existingSchedule) {
        // Update existing schedule
        const updates = {
          is_day_off: type === "day_off" ? !existingSchedule.is_day_off : false,
          is_annual_leave: type === "annual_leave" ? !existingSchedule.is_annual_leave : false,
          updated_at: new Date().toISOString(),
        }

        await supabase
          .from("schedules")
          .update(updates)
          .eq("id", existingSchedule.id)
      } else {
        // Create new schedule
        const { data: newSchedule } = await supabase
          .from("schedules")
          .insert({
            driver_id: driverId,
            date: dateStr,
            is_day_off: type === "day_off",
            is_annual_leave: type === "annual_leave",
          })
          .select()
          .single()
      }

      toast({
        title: "Schedule updated",
        description: "Driver schedule has been updated successfully.",
      })

      router.refresh()
    } catch (error) {
      console.error("Error updating schedule:", error)
      toast({
        title: "Error",
        description: "There was a problem updating the schedule.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle assigning replacement and creating OT record
  const handleAssignReplacement = async (scheduleId: string, replacementDriverId: string, driverId: string) => {
    setLoading(true)
    const supabase = getSupabaseClient()
    const dateStr = date.toISOString().split("T")[0]

    try {
      // Get all shifts of the original driver
      const { data: driverShifts, error: shiftsError } = await supabase
        .from("driver_shifts")
        .select("shift_id")
        .eq("driver_id", driverId)

      if (shiftsError || !driverShifts) {
        throw new Error("Could not find shifts for driver")
      }

      // Create replacement records for each shift
      const replacementPromises = driverShifts.map(async (driverShift) => {
        // Create replacement record
        const { data: replacement } = await supabase
          .from("replacements")
          .insert({
            schedule_id: scheduleId,
            replacement_driver_id: replacementDriverId,
            shift_id: driverShift.shift_id,
          })
          .select()
          .single()

        return replacement
      })

      await Promise.all(replacementPromises)

      // Check if driver already has an OT record for this date
      const { data: existingOT } = await supabase
        .from("overtime_records")
        .select()
        .eq("driver_id", replacementDriverId)
        .eq("date", dateStr)
        .maybeSingle()

      // Calculate total OT hours based on number of shifts
      const otHours = driverShifts.length * 8

      if (existingOT) {
        // If driver already has OT record, add additional hours for multiple shifts
        await supabase
          .from("overtime_records")
          .update({
            hours: existingOT.hours + otHours,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingOT.id)
      } else {
        // Create new OT record with hours for all shifts
        await supabase.from("overtime_records").insert({
          driver_id: replacementDriverId,
          date: dateStr,
          hours: otHours,
          ot_type: "replacement",
          ot_rate: 1.5,
        })
      }

      toast({
        title: "Replacements assigned",
        description: `Replacement driver has been assigned to ${driverShifts.length} shift${driverShifts.length > 1 ? 's' : ''} and OT record created.`,
      })

      router.refresh()
    } catch (error) {
      console.error("Error assigning replacement:", error)
      toast({
        title: "Error",
        description: "There was a problem assigning the replacement.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle updating existing replacement
  const handleUpdateReplacement = async (replacementId: string, newDriverId: string, driverId: string, scheduleId: string) => {
    setLoading(true)
    const supabase = getSupabaseClient()
    const dateStr = date.toISOString().split("T")[0]

    try {
      // Get all shifts of the original driver
      const { data: driverShifts, error: shiftsError } = await supabase
        .from("driver_shifts")
        .select("shift_id")
        .eq("driver_id", driverId)

      if (shiftsError || !driverShifts) {
        throw new Error("Could not find shifts for driver")
      }

      // Get all current replacements for this schedule
      const { data: oldReplacements } = await supabase
        .from("replacements")
        .select("id, replacement_driver_id")
        .eq("schedule_id", scheduleId)

      if (!oldReplacements) throw new Error("Could not find current replacements")

      // Delete all existing replacements
      await supabase
        .from("replacements")
        .delete()
        .in("id", oldReplacements.map(r => r.id))

      // Create new replacement records for each shift
      const replacementPromises = driverShifts.map(async (driverShift) => {
        return supabase
          .from("replacements")
          .insert({
            schedule_id: scheduleId,
            replacement_driver_id: newDriverId,
            shift_id: driverShift.shift_id,
          })
          .select()
          .single()
      })

      await Promise.all(replacementPromises)

      // Remove OT records for old drivers
      const oldDriverIds = [...new Set(oldReplacements.map(r => r.replacement_driver_id))]
      for (const oldDriverId of oldDriverIds) {
        await supabase
          .from("overtime_records")
          .delete()
          .eq("driver_id", oldDriverId)
          .eq("date", dateStr)
          .eq("ot_type", "replacement")
      }

      // Calculate total OT hours based on number of shifts
      const otHours = driverShifts.length * 8

      // Check if new driver already has an OT record for this date
      const { data: existingOT } = await supabase
        .from("overtime_records")
        .select()
        .eq("driver_id", newDriverId)
        .eq("date", dateStr)
        .maybeSingle()

      if (existingOT) {
        // If driver already has OT record, add additional hours for multiple shifts
        await supabase
          .from("overtime_records")
          .update({
            hours: existingOT.hours + otHours,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingOT.id)
      } else {
        // Create new OT record with hours for all shifts
        await supabase.from("overtime_records").insert({
          driver_id: newDriverId,
          date: dateStr,
          hours: otHours,
          ot_type: "replacement",
          ot_rate: 1.5,
        })
      }

      toast({
        title: "Replacements updated",
        description: `Replacement driver has been updated for ${driverShifts.length} shift${driverShifts.length > 1 ? 's' : ''}.`,
      })

      router.refresh()
    } catch (error) {
      console.error("Error updating replacement:", error)
      toast({
        title: "Error",
        description: "There was a problem updating the replacement.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Get schedule for a driver
  const getDriverSchedule = (driverId: string) => {
    return schedules.find(schedule => schedule.driver_id === driverId)
  }

  // Get available drivers (not on leave/day off)
  const getAvailableDrivers = () => {
    return drivers.filter(driver => {
      const schedule = getDriverSchedule(driver.id)
      return !schedule?.is_day_off && !schedule?.is_annual_leave
    })
  }

  // Check if a schedule needs replacement
  const needsReplacement = (schedule: Schedule) => {
    return (schedule.is_day_off || schedule.is_annual_leave) && schedule.replacements.length === 0
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{formatDate(date)}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="schedule" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle>Day Schedule</CardTitle>
                <CardDescription>View and manage schedules for this day</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {schedules.map((schedule) => {
                  const driver = drivers.find(d => d.id === schedule.driver_id)
                  if (!driver) return null

                  return (
                    <div key={schedule.id} className="space-y-4">
                      <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
                        <div>
                          <h4 className="font-medium">{driver.name}</h4>
                          <p className="text-sm text-muted-foreground">{driver.staff_id}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                          {schedule.is_day_off && (
                            <span className="text-sm rounded bg-blue-100 dark:bg-blue-900/20 px-2 py-1 text-blue-700 dark:text-blue-300">
                              Day Off
                            </span>
                          )}
                          {schedule.is_annual_leave && (
                            <span className="text-sm rounded bg-green-100 dark:bg-green-900/20 px-2 py-1 text-green-700 dark:text-green-300">
                              Annual Leave
                            </span>
                          )}
                        </div>
                      </div>

                      {needsReplacement(schedule) && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Replacement needed for {driver.name}. Please assign a replacement driver.
                          </AlertDescription>
                        </Alert>
                      )}

                      {(schedule.is_day_off || schedule.is_annual_leave) && (
                        <div className="rounded-lg border p-4">
                          <h5 className="font-medium mb-2">Assign Replacement</h5>
                          <div className="grid gap-4">
                            <div>
                              <Label>Select Replacement Driver</Label>
                              <Select
                                onValueChange={(value) => {
                                  if (value) {
                                    if (schedule.replacements.length > 0) {
                                      handleUpdateReplacement(schedule.replacements[0].id, value, schedule.driver_id, schedule.id)
                                    } else {
                                      handleAssignReplacement(schedule.id, value, schedule.driver_id)
                                    }
                                  }
                                }}
                                value={schedule.replacements[0]?.replacement_driver_id || ""}
                                disabled={loading}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select replacement driver" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getAvailableDrivers()
                                    .filter(d => d.id !== driver.id)
                                    .map(d => (
                                      <SelectItem key={d.id} value={d.id}>
                                        {d.name} ({d.staff_id})
                                      </SelectItem>
                                    ))
                                  }
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {schedule.replacements.map(replacement => {
                            const replacementDriver = drivers.find(d => d.id === replacement.replacement_driver_id)
                            const replacementShift = shifts.find(s => s.id === replacement.shift_id)
                            return (
                              <div key={replacement.id} className="mt-2 text-sm text-muted-foreground">
                                Replaced by: {replacementDriver?.name} ({replacementDriver?.staff_id})
                                {replacementShift && ` - ${replacementShift.name}`}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drivers">
            <Card>
              <CardHeader>
                <CardTitle>Manage Drivers</CardTitle>
                <CardDescription>Set day off or annual leave for drivers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {drivers.map((driver) => {
                  const schedule = getDriverSchedule(driver.id)
                  return (
                    <div key={driver.id} className="flex items-center justify-between space-x-4 rounded-lg border p-4">
                      <div>
                        <h4 className="font-medium">{driver.name}</h4>
                        <p className="text-sm text-muted-foreground">{driver.staff_id}</p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`day-off-${driver.id}`}
                            checked={schedule?.is_day_off || false}
                            onCheckedChange={() => handleScheduleUpdate(driver.id, "day_off")}
                            disabled={loading || schedule?.is_annual_leave}
                          />
                          <Label htmlFor={`day-off-${driver.id}`}>Day Off</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`annual-leave-${driver.id}`}
                            checked={schedule?.is_annual_leave || false}
                            onCheckedChange={() => handleScheduleUpdate(driver.id, "annual_leave")}
                            disabled={loading || schedule?.is_day_off}
                          />
                          <Label htmlFor={`annual-leave-${driver.id}`}>Annual Leave</Label>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
