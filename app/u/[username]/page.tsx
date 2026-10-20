import type { Metadata } from "next";
import PublicProfileView from "./PublicProfileView";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const decoded = decodeURIComponent(username);

  return {
    title: `${decoded} | Codeduel Verified Debugging Portfolio`,
    description: `Verified competitive debugging profile for ${decoded} on Codeduel. Inspect ELO rating, embedded/software track breakdown, and verified competencies.`,
    openGraph: {
      title: `${decoded} — Codeduel Verified Portfolio`,
      description: `View verified debugging competencies, ELO rating, and match records for ${decoded} on Codeduel.`,
      url: `https://codeduel.dev/u/${encodeURIComponent(decoded)}`,
      siteName: "Codeduel",
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `${decoded} — Codeduel Verified Portfolio`,
      description: `View verified debugging competencies, ELO rating, and match records for ${decoded} on Codeduel.`,
    },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const decoded = decodeURIComponent(username);

  return <PublicProfileView username={decoded} />;
}
