import Link from "next/link"

export default function AccessDenied() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
      <section className="w-full rounded-xl border border-line bg-panel p-6">
        <p className="font-mono text-xs tracking-widest text-accent">BTC ROTATOR — PRIVATE ACCESS</p>
        <h1 className="mt-3 text-xl">Access is not approved for this account.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          This application is invite-only. Ask the owner to add your email address to the application allowlist.
        </p>
        <Link className="mt-5 inline-block text-sm underline" href="/sign-in">Use a different account</Link>
      </section>
    </main>
  )
}
