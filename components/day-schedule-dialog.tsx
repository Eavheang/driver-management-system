"use client"

import { useState, useEffect } from "react"
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
import { Input } from "@/components/ui/input"
import { Search, Filter } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface Driver {
  id: string
  name: string
  staff_id: string
  car_number?: string
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
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [selectedShift, setSelectedShift] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const [driverShifts, setDriverShifts] = useState<Array<{ shift_id: string }>>([])

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

  // Add function to fetch driver shifts
  const fetchDriverShifts = async (driverId: string) => {
    const supabase = getSupabaseClient()
    const { data } = await supabase
      .from("driver_shifts")
      .select("shift_id")
      .eq("driver_id", driverId)
    
    setDriverShifts(data || [])
  }

  // Handle assigning replacement
  const handleAssignReplacement = async (scheduleId: string, replacementDriverId: string, driverId: string, shiftId: string) => {
    setLoading(true)
    const supabase = getSupabaseClient()
    const dateStr = date.toISOString().split("T")[0]

    try {
      // Create replacement record for the specific shift
      const { data: replacement } = await supabase
        .from("replacements")
        .insert({
          schedule_id: scheduleId,
          replacement_driver_id: replacementDriverId,
          shift_id: shiftId,
        })
        .select()
        .single()

      // Check if driver already has an OT record for this date
      const { data: existingOT } = await supabase
        .from("overtime_records")
        .select()
        .eq("driver_id", replacementDriverId)
        .eq("date", dateStr)
        .maybeSingle()

      if (existingOT) {
        // If driver already has OT record, add additional hours for this shift
        await supabase
          .from("overtime_records")
          .update({
            hours: existingOT.hours + 8,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingOT.id)
      } else {
        // Create new OT record for this shift
        await supabase.from("overtime_records").insert({
          driver_id: replacementDriverId,
          date: dateStr,
          hours: 8,
          ot_type: "replacement",
          ot_rate: 1.5,
        })
      }

      toast({
        title: "Replacement assigned",
        description: "Replacement driver has been assigned for the shift.",
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
      // Get the current replacement to get the shift_id
      const { data: oldReplacement } = await supabase
        .from("replacements")
        .select("replacement_driver_id, shift_id")
        .eq("id", replacementId)
        .single()

      if (!oldReplacement) throw new Error("Could not find current replacement")

      // Update the replacement record
      await supabase
        .from("replacements")
        .update({
          replacement_driver_id: newDriverId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", replacementId)

      // Remove OT record for old driver
      await supabase
        .from("overtime_records")
        .delete()
        .eq("driver_id", oldReplacement.replacement_driver_id)
        .eq("date", dateStr)
        .eq("ot_type", "replacement")

      // Check if new driver already has an OT record for this date
      const { data: existingOT } = await supabase
        .from("overtime_records")
        .select()
        .eq("driver_id", newDriverId)
        .eq("date", dateStr)
        .maybeSingle()

      if (existingOT) {
        // If driver already has OT record, add additional hours for this shift
        await supabase
          .from("overtime_records")
          .update({
            hours: existingOT.hours + 8,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingOT.id)
      } else {
        // Create new OT record for this shift
        await supabase.from("overtime_records").insert({
          driver_id: newDriverId,
          date: dateStr,
          hours: 8,
          ot_type: "replacement",
          ot_rate: 1.5,
        })
      }

      toast({
        title: "Replacement updated",
        description: "Replacement driver has been updated successfully.",
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

  // Add effect to fetch driver shifts
  useEffect(() => {
    const fetchShiftsForDrivers = async () => {
      // Get all drivers that are on leave or day off
      const driversOnLeave = schedules
        .filter(s => s.is_day_off || s.is_annual_leave)
        .map(s => s.driver_id)

      // Fetch shifts for each driver
      for (const driverId of driversOnLeave) {
        await fetchDriverShifts(driverId)
      }
    }

    fetchShiftsForDrivers()
  }, [schedules])

  // Filter drivers based on search query and status
  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch = 
      driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.staff_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.car_number?.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    if (statusFilter.length === 0) return true

    const schedule = getDriverSchedule(driver.id)
    return statusFilter.some(filter => {
      switch (filter) {
        case "available":
          return !schedule?.is_day_off && !schedule?.is_annual_leave
        case "dayOff":
          return schedule?.is_day_off
        case "annual":
          return schedule?.is_annual_leave
        default:
          return true
      }
    })
  })

  // Group drivers by status for better organization
  const groupedDrivers = {
    onDuty: filteredDrivers.filter(d => {
      const schedule = getDriverSchedule(d.id)
      return !schedule?.is_day_off && !schedule?.is_annual_leave
    }),
    dayOff: filteredDrivers.filter(d => {
      const schedule = getDriverSchedule(d.id)
      return schedule?.is_day_off
    }),
    annual: filteredDrivers.filter(d => {
      const schedule = getDriverSchedule(d.id)
      return schedule?.is_annual_leave
    })
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
                          <h5 className="font-medium mb-2">Assign Replacements</h5>
                          <div className="space-y-4">
                            {shifts.filter(shift => 
                              schedule.replacements.some(r => r.shift_id === shift.id) || // Show shifts that already have replacements
                              driverShifts.some(ds => ds.shift_id === shift.id) // Show shifts assigned to the driver
                            ).map(shift => {
                              const replacement = schedule.replacements.find(r => r.shift_id === shift.id)
                              return (
                                <div key={shift.id} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label className="font-medium">
                                      {shift.name}
                                      <span className="ml-2 font-normal text-sm text-muted-foreground">
                                        ({shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)})
                                      </span>
                                    </Label>
                                  </div>
                                  <Select
                                    onValueChange={(value) => {
                                      if (value) {
                                        if (replacement) {
                                          handleUpdateReplacement(replacement.id, value, schedule.driver_id, schedule.id)
                                        } else {
                                          handleAssignReplacement(schedule.id, value, schedule.driver_id, shift.id)
                                        }
                                      }
                                    }}
                                    value={replacement?.replacement_driver_id || ""}
                                    disabled={loading}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder={`Select replacement driver for ${shift.name}`} />
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
                              )
                            })}
                          </div>
                          {schedule.replacements.length > 0 && (
                            <div className="mt-4 space-y-3">
                              <h6 className="text-sm font-medium text-muted-foreground">Current Replacements:</h6>
                              {schedule.replacements.map(replacement => {
                                const replacementDriver = drivers.find(d => d.id === replacement.replacement_driver_id)
                                const replacementShift = shifts.find(s => s.id === replacement.shift_id)
                                return (
                                  <div key={replacement.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                    <div>
                                      <div className="font-medium">{replacementDriver?.name}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {replacementDriver?.staff_id} - {replacementShift?.name}
                                        {replacementShift?.start_time && replacementShift?.end_time && (
                                          <span className="ml-1">
                                            ({replacementShift.start_time.substring(0, 5)} - {replacementShift.end_time.substring(0, 5)})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
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
              <CardHeader className="pb-3">
                <CardTitle>Manage Drivers</CardTitle>
                <CardDescription>Set day off or annual leave for drivers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-4">
                    <Select
                      onValueChange={(value) => setSearchQuery(value)}
                      value={searchQuery}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a driver" />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            {driver.name} ({driver.staff_id}) {driver.car_number ? `- Car: ${driver.car_number}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {searchQuery && (
                      <div className="rounded-lg border p-4">
                        {(() => {
                          const driver = drivers.find(d => d.id === searchQuery);
                          const schedule = getDriverSchedule(searchQuery);
                          
                          if (!driver) return null;
                          
                          return (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium">{driver.name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {driver.staff_id}
                                    {driver.car_number && ` - Car: ${driver.car_number}`}
                                  </p>
                                </div>
                                {(schedule?.is_day_off || schedule?.is_annual_leave) && (
                                  <div className={cn(
                                    "text-sm font-medium rounded-full px-3 py-1",
                                    schedule.is_day_off 
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                                      : "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                                  )}>
                                    {schedule.is_day_off ? "Day Off" : "Annual Leave"}
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-4">
                                <Button
                                  variant={schedule?.is_day_off ? "default" : "outline"}
                                  onClick={() => handleScheduleUpdate(driver.id, "day_off")}
                                  disabled={loading || schedule?.is_annual_leave}
                                  className={cn(
                                    "flex-1",
                                    schedule?.is_day_off && "bg-blue-600 hover:bg-blue-700"
                                  )}
                                >
                                  {schedule?.is_day_off ? "Remove Day Off" : "Mark as Day Off"}
                                </Button>
                                <Button
                                  variant={schedule?.is_annual_leave ? "default" : "outline"}
                                  onClick={() => handleScheduleUpdate(driver.id, "annual_leave")}
                                  disabled={loading || schedule?.is_day_off}
                                  className={cn(
                                    "flex-1",
                                    schedule?.is_annual_leave && "bg-green-600 hover:bg-green-700"
                                  )}
                                >
                                  {schedule?.is_annual_leave ? "Remove Annual Leave" : "Mark as Annual Leave"}
                                </Button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Drivers Off Today</h3>
                    {['dayOff', 'annual'].map((group) => {
                      const groupDrivers = group === 'dayOff' ? groupedDrivers.dayOff : groupedDrivers.annual;
                      return groupDrivers.length > 0 && (
                        <div key={group} className="rounded-lg border p-4">
                          <h4 className={cn(
                            "text-sm font-medium mb-2",
                            group === 'dayOff' ? "text-blue-600" : "text-green-600"
                          )}>
                            {group === 'dayOff' ? 'Day Off' : 'Annual Leave'} ({groupDrivers.length})
                          </h4>
                          <div className="space-y-2">
                            {groupDrivers.map((driver) => (
                              <div key={driver.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded-md">
                                <span>{driver.name} ({driver.staff_id})</span>
                                {driver.car_number && (
                                  <span className="text-muted-foreground">Car: {driver.car_number}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {groupedDrivers.dayOff.length === 0 && groupedDrivers.annual.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground border rounded-lg">
                        No drivers are off today
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
