"use client"
import useAuthStore from "@/zustand/useAuthStore"

export const useUser = () => {
  const authUser = useAuthStore((s) => s.authUser)
  return { username: authUser?.username ?? null }
}

export default useUser
