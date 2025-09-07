import { create } from "zustand"

export type User = {
  _id: string
  username: string
}

type UserStore = {
  users: User[]
  updateUsers: (users: User[]) => void
}

const useUserStore = create<UserStore>((set) => ({
  users: [],
  updateUsers: (users) => set({ users })
}))

export default useUserStore