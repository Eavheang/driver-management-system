"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/lib/supabase/client"
import { AlertCircle, CheckCircle } from "lucide-react"

export function DatabaseConnectionStatus() {
  const [status, setStatus] = useState<"loading" | "connected" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const checkConnection = async () => {
    setIsChecking(true)
    setStatus("loading")
    setErrorMessage(null)

    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.from("shifts").select("id").limit(1)

      if (error) {
        console.error("Database connection error:", error)
        setStatus("error")
        setErrorMessage(error.message)
      } else {
        setStatus("connected")
      }
    } catch (err) {
      console.error("Failed to check database connection:", err)
      setStatus("error")
      setErrorMessage(err instanceof Error ? err.message : "Unknown error occurred")
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    checkConnection()
  }, [])

  return (
    <div className="flex flex-col items-center p-4 border rounded-md">
      <div className="flex items-center mb-2">
        {status === "loading" && (
          <div className="animate-spin h-5 w-5 border-2 border-primary rounded-full border-t-transparent mr-2"></div>
        )}
        {status === "connected" && <CheckCircle className="h-5 w-5 text-green-500 mr-2" />}
        {status === "error" && <AlertCircle className="h-5 w-5 text-red-500 mr-2" />}

        <span className="font-medium">
          {status === "loading" && "Checking database connection..."}
          {status === "connected" && "Connected to database"}
          {status === "error" && "Database connection error"}
        </span>
      </div>

      {status === "error" && errorMessage && (
        <div className="text-sm text-red-500 mb-2 text-center">{errorMessage}</div>
      )}

      <Button variant="outline" size="sm" onClick={checkConnection} disabled={isChecking}>
        {isChecking ? "Checking..." : "Check Connection"}
      </Button>
    </div>
  )
}
