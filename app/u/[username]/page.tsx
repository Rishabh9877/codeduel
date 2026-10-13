import type { Metadata } from "next";
import PublicProfileView from "./PublicProfileView";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const decoded = decodeURIComponent(username);

  return {
    title: `${decoded} | CodeDuel Verified Debugging Portfolio`,
    description: `Verified competitive debugging profile for ${decoded} on CodeDuel. Inspect ELO rating, embedded/software track breakdown, and verified competencies.`,
    openGraph: {
      title: `${decoded} — CodeDuel Verified Portfolio`,
      description: `View verified debugging competencies, ELO rating, and match records for ${decoded} on CodeDuel.`,
      url: `https://codeduel.dev/u/${encodeURIComponent(decoded)}`,
      siteName: "CodeDuel",
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `${decoded} — CodeDuel Verified Portfolio`,
      description: `View verified debugging competencies, ELO rating, and match records for ${decoded} on CodeDuel.`,
    },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const decoded = decodeURIComponent(username);

  return <PublicProfileView username={decoded} />;
}
