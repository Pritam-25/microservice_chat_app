import axios from "axios"

export function getAxiosErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; errors?: { message?: string }[] }
      | string
      | undefined

    // ✅ If backend sends a top-level `message`
    if (data && typeof data === "object" && "message" in data && data.message) {
      return data.message
    }

    // ✅ If backend sends validation errors (array of errors)
    if (data && typeof data === "object" && "errors" in data && Array.isArray(data.errors)) {
      const firstError = data.errors[0]
      if (firstError?.message) return firstError.message
    }

    // ✅ If response is just a string
    if (typeof data === "string") return data

    // ✅ Fallback to status text
    return error.response?.statusText || "Request failed"
  }

  if (error instanceof Error) return error.message

  return "Something went wrong. Please try again."
}
