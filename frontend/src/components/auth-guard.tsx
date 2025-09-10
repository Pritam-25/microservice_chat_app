"use client"
import { useEffect, useState } from "react"
import axios from "axios"
import { useRouter } from "next/navigation"
import useAuthStore from "@/zustand/useAuthStore"
import { Loader2 } from "lucide-react"
import { getAuthUrl } from "@/lib/utils"

type Props = {
  children: React.ReactNode
}

export default function AuthGuard({ children }: Props) {
  const router = useRouter()
  const { authUser, setAuthUser } = useAuthStore()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let isMounted = true
    const checkAuth = async () => {
      try {
        const authBase = getAuthUrl()
        const res = await axios.get(`${authBase}/api/v1/auth/me`, {
          withCredentials: true,
        })
        if (!isMounted) return
        const username: string | undefined = res.data?.user?.username
        if (username) setAuthUser({ username })
        setChecking(false)
      } catch {
        if (!isMounted) return
        setChecking(false)
        router.replace("/login")
      }
    }
    checkAuth()
    return () => {
      isMounted = false
    }
  }, [router, setAuthUser])

  // Also block render if we know user is not present yet
  if (checking || !authUser) {
    return (
      <div className="w-full h-[60vh] flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="animate-spin size-4 mr-2" />
        Checking authentication...
      </div>
    )
  }

  return <>{children}</>
}
