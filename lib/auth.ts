import { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TABLE } from "./dynamo";
import { getOrSyncUser } from "./postgres-sync";

if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

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
        const isProduction = process.env.NODE_ENV === "production";
        const isOAuthConfigured = Boolean(
          process.env.GITHUB_CLIENT_ID &&
          process.env.GITHUB_CLIENT_ID !== "dummy_client_id" &&
          process.env.GITHUB_CLIENT_SECRET &&
          process.env.GITHUB_CLIENT_SECRET !== "dummy_client_secret"
        );

        if (isProduction && isOAuthConfigured && process.env.ALLOW_GUEST_DEV !== "true") {
          throw new Error("Guest developer bypass is disabled in production with active OAuth. Please authenticate via GitHub.");
        }

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
      const isAdminUser =
        ghUsername.toLowerCase() === "rishabh9877" ||
        userId === "Rishabh9877" ||
        (user.email && user.email === process.env.ADMIN_EMAIL);

      try {
        // Check if user already exists in DynamoDB
        const existing = await dynamo.send(
          new GetCommand({
            TableName: TABLE,
            Key: { PK: `USER#${userId}`, SK: "PROFILE" },
          })
        );

        // First time login — create profile
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
                elo: 1000,
                role: isAdminUser ? "ADMIN" : "INDIVIDUAL",
                isAdmin: isAdminUser,
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
                GSI1SK: 1000,
                userId,
                username: ghUsername,
                avatar: user.image,
              },
            })
          );
        } else if (isAdminUser && !existing.Item.isAdmin) {
          // Record platform founder status without overriding user's chosen testing role
          await dynamo.send(
            new UpdateCommand({
              TableName: TABLE,
              Key: { PK: `USER#${userId}`, SK: "PROFILE" },
              UpdateExpression: "SET isAdmin = :ia",
              ExpressionAttributeValues: { ":ia": true },
            })
          );
        }
      } catch (err) {
        console.warn("[Auth signIn] DynamoDB profile notice:", err);
      }

      // Synchronize user to PostgreSQL users table
      try {
        await getOrSyncUser({
          id: userId,
          name: ghUsername,
          email: user.email,
          image: user.image,
        });
      } catch (pgSyncErr) {
        console.warn("[Auth signIn] Postgres sync notice:", pgSyncErr);
      }

      return true;
    },

    // Attach userId and admin permissions to the session
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
        // Expose the actual GitHub login (not display name) for reliable admin checks
        (session.user as any).username = token.ghLogin || "";
        // Admin detection: use the stored token role (set from login in jwt callback)
        const isAdmin = token.role === "ADMIN" || token.isAdmin === true;
        if (isAdmin) {
          (session.user as any).role = "ADMIN";
          (session.user as any).isAdmin = true;
        } else if (token.role) {
          (session.user as any).role = token.role;
        }
      }
      return session;
    },

    async jwt({ token, user, profile }) {
      if (user) {
        token.sub = user.id;
        const login = ((profile as any)?.login || user.name || "").toLowerCase();
        // Always store the actual GitHub login for reliable username detection
        token.ghLogin = login;
        if (login === "rishabh9877" || user.id === "rishabh9877" || (user.id || "").toLowerCase() === "rishabh9877") {
          token.role = "ADMIN";
          token.isAdmin = true;
        }
      }
      return token;
    },
  },

  pages: {
    signIn: "/",
  },
};

