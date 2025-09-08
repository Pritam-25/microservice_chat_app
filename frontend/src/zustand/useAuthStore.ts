import { create } from 'zustand'

type AuthStore = {
  authUser: string
  setAuthUser: (user: string) => void
}

const useAuthStore = create<AuthStore>((set) => ({
  authUser: '',
  setAuthUser: (user) => set({ authUser: user })
}))

export default useAuthStore