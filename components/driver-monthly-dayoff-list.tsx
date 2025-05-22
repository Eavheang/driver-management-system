"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Trash2, Loader2, Calendar, ChevronDown, ChevronUp } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface Driver {
  id: string
  name: string
  staff_id: string
}

interface DayOffPattern {
  id: string
  driver_id: string
  month: number
  year: number
  day_of_week: number
}

interface DriverMonthlyDayoffListProps {
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

const ITEMS_PER_PAGE = 5

export function DriverMonthlyDayoffList({ drivers, initialMonth, initialYear }: DriverMonthlyDayoffListProps) {
  const [patterns, setPatterns] = useState<DayOffPattern[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const { toast } = useToast()
  const router = useRouter()
  const supabase = getSupabaseClient()

  const currentMonth = initialMonth || new Date().getMonth() + 1
  const currentYear = initialYear || new Date().getFullYear()

  // Calculate pagination
  const totalPages = Math.ceil(patterns.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentPatterns = patterns.slice(startIndex, endIndex)

  // Fetch existing patterns
  const fetchPatterns = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from("driver_monthly_dayoff")
        .select("*")
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .order("created_at", { ascending: false })

      if (error) throw error

      setPatterns(data || [])
    } catch (error) {
      console.error("Error fetching patterns:", error)
      toast({
        title: "Error",
        description: "Failed to load day-off patterns.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Set up real-time subscription
  useEffect(() => {
    fetchPatterns()

    // Subscribe to changes
    const channel = supabase
      .channel('driver_monthly_dayoff_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_monthly_dayoff',
          filter: `month=eq.${currentMonth},year=eq.${currentYear}`
        },
        (payload) => {
          // Handle different types of changes
          if (payload.eventType === 'DELETE') {
            setPatterns(current => current.filter(p => p.id !== payload.old.id))
          } else if (payload.eventType === 'INSERT') {
            setPatterns(current => [payload.new as DayOffPattern, ...current])
          } else if (payload.eventType === 'UPDATE') {
            setPatterns(current => 
              current.map(p => p.id === payload.new.id ? payload.new as DayOffPattern : p)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentMonth, currentYear, supabase])

  const handleDelete = async (patternId: string) => {
    setIsLoading(true)

    try {
      // First, get the pattern details to know which month/year/driver to clean up
      const { data: pattern, error: patternError } = await supabase
        .from("driver_monthly_dayoff")
        .select("*")
        .eq("id", patternId)
        .single()

      if (patternError) throw patternError

      // Optimistically update UI
      setPatterns(current => current.filter(p => p.id !== patternId))

      // Delete all schedule entries for this driver in the specified month
      const startDate = new Date(pattern.year, pattern.month - 1, 1)
      const endDate = new Date(pattern.year, pattern.month, 0)
      
      const { error: scheduleError } = await supabase
        .from("schedules")
        .delete()
        .eq("driver_id", pattern.driver_id)
        .eq("is_day_off", true)
        .gte("date", startDate.toISOString().split("T")[0])
        .lte("date", endDate.toISOString().split("T")[0])

      if (scheduleError) throw scheduleError

      // Now delete the pattern itself
      const { error: deleteError } = await supabase
        .from("driver_monthly_dayoff")
        .delete()
        .eq("id", patternId)

      if (deleteError) {
        // If delete failed, revert the optimistic update
        fetchPatterns()
        throw deleteError
      }

      toast({
        title: "Success",
        description: "Day-off pattern and associated schedules have been deleted.",
      })

      router.refresh()
    } catch (error) {
      console.error("Error deleting pattern:", error)
      toast({
        title: "Error",
        description: "Failed to delete day-off pattern.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="p-0 hover:bg-transparent">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <CardTitle className="text-base">
                    Monthly Day-Off Patterns
                    <span className="ml-2 text-muted-foreground text-sm font-normal">
                      ({patterns.length} {patterns.length === 1 ? 'pattern' : 'patterns'})
                    </span>
                  </CardTitle>
                  {isOpen ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
                </div>
              </Button>
            </CollapsibleTrigger>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="p-0">
            {patterns.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead>Staff ID</TableHead>
                      <TableHead>Day Off</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPatterns.map((pattern) => {
                      const driver = drivers.find(d => d.id === pattern.driver_id)
                      if (!driver) return null

                      return (
                        <TableRow key={pattern.id}>
                          <TableCell className="font-medium py-2">{driver.name}</TableCell>
                          <TableCell className="text-muted-foreground py-2">{driver.staff_id}</TableCell>
                          <TableCell className="py-2">
                            {DAYS_OF_WEEK.find(d => Number(d.value) === pattern.day_of_week)?.label}
                          </TableCell>
                          <TableCell className="py-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" 
                                  disabled={isLoading}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Day-Off Pattern</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will delete the day-off pattern for {driver.name} and remove all associated day-off entries.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(pattern.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 py-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-center text-sm text-muted-foreground">
                <Calendar className="h-8 w-8 mb-2 text-muted-foreground/50" />
                <p>No day-off patterns set for {new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' })} {currentYear}</p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
} 