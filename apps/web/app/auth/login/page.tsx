"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { GuestGuard } from "../../components/auth/guest-guard";
import { getApiUrl } from "../../lib/api";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .pipe(z.email("Enter a valid email address.")),
  password: z
    .string()
    .min(1, "Password is required.")
    .min(8, "Password must be at least 8 characters."),
  remember: z.boolean(),
});

type LoginFormValues = z.input<typeof loginSchema>;
type LoginPayload = z.output<typeof loginSchema>;

type LoginResponse = {
  error?: string;
  user?: unknown;
};

class LoginError extends Error {
  /**
   * Creates a login error from an API response.
   *
   * @param message User-facing error message.
   */
  constructor(message: string) {
    super(message);
    this.name = "LoginError";
  }
}

/**
 * Authenticates a user with the API.
 *
 * @param values Login form values.
 * @returns Authenticated user payload.
 */
const login = async ({ email, password, remember }: LoginPayload) => {
  const response = await fetch(getApiUrl("/api/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ email, password, remember }),
  });
  const payload = (await response.json().catch(() => ({}))) as LoginResponse;

  if (!response.ok) {
    throw new LoginError(payload.error ?? "Login failed. Check your email and password.");
  }

  return payload;
};

/**
 * Renders the guarded login route.
 *
 * @returns The application login screen.
 */
export default function LoginRoute() {
  return (
    <GuestGuard>
      <LoginPage />
    </GuestGuard>
  );
}

/**
 * Renders the inventory login page from the Figma login frame.
 *
 * @returns The application login screen.
 */
