"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { useState } from "react"

const formSchema = z.object({
  driver_id: z.string({
    required_error: "Please select a driver.",
  }),
  date: z.date({
    required_error: "Please select a date.",
  }),
  hours: z.coerce.number().min(0.5, {
    message: "Hours must be at least 0.5.",
  }),
  ot_type: z.enum(["normal", "holiday", "day_off", "night"], {
    required_error: "Please select an overtime type.",
  }),
})

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

interface OvertimeFormProps {
  drivers: Driver[]
  shifts: Shift[]
  onSuccess?: () => void
}

export function OvertimeForm({ drivers, shifts, onSuccess }: OvertimeFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      hours: 0,
    },
  })

  // Get OT rate based on type
  const getOTRate = (type: string) => {
    switch (type) {
      case "normal":
        return 1.5
      case "holiday":
        return 2.0
      case "day_off":
        return 2.0
      case "night":
        return 2.0
      default:
        return 1.0
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    const supabase = getSupabaseClient()

    try {
      const { error } = await supabase.from("overtime_records").insert({
        driver_id: values.driver_id,
        date: values.date.toISOString().split("T")[0],
        hours: values.hours,
        ot_type: values.ot_type,
        ot_rate: getOTRate(values.ot_type),
      })

      if (error) throw error

      toast({
        title: "Overtime recorded",
        description: "Overtime has been recorded successfully.",
      })

      form.reset()
      router.refresh()
      onSuccess?.()
    } catch (error) {
      console.error("Error recording overtime:", error)
      toast({
        title: "Error",
        description: "There was a problem recording the overtime.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="driver_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Driver</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a driver" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name} ({driver.staff_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                    >
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="hours"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hours</FormLabel>
              <FormControl>
                <Input type="number" step="0.5" {...field} />
              </FormControl>
              <FormDescription>Enter the number of overtime hours worked</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ot_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Overtime Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select overtime type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="normal">Normal OT (150%)</SelectItem>
                  <SelectItem value="holiday">Holiday OT (200%)</SelectItem>
                  <SelectItem value="day_off">Day-off OT (200%)</SelectItem>
                  <SelectItem value="night">Night OT (200%)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>Select the type of overtime based on when it was worked</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Record Overtime"}
        </Button>
      </form>
    </Form>
  )
}
