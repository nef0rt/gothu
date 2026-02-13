"use client";

import { useState, useTransition } from "react";
import { loginAction, registerAction } from "@/lib/actions";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = mode === "login"
        ? await loginAction(formData)
        : await registerAction(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--tg-bg-secondary)" }}>
      <div className="w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: "var(--tg-accent)" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
              <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--tg-text-primary)" }}>RoviGram</h1>
          <p className="mt-2" style={{ color: "var(--tg-text-secondary)" }}>
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {/* Form */}
        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm text-center animate-fade-in">
              {error}
            </div>
          )}

          {mode === "register" && (
            <>
              <div>
                <input
                  name="displayName"
                  type="text"
                  placeholder="Display Name"
                  required
                  className="w-full px-4 py-3 rounded-lg text-sm transition-colors"
                  style={{
                    background: "var(--tg-input-bg)",
                    color: "var(--tg-text-primary)",
                    border: "2px solid var(--tg-border)",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "var(--tg-accent)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--tg-border)"}
                />
              </div>
              <div>
                <input
                  name="username"
                  type="text"
                  placeholder="Username"
                  required
                  pattern="[a-zA-Z0-9_]+"
                  className="w-full px-4 py-3 rounded-lg text-sm transition-colors"
                  style={{
                    background: "var(--tg-input-bg)",
                    color: "var(--tg-text-primary)",
                    border: "2px solid var(--tg-border)",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "var(--tg-accent)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--tg-border)"}
                />
              </div>
              <div>
                <input
                  name="phone"
                  type="tel"
                  placeholder="Phone Number"
                  required
                  className="w-full px-4 py-3 rounded-lg text-sm transition-colors"
                  style={{
                    background: "var(--tg-input-bg)",
                    color: "var(--tg-text-primary)",
                    border: "2px solid var(--tg-border)",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "var(--tg-accent)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--tg-border)"}
                />
              </div>
            </>
          )}

          {mode === "login" && (
            <div>
              <input
                name="login"
                type="text"
                placeholder="Phone or Username"
                required
                className="w-full px-4 py-3 rounded-lg text-sm transition-colors"
                style={{
                  background: "var(--tg-input-bg)",
                  color: "var(--tg-text-primary)",
                  border: "2px solid var(--tg-border)",
                }}
                onFocus={(e) => e.target.style.borderColor = "var(--tg-accent)"}
                onBlur={(e) => e.target.style.borderColor = "var(--tg-border)"}
              />
            </div>
          )}

          <div>
            <input
              name="password"
              type="password"
              placeholder="Password"
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-lg text-sm transition-colors"
              style={{
                background: "var(--tg-input-bg)",
                color: "var(--tg-text-primary)",
                border: "2px solid var(--tg-border)",
              }}
              onFocus={(e) => e.target.style.borderColor = "var(--tg-accent)"}
              onBlur={(e) => e.target.style.borderColor = "var(--tg-border)"}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 rounded-lg font-medium text-white text-sm transition-colors disabled:opacity-50"
            style={{ background: "var(--tg-accent)" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--tg-accent-hover)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "var(--tg-accent)"}
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {mode === "login" ? "Signing in..." : "Creating account..."}
              </span>
            ) : (
              mode === "login" ? "Sign In" : "Create Account"
            )}
          </button>
        </form>

        {/* Toggle */}
        <div className="mt-6 text-center">
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            className="text-sm transition-colors"
            style={{ color: "var(--tg-accent)" }}
          >
            {mode === "login" ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}
