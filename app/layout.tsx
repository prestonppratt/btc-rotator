import "./globals.css"
import Link from "next/link"
import { ClerkProvider, UserButton } from "@clerk/nextjs"

export const metadata = { title: "BTC Rotator", description: "Private Bitcoin-proxy research desk" }

function Nav({ hasClerk }: { hasClerk: boolean }){
  const links = [
    ["/","Portfolio"],
  ] as const
  return (
    <nav className="flex items-center gap-5 text-sm">
      {links.map(([href,label])=>(
        <Link key={href} href={href} className="text-muted hover:text-white transition-colors">{label}</Link>
      ))}
      {hasClerk ? <UserButton afterSignOutUrl="/sign-in" /> : null}
    </nav>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }){
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  const body = (
    <body className="min-h-screen antialiased">
      <header className="sticky top-0 z-40 backdrop-blur bg-[#080808]/90 border-b border-line">
        <div className="mx-auto max-w-[1280px] px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="h-7 w-7 rounded bg-accent grid place-items-center font-mono text-xs font-bold text-black">₿</span>
            <span className="font-mono text-sm tracking-widest">BTC ROTATOR</span>
          </Link>
          <Nav hasClerk={hasClerk}/>
        </div>
        <div className="mx-auto max-w-[1280px] px-4 pb-2">
          <p className="text-[11px] leading-4 text-muted">Private portfolio research. Not investment advice.</p>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-[1280px] px-4 py-8 border-t border-line mt-10">
        <p className="text-[11px] text-muted">Private portfolio research. No brokerage connection or automatic trading.</p>
      </footer>
    </body>
  )
  return (
    <html lang="en">{hasClerk ? <ClerkProvider>{body}</ClerkProvider> : body}</html>
  )
}
