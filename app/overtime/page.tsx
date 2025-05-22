"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSupabaseClient } from "@/lib/supabase/client"
import { OvertimeForm } from "@/components/overtime-form"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"

export default function OvertimePage() {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const [recentOvertimeRecords, setRecentOvertimeRecords] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [shifts, setShifts] = useState<any[]>([])

  // Fetch data on component mount
  const fetchData = async () => {
    const supabase = getSupabaseClient()
    const { data: driversData } = await supabase.from("drivers").select("id, name, staff_id").order("name")
    const { data: shiftsData } = await supabase.from("shifts").select("id, name, start_time, end_time").order("name")
    const { data: records } = await supabase
      .from("overtime_records")
      .select(`
        id,
        driver_id,
        date,
        hours,
        ot_type,
        ot_rate,
        drivers (
          name,
          staff_id
        )
      `)
      .order("date", { ascending: false })
      .limit(10)

    setDrivers(driversData || [])
    setShifts(shiftsData || [])
    setRecentOvertimeRecords(records || [])
  }

  // Fetch data when component mounts
  useEffect(() => {
    fetchData()
  }, [])

  // Handle delete overtime record
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
      fetchData()
      router.refresh()
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
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Overtime Management</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Record Overtime</CardTitle>
          </CardHeader>
          <CardContent>
            <OvertimeForm 
              drivers={drivers} 
              shifts={shifts} 
              onSuccess={fetchData} 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Overtime Records</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOvertimeRecords && recentOvertimeRecords.length > 0 ? (
              <div className="space-y-4">
                {recentOvertimeRecords.map((record) => (
                  <div key={record.id} className="p-3 border rounded-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{record.drivers?.name}</div>
                        <div className="text-sm text-muted-foreground">{record.drivers?.staff_id}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-medium">{record.hours} hours</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(record.date).toLocaleDateString()} - {record.ot_type} ({record.ot_rate}x)
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-100"
                          onClick={() => handleDelete(record.id)}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-center py-4">No overtime records found</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
