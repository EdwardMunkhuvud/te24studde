import Link from "next/link";

import { logoutAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();

  return (
    <div className="dashboard-page">
      <div className="dashboard-background" />
      <header className="topbar">
        <Link className="brand-mark" href={session.role === "ADMIN" ? "/admin" : "/student"}>
          Studde
        </Link>
        <nav className="topbar-nav">
          <Link href="/">Startsida</Link>
          <Link href={session.role === "ADMIN" ? "/admin" : "/student"}>
            {session.role === "ADMIN" ? "Adminpanel" : "Min översikt"}
          </Link>
        </nav>
        <div className="topbar-actions">
          <div className="user-chip">
            <span>{session.name}</span>
            <strong>{session.role === "ADMIN" ? "Admin" : "Elev"}</strong>
          </div>
          <form action={logoutAction}>
            <SubmitButton className="button button-secondary" pendingLabel="Loggar ut...">
              Logga ut
            </SubmitButton>
          </form>
        </div>
      </header>
      <main className="dashboard-shell">{children}</main>
    </div>
  );
}
