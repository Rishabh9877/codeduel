import { dynamo, TABLE } from "@/lib/dynamo";
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { SubscriptionTier } from "@/lib/pricing";

export async function getUserSubscriptionTier(userId: string): Promise<SubscriptionTier> {
  try {
    const res = await dynamo.send(
      new GetCommand({ TableName: TABLE, Key: { PK: `USER#${userId}`, SK: "PROFILE" } })
    );

    if (res.Item?.subscriptionTier) {
      return res.Item.subscriptionTier as SubscriptionTier;
    }

    // Check if user is enrolled in any campus cohorts
    const enrollRes = await dynamo.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":skPrefix": "ENROLLED#",
        },
      })
    );

    if (enrollRes.Items && enrollRes.Items.length > 0) {
      return "CAMPUS";
    }
  } catch (err) {
    console.warn("Failed to lookup subscription tier:", err);
  }

  return "FREE";
}

export async function checkUserDuelQuota(userId: string): Promise<{
  allowed: boolean;
  tier: SubscriptionTier;
  duelsToday: number;
  maxDaily: number;
}> {
  const tier = await getUserSubscriptionTier(userId);

  if (tier === "PRO" || tier === "CAMPUS") {
    return { allowed: true, tier, duelsToday: 0, maxDaily: -1 };
  }

  // Count duels played in the last 24 hours
  let duelsToday = 0;
  try {
    const today = new Date().toISOString().split("T")[0];
    const profileRes = await dynamo.send(
      new GetCommand({ TableName: TABLE, Key: { PK: `USER#${userId}`, SK: "PROFILE" } })
    );

    const activityMap = profileRes.Item?.activityMap || {};
    duelsToday = Number(activityMap[today] || 0);
  } catch (err) {
    console.warn("Failed to check duel quota:", err);
  }

  const maxDaily = 5;
  const allowed = duelsToday < maxDaily;

  return {
    allowed,
    tier,
    duelsToday,
    maxDaily,
  };
}
