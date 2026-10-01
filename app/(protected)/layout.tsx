import Link from "next/link";
import "@/app/normal.css";

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
    <div className="dashboard-page normal-site">
      <a className="skip-link" href="#main-content">Till innehållet</a>
      <div className="dashboard-background" />
      <div className="topbar-shell">
        <header className="topbar">
          <Link className="brand-mark" href={session.role === "ADMIN" ? "/admin" : "/student"}>
            Studde<span className="brand-dot">.</span>
          </Link>
          <nav aria-label="Huvudnavigation" className="topbar-nav">
            <Link href={session.role === "ADMIN" ? "/admin" : "/student"}>
              {session.role === "ADMIN" ? "Admin" : "Översikt"}
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
      </div>
      <main className="dashboard-shell" id="main-content">{children}</main>
    </div>
  );
}
