import { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TABLE } from "./dynamo";

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "dummy_client_id",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "dummy_client_secret",
      authorization: { params: { prompt: "consent" } },
    }),
    // Lightweight Credentials provider active for development or guest bypass (?guest=1 / ?guest=2)
    CredentialsProvider({
      id: "credentials",
      name: "Guest Dev Bypass",
      credentials: {
        guestId: { label: "Guest Slot (1 or 2)", type: "text", placeholder: "1 or 2" },
        username: { label: "Username", type: "text", placeholder: "GuestDev" },
      },
      async authorize(credentials) {
        const slot = credentials?.guestId === "2" || credentials?.username?.includes("2") ? "2" : "1";
        const userId = `guest_${slot}`;
        const username = credentials?.username?.trim() || (slot === "1" ? "Guest_Alpha" : "Guest_Beta");
        const avatar = slot === "1"
          ? "https://api.dicebear.com/7.x/bottts/svg?seed=guest1"
          : "https://api.dicebear.com/7.x/bottts/svg?seed=guest2";

        return {
          id: userId,
          name: username,
          email: `${userId}@local.dev`,
          image: avatar,
        };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || "codeduel-development-secret-key-12345",

  callbacks: {
    // Called after successful sign in
    async signIn({ user, profile }) {
      const userId = user.id!;
      const ghUsername = (profile as any)?.login ?? user.name ?? "anonymous";

      try {
        // Check if user already exists in DynamoDB
        const existing = await dynamo.send(
          new GetCommand({
            TableName: TABLE,
            Key: { PK: `USER#${userId}`, SK: "PROFILE" },
          })
        );

        // First time login — create profile with starting ELO of 1200
        if (!existing.Item) {
          await dynamo.send(
            new PutCommand({
              TableName: TABLE,
              Item: {
                PK: `USER#${userId}`,
                SK: "PROFILE",
                userId,
                username: ghUsername,
                email: user.email,
                avatar: user.image,
                elo: 1200,
                wins: 0,
                losses: 0,
                createdAt: Date.now(),
              },
            })
          );

          // Also write their leaderboard entry
          await dynamo.send(
            new PutCommand({
              TableName: TABLE,
              Item: {
                PK: `USER#${userId}`,
                SK: "LEADERBOARD",
                GSI1PK: "LEADERBOARD#GLOBAL",
                GSI1SK: 1200, // Number — sorts natively in GSI
                userId,
                username: ghUsername,
                avatar: user.image,
              },
            })
          );
        }
      } catch (err) {
        console.warn("[Auth signIn] DynamoDB profile notice:", err);
      }

      return true;
    },

    // Attach userId to the session so we can use it in API routes
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },

    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
  },

  pages: {
    signIn: "/",
  },
};

