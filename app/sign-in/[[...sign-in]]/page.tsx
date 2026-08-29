import { SignIn } from "@clerk/nextjs"

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <p className="p-8 text-sm text-muted">Authentication is not configured. Add the Clerk production keys before deploying.</p>
  }
  return <SignIn afterSignInUrl="/" />
}
