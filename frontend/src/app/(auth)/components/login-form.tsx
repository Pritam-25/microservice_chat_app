"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"
import { toast } from "sonner"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form"
import { useRouter } from "next/navigation"
import { loginSchema, LoginInput } from "@/lib/schemas"
import { getAxiosErrorMessage } from "@/utils/axiosError"
import { PasswordInput } from "@/components/ui/passwordInput"
import useAuthStore from "@/zustand/useAuthStore"
import { Loader2 } from "lucide-react"
import Image from "next/image"


export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {

  const { setAuthUser } = useAuthStore()
  const router = useRouter()

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = async (values: LoginInput) => {
    try {
      const authBase = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:5000"
      const response = await axios.post(`${authBase}/api/v1/auth/login`, values, {
        withCredentials: true, // ✅ store JWT cookie
      })

      toast.success("Login successful!")
      console.log("✅ Login successful:", response.data)
      setAuthUser({ username: response.data.user.username })
      router.replace("/chat") // redirect after login
    } catch (error: unknown) {
      const msg = getAxiosErrorMessage(error)
      toast.error(msg)
      console.error("❌ Login error:", axios.isAxiosError(error) ? (error.response?.data || error.message) : error)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="p-6 md:p-8 w-full"
            >
              <div className="flex flex-col gap-6">
                {/* Title */}
                <div className="flex flex-col items-center text-center">
                  <h1 className="text-2xl font-bold">Welcome back</h1>
                  <p className="text-muted-foreground text-balance">
                    Login to your ChatApp account
                  </p>
                </div>

                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="m@example.com" {...field} autoFocus />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Password */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center">
                        <FormLabel>Password</FormLabel>
                        <Link
                          href="/forgot-password"
                          className="ml-auto text-sm underline-offset-2 hover:underline"
                        >
                          Forgot your password?
                        </Link>
                      </div>
                      <FormControl>
                        <PasswordInput placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full cursor-pointer"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Logging in...
                    </span>
                  ) : (
                    "Login"
                  )}
                </Button>

                {/* Switch to signup */}
                <div className="text-center text-sm">
                  Don&apos;t have an account?{" "}
                  <Link href="/signup" className="underline underline-offset-4">
                    Sign up
                  </Link>
                </div>
              </div>
            </form>
          </Form>

          {/* Right Side Image */}
          <div className="bg-muted relative hidden md:block">
            <Image
              src="/sign-in-avatar.svg"
              alt="Sign in illustration"
              fill
              priority
              className="object-contain dark:brightness-[0.2] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        By clicking continue, you agree to our{" "}
        <Link href="#">Terms of Service</Link> and{" "}
        <Link href="#">Privacy Policy</Link>.
      </div>
    </div>
  )
}
