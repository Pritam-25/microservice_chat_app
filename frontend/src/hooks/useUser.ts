import useAuthStore from "@/zustand/useAuthStore"

export const useUser = () => {
  const { authUser } = useAuthStore()
  return { username: authUser }
}

export default useUser
