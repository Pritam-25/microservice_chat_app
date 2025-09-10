"use client"
import { useEffect } from "react"
import axios from "axios"
import { useRouter } from "next/navigation"
import { SignUpForm } from "@/app/(auth)/components/signup-form";
import { getAuthUrl } from "@/lib/utils"

export default function SignUpPage() {
  const router = useRouter()

  useEffect(() => {
    let active = true
      ; (async () => {
        try {
          const authBase = getAuthUrl()
          await axios.get(`${authBase}/api/v1/auth/me`, { withCredentials: true })
          if (!active) return
          router.replace("/chat")
        } catch {
          // not logged in -> stay on page
        }
      })()
    return () => { active = false }
  }, [router])
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-3xl">
        <SignUpForm />
      </div>
    </div>
  )
}
