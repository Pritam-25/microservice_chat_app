import { create } from 'zustand'

export type AuthUser = {
  username: string
  token?: string // optional JWT (future enhancement)
}

type AuthStore = {
  authUser: AuthUser | null
  setAuthUser: (user: AuthUser | null) => void
}

const useAuthStore = create<AuthStore>((set) => ({
  authUser: null,
  setAuthUser: (user) => set({ authUser: user })
}))

export default useAuthStore