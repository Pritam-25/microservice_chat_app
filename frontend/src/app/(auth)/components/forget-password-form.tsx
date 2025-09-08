"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form"
import Link from "next/link"
import axios from "axios"
import { toast } from "sonner"
import { ForgotPasswordInput, forgotPasswordSchema } from "@/lib/schemas"
import { getAxiosErrorMessage } from "@/utils/axiosError"


export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  })

  const onSubmit = async (values: ForgotPasswordInput) => {
    try {
      const authBase = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:5000"
      const response = await axios.post(
        `${authBase}/auth/v1/forgot-password`,
        values
      )

      toast.success("Password reset link sent! Please check your email.")
      console.log("✅ Forgot Password:", response.data)
    } catch (error: unknown) {
      const msg = getAxiosErrorMessage(error)
      toast.error(msg)
      console.error("❌ Forgot Password error:", axios.isAxiosError(error) ? (error.response?.data || error.message) : error)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          {/* Form */}
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="p-6 md:p-8 w-full"
            >
              <div className="flex flex-col gap-6">
                {/* Title */}
                <div className="flex flex-col items-center text-center">
                  <h1 className="text-2xl font-bold">Forgot Password</h1>
                  <p className="text-muted-foreground text-balance">
                    we&apos;ll send you a reset link to your email
                  </p>
                </div>

                {/* Email Field */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="m@example.com"
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Submit */}
                <Button type="submit" className="w-full">
                  Send Reset Link
                </Button>

                {/* Back to login */}
                <div className="text-center text-sm">
                  Remember your password?{" "}
                  <Link href="/login" className="underline underline-offset-4">
                    Login
                  </Link>
                </div>
              </div>
            </form>
          </Form>

          {/* Right Side Image */}
          <div className="bg-muted relative hidden md:block">
            <img
              src="/forgot-password-avatar.svg"
              alt="Forgot Password Image"
              className="absolute inset-0 h-full w-full object-fit dark:brightness-[0.2] dark:grayscale"
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