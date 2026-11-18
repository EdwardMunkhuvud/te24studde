import type { Metadata } from "next";
import { notFound } from "next/navigation";

import "@/app/normal.css";
import { CelebrationForm } from "@/components/celebration-survey";
import { celebrationAccessToken, getCelebrationSettings } from "@/lib/celebration-survey";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Så firar vi studenten · Studde",
  description: "TE24:s formulär inför studentfirandet.",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: { token: string };
  searchParams?: { survey?: string };
};

export default async function CelebrationReplyPage({ params, searchParams }: PageProps) {
  const token = celebrationAccessToken.safeParse(params.token);
  if (!token.success) notFound();

  const [settings, response] = await Promise.all([
    getCelebrationSettings(),
    prisma.celebrationResponse.findUnique({ where: { accessToken: token.data } }),
  ]);
  if (!settings || settings.status === "draft" || !response) notFound();

  return (
    <div className="dashboard-page normal-site">
      <main className="dashboard-shell">
        <CelebrationForm
          response={response}
          surplus={settings.surplus}
          open={settings.status === "open"}
          accessToken={token.data}
          status={searchParams?.survey}
        />
      </main>
    </div>
  );
}
