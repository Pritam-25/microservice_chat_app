"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { getAxiosErrorMessage } from "@/utils/axiosError"
import { ResetPasswordInput, resetPasswordSchema } from "@/lib/schemas"
import { PasswordInput } from "@/components/ui/passwordInput"
import Image from "next/image"


export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const { token } = useParams<{ token: string }>() // from /reset-password/[token]

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmNewPassword: "",
    },
  })

  const onSubmit = async (values: ResetPasswordInput) => {
    try {
      if (!token) {
        toast.error("Reset link is invalid or missing.")
        return
      }

      const authBase = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:5000"
      const res = await axios.post(
        `${authBase}/api/v1/auth/reset-password/${token}`,
        {
          newPassword: values.newPassword,
          confirmNewPassword: values.confirmNewPassword,
        }
      )

      toast.success("Password reset successful! Please log in.")
      console.log("✅ Reset Password:", res.data)
      setTimeout(() => router.push("/login"), 1000)
    } catch (error: unknown) {
      const msg = getAxiosErrorMessage(error)
      console.error("❌ Reset Password error:", axios.isAxiosError(error) ? (error.response?.data || error.message) : error)
      toast.error(msg)
    }
  }

  const isSubmitting = form.formState.isSubmitting

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 md:p-8 w-full">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center text-center">
                  <h1 className="text-2xl font-bold">Reset Password</h1>
                  <p className="text-muted-foreground text-balance">
                    Enter your new password
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <PasswordInput placeholder="••••••••" autoFocus {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmNewPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <PasswordInput placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Resetting..." : "Reset Password"}
                </Button>

                <div className="text-center text-sm">
                  <Link href="/login" className="underline underline-offset-4">
                    Back to Login
                  </Link>
                </div>
              </div>
            </form>
          </Form>

          {/* Right Side Image */}
          <div className="bg-muted relative hidden md:block">
            <Image
              src="/reset-password-avatar.svg"
              alt="Reset password illustration"
              fill
              priority
              className="object-contain dark:brightness-[0.2] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>

      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        By clicking continue, you agree to our <Link href="#">Terms of Service</Link> and{" "}
        <Link href="#">Privacy Policy</Link>.
      </div>
    </div>
  )
}