function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const {
    formState: { errors },
    handleSubmit,
    register,
    watch,
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
      remember: true,
    },
    resolver: zodResolver(loginSchema),
  });
  const remember = watch("remember");
  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: async (payload) => {
      queryClient.setQueryData(["auth", "me"], payload.user);
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      const next = searchParams.get("next");
      const redirectPath = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

      router.replace(redirectPath);
    },
  });
  const emailFieldClassName = `flex min-h-[55px] w-full cursor-text flex-col rounded-[10px] border px-4 py-[7px] focus-within:outline-[3px] focus-within:outline-offset-2 ${
    errors.email
      ? "border-[#b42318] focus-within:outline-[rgba(180,35,24,0.25)]"
      : "border-[#006ec4] focus-within:outline-[rgba(0,110,196,0.25)]"
  }`;
  const passwordFieldClassName = `flex min-h-[55px] w-full cursor-text flex-col rounded-[10px] border px-4 py-[7px] focus-within:outline-[3px] focus-within:outline-offset-2 ${
    errors.password
      ? "border-[#b42318] focus-within:outline-[rgba(180,35,24,0.25)]"
      : "border-[#006ec4] focus-within:outline-[rgba(0,110,196,0.25)]"
  }`;
  const rememberIconClassName = `inline-flex h-6 w-6 items-center justify-center rounded border border-[#006ec4] ${
    remember ? "bg-[#006ec4] text-white" : "bg-white text-transparent"
  }`;
  const errorMessage =
    errors.email?.message ?? errors.password?.message ?? loginMutation.error?.message;

  return (
    <main className="grid min-h-svh grid-cols-[minmax(360px,815px)_minmax(320px,445px)] items-center gap-[clamp(48px,7vw,92px)] bg-white py-[30px] pr-[clamp(24px,6.25vw,100px)] pl-[30px] text-[#16151c] max-[900px]:grid-cols-1 max-[900px]:justify-items-center max-[900px]:gap-8 max-[900px]:p-6 max-[520px]:p-[18px]">
      <section
        className="h-[min(964px,calc(100svh-60px))] min-h-[620px] w-full rounded-[30px] bg-[rgba(0,110,196,0.05)] max-[900px]:h-[220px] max-[900px]:min-h-[220px] max-[520px]:h-[120px] max-[520px]:min-h-[120px] max-[520px]:rounded-[20px]"
        aria-hidden="true"
      />

      <section
        className="w-[min(100%,445px)] justify-self-start max-[900px]:justify-self-center"
        aria-labelledby="login-title"
      >
        <div className="mb-[39px] inline-flex items-center gap-3 max-[520px]:mb-7">
          <span className="relative block h-9 w-[38px]" aria-hidden="true">
            <span className="absolute top-px left-2 h-[21px] w-[21px] rotate-[30deg] skew-y-[-30deg] bg-[#0076d7]" />
            <span className="absolute top-3.5 left-0.5 h-[21px] w-[21px] rotate-[30deg] skew-y-[-30deg] bg-[#f00456]" />
            <span className="absolute top-3.5 right-0.5 h-[21px] w-[21px] rotate-[30deg] skew-y-[-30deg] bg-[#ffba08]" />
          </span>
          <span className="text-lg leading-6 font-bold text-[#0f0f11]">Inventory</span>
        </div>

        <div className="mb-6">
          <h1
            id="login-title"
            className="m-0 mb-[5px] text-[30px] leading-10 font-semibold tracking-normal max-[520px]:text-[26px] max-[520px]:leading-[34px]"
          >
            Welcome
          </h1>
          <p className="m-0 text-base leading-6 font-light text-[#a2a1a8]">Please login here</p>
        </div>

        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={handleSubmit((values) => loginMutation.mutate(values))}
        >
          <label className={emailFieldClassName}>
            <span className="text-[11px] leading-4 font-light text-[#006ec4]">Email Address</span>
            <input
              className="w-full min-w-0 border-0 bg-transparent p-0 text-base leading-6 font-light text-[#16151c] outline-0"
              type="text"
              inputMode="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
          </label>

          <label className={passwordFieldClassName}>
            <span className="text-[11px] leading-4 font-light text-[#006ec4]">Password</span>
            <span className="relative block h-6">
              <input
                className="h-6 w-full min-w-0 border-0 bg-transparent p-0 pr-8 text-base leading-6 font-light text-[#16151c] outline-0"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
              />
              <button
                className="absolute top-1/2 right-0 grid h-6 w-6 -translate-y-1/2 cursor-pointer place-items-center border-0 bg-transparent p-0 text-[#16151c] leading-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[rgba(0,110,196,0.25)] [&>svg]:block [&>svg]:h-6 [&>svg]:w-6"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? (
                  <Eye size={24} strokeWidth={1.6} />
                ) : (
                  <EyeOff size={24} strokeWidth={1.6} />
                )}
              </button>
            </span>
          </label>

          <div className="mt-[-1px] flex items-center justify-between gap-6 max-[520px]:flex-col max-[520px]:items-start max-[520px]:gap-2.5">
            <label className="relative inline-flex cursor-pointer items-center gap-2.5 text-base leading-6 font-light whitespace-nowrap text-[#16151c]">
              <input
                className="absolute m-0 h-6 w-6 opacity-0 focus-visible:[&+span]:outline-[3px] focus-visible:[&+span]:outline-offset-2 focus-visible:[&+span]:outline-[rgba(0,110,196,0.25)]"
                type="checkbox"
                {...register("remember")}
              />
              <span className={rememberIconClassName}>
                {remember ? <Check size={17} strokeWidth={3} /> : null}
              </span>
              <span>Remember Me</span>
            </label>

            <a
              className="text-sm leading-[22px] font-light whitespace-nowrap text-[#006ec4] no-underline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[rgba(0,110,196,0.25)]"
              href="/forgot-password"
            >
              Forgot Password?
            </a>
          </div>

          {errorMessage ? (
            <p className="m-0 text-sm leading-[22px] font-light text-[#b42318]" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button
            className="mt-3.5 flex h-14 w-full cursor-pointer items-center justify-center rounded-[10px] border-0 bg-[#006ec4] text-base leading-6 font-light text-white hover:bg-[#0879d3] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[rgba(0,110,196,0.25)] disabled:cursor-not-allowed disabled:opacity-70"
            type="submit"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "Logging in..." : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}
