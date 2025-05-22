"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar, Users, Clock, FileSpreadsheet, Home, LogOut } from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { cn } from "@/lib/utils"

export function MainNav() {
  const pathname = usePathname()
  const { logout, isAuthenticated } = useAuth()

  const routes = [
    {
      href: "/",
      label: "Dashboard",
      icon: <Home className="mr-2 h-4 w-4" />,
      active: pathname === "/",
    },
    {
      href: "/schedule",
      label: "Schedule",
      icon: <Calendar className="mr-2 h-4 w-4" />,
      active: pathname === "/schedule" || pathname.startsWith("/schedule/"),
    },
    {
      href: "/drivers",
      label: "Drivers",
      icon: <Users className="mr-2 h-4 w-4" />,
      active: pathname === "/drivers" || pathname.startsWith("/drivers/"),
    },
    {
      href: "/overtime",
      label: "Overtime",
      icon: <Clock className="mr-2 h-4 w-4" />,
      active: pathname === "/overtime" || pathname.startsWith("/overtime/"),
    },
    {
      href: "/reports",
      label: "Reports",
      icon: <FileSpreadsheet className="mr-2 h-4 w-4" />,
      active: pathname === "/reports",
    },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="flex h-16 items-center justify-between max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold text-lg hidden sm:inline-block">Driver Schedule App</span>
            <span className="font-bold text-lg sm:hidden">DSA</span>
          </Link>
        </div>
        <nav className="flex items-center">
          <div className="flex space-x-1 overflow-x-auto">
            {routes.map((route) => (
              <Button 
                key={route.href} 
                variant={route.active ? "default" : "ghost"} 
                asChild 
                className="whitespace-nowrap"
                size={route.label === "Dashboard" ? "icon" : "default"}
              >
                <Link href={route.href} className="flex items-center">
                  {route.icon}
                  <span className={route.label === "Dashboard" ? "hidden" : "hidden sm:inline-block"}>{route.label}</span>
                </Link>
              </Button>
            ))}
          </div>
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="ml-4"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
