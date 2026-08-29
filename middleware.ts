import { clerkClient, clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

function allowedEmails() {
  return new Set(
    (process.env.APP_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

function isPublicRoute(pathname: string) {
  return pathname === "/access-denied" || pathname.startsWith("/sign-in")
}

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req.nextUrl.pathname)) return undefined
  const { userId, redirectToSignIn } = await auth()
  if (!userId) return redirectToSignIn()

  const allowlist = allowedEmails()
  // Fail closed: a Clerk account alone never grants application access.
  if (allowlist.size === 0) {
    return NextResponse.redirect(new URL("/access-denied", req.url))
  }

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const email = user.emailAddresses.find(
    (address) => address.id === user.primaryEmailAddressId,
  )?.emailAddress.toLowerCase()

  if (!email || !allowlist.has(email)) {
    return NextResponse.redirect(new URL("/access-denied", req.url))
  }

  return undefined
})

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
}
