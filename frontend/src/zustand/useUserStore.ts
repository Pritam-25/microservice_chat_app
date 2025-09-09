import { create } from "zustand"

export type User = {
  _id: string
  username: string
  online?: boolean
}

type UserStore = {
  users: User[]
  updateUsers: (users: User[]) => void
  setUserOnline: (userId: string, online: boolean) => void
}

const useUserStore = create<UserStore>((set) => ({
  users: [],
  updateUsers: (users) => set({ users }),
  setUserOnline: (userId, online) => set(state => ({
    users: state.users.map(u => u._id === userId ? { ...u, online } : u)
  }))
}))

export default useUserStore