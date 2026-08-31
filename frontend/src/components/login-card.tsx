import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCustomerIdLoginMutation } from "@/hooks/useAuthMutations";
import { getApiErrorMessage } from "@/lib/apiClient";

export function LoginCard() {
  const [showPassword, setShowPassword] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = useCustomerIdLoginMutation();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loginMutation.isPending) return;
    loginMutation.mutate({ customerId: customerId.trim().toUpperCase(), password });
  }

  return (
    <section className="login-card w-full max-w-[465px] rounded-2xl border border-white/80 bg-white px-7 py-7 shadow-card sm:px-10 sm:py-8" aria-labelledby="login-heading">
      <div className="text-center">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-bank-blue">
          Secure access
        </p>
        <h1 id="login-heading" className="text-[25px] font-bold tracking-[-0.025em] text-bank-navy sm:text-[28px]">
          Welcome to Internet Banking
        </h1>
        <div className="mx-auto mt-3 h-1 w-12 rounded-full bg-bank-blue" />
      </div>

      <form className="login-card-form mt-7 space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="customer-id" className="block text-sm font-semibold text-bank-text">
            Customer ID
          </label>
          <Input
            id="customer-id"
            name="customerId"
            value={customerId}
            onChange={(event) => { setCustomerId(event.target.value.toUpperCase()); loginMutation.reset(); }}
            autoComplete="username"
            placeholder="Enter your Customer ID"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-semibold text-bank-text">
            Password
          </label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              value={password}
              onChange={(event) => { setPassword(event.target.value); loginMutation.reset(); }}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="pr-12"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-bank-muted transition hover:text-bank-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bank-blue"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </div>

        {loginMutation.isError ? <p className="text-center text-xs text-red-600" role="alert">{getApiErrorMessage(loginMutation.error)}</p> : null}
        <Button type="submit" size="large" className="w-full text-[15px] tracking-[0.08em]" disabled={!customerId.trim() || !password || loginMutation.isPending}>
          {loginMutation.isPending ? "SIGNING IN…" : "LOGIN"}
        </Button>
      </form>

      <div className="login-card-links mt-4 flex items-center justify-center gap-2 text-[13px] font-medium sm:gap-3 sm:text-sm">
        <Link className="text-bank-blue hover:underline" to="/forgot-customer-id">
          Forgot Customer ID?
        </Link>
        <span className="h-4 w-px bg-bank-border" aria-hidden="true" />
        <Link className="text-bank-blue hover:underline" to="/forgot-password">
          Forgot Password?
        </Link>
      </div>

      <div className="login-card-divider my-5 flex items-center gap-4 text-xs font-semibold text-bank-muted">
        <span className="h-px flex-1 bg-bank-border" />
        <span>OR</span>
        <span className="h-px flex-1 bg-bank-border" />
      </div>

      <div className="flex items-center justify-center gap-3">
        <span className="text-sm text-bank-muted">New User?</span>
        <Link to="/register">
          <Button variant="outline" className="h-10 min-w-28">
            Register
          </Button>
        </Link>
      </div>

      <div className="login-card-secure mt-6 flex items-center justify-center gap-3 rounded-xl border border-blue-100 bg-bank-light px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-bank-blue shadow-sm">
          <LockKeyhole size={18} strokeWidth={2.2} />
        </div>
        <div>
          <p className="text-sm font-semibold text-bank-navy">Secure Banking</p>
          <p className="mt-0.5 text-xs text-bank-muted">Your information is safe and encrypted</p>
        </div>
      </div>
    </section>
  );
}
