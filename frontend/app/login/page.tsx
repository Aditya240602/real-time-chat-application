"use client"

import { useState } from "react"
import { login } from "@/lib/api"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      await login(username, password)
      window.location.href = "/" // redirect to main chat view
    } catch (err: any) {
      setError(err?.data?.detail || "Login failed")
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-zinc-50">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl bg-zinc-900 border border-zinc-800 p-8 shadow-2xl w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight">Login to Pulse</h1>
        {error && <div className="text-red-500 text-sm bg-red-500/10 p-2 rounded-md">{error}</div>}
        
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-400">Username</label>
          <input
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus:border-zinc-500 focus:outline-none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
        </div>
        
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-400">Password</label>
          <input
            type="password"
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 focus:border-zinc-500 focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <p className="text-sm text-zinc-500">
          Need an account? Please use the admin/API to register for now.
        </p>

        <button
          type="submit"
          className="mt-2 rounded-md bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors"
        >
          Sign In
        </button>
      </form>
    </div>
  )
}
