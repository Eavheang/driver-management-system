"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  staff_id: z.string().min(1, {
    message: "Staff ID is required.",
  }),
  car_number: z.string().optional(),
  contact_number: z.string().optional(),
  shifts: z.array(
    z.object({
      id: z.string(),
      is_primary: z.boolean().default(false),
    }),
  ),
})

type ShiftType = {
  id: string
  name: string
  start_time?: string
  end_time?: string
}

interface DriverFormProps {
  shifts: ShiftType[]
  initialData?: any
}

export function DriverForm({ shifts, initialData }: DriverFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  // Initialize form with default values or existing data
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: "",
      staff_id: "",
      car_number: "",
      contact_number: "",
      shifts: shifts.map((shift) => ({
        id: shift.id,
        is_primary: false,
      })),
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    const supabase = getSupabaseClient()

    try {
      // Insert or update driver
      const driverOperation = initialData
        ? supabase
            .from("drivers")
            .update({
              name: values.name,
              staff_id: values.staff_id,
              car_number: values.car_number || null,
              contact_number: values.contact_number || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", initialData.id)
        : supabase.from("drivers").insert({
            name: values.name,
            staff_id: values.staff_id,
            car_number: values.car_number || null,
            contact_number: values.contact_number || null,
          })

      const { data: driver, error: driverError } = await driverOperation

      if (driverError) throw driverError

      // Get the driver ID
      let driverId = initialData?.id

      if (!driverId) {
        // If this was a new driver, get the ID
        const { data: newDriver } = await supabase.from("drivers").select("id").eq("staff_id", values.staff_id).single()

        driverId = newDriver?.id
      }

      // If updating, delete existing shift associations
      if (initialData) {
        await supabase.from("driver_shifts").delete().eq("driver_id", driverId)
      }

      // Insert shift associations for selected shifts
      const selectedShifts = values.shifts
        .filter((shift) => shift.is_primary)
        .map((shift) => ({
          driver_id: driverId,
          shift_id: shift.id,
          is_primary: true,
        }))

      if (selectedShifts.length > 0) {
        const { error: shiftsError } = await supabase.from("driver_shifts").insert(selectedShifts)

        if (shiftsError) throw shiftsError
      }

      toast({
        title: initialData ? "Driver updated" : "Driver created",
        description: initialData ? "Driver has been updated successfully." : "New driver has been added successfully.",
      })

      router.push("/drivers")
      router.refresh()
    } catch (error) {
      console.error("Error saving driver:", error)
      toast({
        title: "Error",
        description: "There was a problem saving the driver information.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Driver Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="staff_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Staff ID</FormLabel>
                    <FormControl>
                      <Input placeholder="D12345" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="car_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Car Number</FormLabel>
                    <FormControl>
                      <Input placeholder="ABC123" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+1234567890" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">Assigned Shifts</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {shifts.map((shift, index) => (
                  <FormField
                    key={shift.id}
                    control={form.control}
                    name={`shifts.${index}.is_primary`}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-medium">{shift.name}</FormLabel>
                          {shift.start_time && shift.end_time && (
                            <FormDescription>
                              {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}
                            </FormDescription>
                          )}
                        </div>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : initialData ? "Update Driver" : "Add Driver"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
