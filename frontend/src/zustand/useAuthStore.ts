import { create } from 'zustand'

type AuthStore = {
  authUser: string | null
  setAuthUser: (user: string | null) => void
}

const useAuthStore = create<AuthStore>((set) => ({
  authUser: null,
  setAuthUser: (user) => set({ authUser: user })
}))

export default useAuthStore