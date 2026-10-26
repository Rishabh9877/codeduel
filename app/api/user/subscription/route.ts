import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserSubscriptionTier, updateUserSubscriptionTier, checkUserDuelQuota } from "@/lib/subscription";
import type { SubscriptionTier } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = ((session.user as any).id || (session.user as any).sub) as string;

  try {
    const tier = await getUserSubscriptionTier(userId);
    const quota = await checkUserDuelQuota(userId);

    return NextResponse.json({
      tier,
      duelsToday: quota.duelsToday,
      maxDaily: quota.maxDaily,
      isPro: tier === "PRO",
      isCampus: tier === "CAMPUS",
      isFree: tier === "FREE",
    });
  } catch (err) {
    console.error("Error fetching subscription:", err);
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = ((session.user as any).id || (session.user as any).sub) as string;

  try {
    const body = await req.json();
    const targetTier = body.tier as SubscriptionTier;

    if (!targetTier || (targetTier !== "FREE" && targetTier !== "PRO" && targetTier !== "CAMPUS")) {
      return NextResponse.json({ error: "Invalid subscription tier" }, { status: 400 });
    }

    // Security Guard: Prevent arbitrary client self-granting of paid tiers without payment
    if (targetTier === "PRO" || targetTier === "CAMPUS") {
      const authHeader = req.headers.get("x-admin-key");
      const isAdminKeyValid = authHeader && process.env.ADMIN_SECRET && authHeader.trim() === process.env.ADMIN_SECRET.trim();
      const isAdminSession = (session.user as any).role === "ADMIN" || (session.user as any).isAdmin === true;

      if (!isAdminKeyValid && !isAdminSession) {
        return NextResponse.json(
          {
            error:
              "Payment required: Direct self-granting of PRO or CAMPUS tiers is disabled. Payment gateway checkout (Stripe / Razorpay) is required to activate paid subscription tiers.",
          },
          { status: 402 }
        );
      }
    }

    const success = await updateUserSubscriptionTier(userId, targetTier);
    if (!success) {
      return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tier: targetTier,
      message: targetTier === "PRO" 
        ? "Upgraded to Pro Engineer! All advanced hardware telemetry and AI coaching are unlocked."
        : "Subscription plan updated successfully.",
    });
  } catch (err) {
    console.error("Error updating subscription:", err);
    return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
  }
}
