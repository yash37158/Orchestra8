"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Pool } from "pg"

import {
  SESSION_COOKIE, SESSION_DAYS, bootstrapOwner, issueSession, verifyCredentials,
} from "@/lib/auth/password"

const pool = new Pool({
  connectionString: process.env.ORCHESTR8_CONTROL_DSN ?? "postgres://localhost:5432/orchestr8",
  max: 3,
})

async function setSessionCookie(token: string) {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,                                   // never readable from script
    sameSite: "lax",                                  // survives the OAuth redirect, blocks cross-site POSTs
    secure: process.env.NODE_ENV === "production",    // plain http in local development only
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  })
}

export async function signInWithPassword(_prev: unknown, form: FormData) {
  const email = String(form.get("email") ?? "")
  const password = String(form.get("password") ?? "")
  if (!email || !password) return { error: "Enter an email and password." }

  const user = await verifyCredentials(pool, email, password)
  // One message for both failures. Saying "no such account" turns the login
  // form into a way to find out who has one.
  if (!user) return { error: "That email and password do not match." }

  const { token } = await issueSession(pool, user.userId)
  await setSessionCookie(token)
  redirect("/dashboard")
}

export async function createFirstAccount(_prev: unknown, form: FormData) {
  const email = String(form.get("email") ?? "")
  const password = String(form.get("password") ?? "")
  const token = String(form.get("token") ?? "")

  if (password.length < 12) return { error: "Use at least 12 characters." }
  if (password !== String(form.get("confirm") ?? "")) return { error: "The two passwords do not match." }

  const user = await bootstrapOwner(pool, email, password, token)
  if (!user) {
    return { error: "That setup token is not valid, or this deployment already has an owner." }
  }
  const { token: session } = await issueSession(pool, user.userId)
  await setSessionCookie(session)
  redirect("/dashboard")
}
