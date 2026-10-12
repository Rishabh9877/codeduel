import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export type MatchState = "idle" | "queued";

export interface MatchmakingOptions {
  track?: 'PRODUCTION_SWE' | 'EMBEDDED_SYSTEMS';
  challengeId?: string;
  demo?: boolean;
}

export function useMatchmaking() {
  const router = useRouter();
  const [matchState, setMatchState] = useState<MatchState>("idle");
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [queueDuration, setQueueDuration] = useState(0);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const queuedAtRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    setQueueDuration(0);
  }, []);

  const handleFindMatch = useCallback(async (optsOrChallengeId?: string | MatchmakingOptions) => {
    if (matchState !== "idle") return;
    setMatchState("queued");
    
    let track: 'PRODUCTION_SWE' | 'EMBEDDED_SYSTEMS' | undefined = undefined;
    let challengeId: string | undefined = undefined;
    let demo = false;

    if (typeof optsOrChallengeId === "string") {
      challengeId = optsOrChallengeId;
    } else if (optsOrChallengeId && typeof optsOrChallengeId === "object") {
      track = optsOrChallengeId.track;
      challengeId = optsOrChallengeId.challengeId;
      demo = !!optsOrChallengeId.demo;
    }

    const now = Date.now();
    queuedAtRef.current = now;
    setQueueDuration(0);

    durationTimerRef.current = setInterval(() => {
      setQueueDuration(Math.floor((Date.now() - queuedAtRef.current) / 1000));
    }, 1000);

    const payload = {
      track,
      challengeId,
      demo,
      queuedAt: now,
    };

    try {
      const res = await fetch("/api/match/queue", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.status === 403 && data.error === "Queue Banned") {
        alert(data.message);
        stopPolling();
        setMatchState("idle");
        return;
      }

      if (data.matchId && res.ok) {
        stopPolling();
        router.push(`/match/${data.matchId}`);
        return;
      }

      if (res.status === 409 && data.matchId) {
        stopPolling();
        router.push(`/match/${data.matchId}`);
        return;
      }
    } catch (e) {
      console.error("[useMatchmaking] initial queue error:", e);
    }

    // Polling loop every 2s
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/match/queue", { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            queuedAt: queuedAtRef.current,
          })
        });
        const data = await res.json();
        
        if (res.status === 403 && data.error === "Queue Banned") {
          stopPolling();
          alert(data.message);
          setMatchState("idle");
          return;
        }

        if (data.matchId) {
          stopPolling();
          router.push(`/match/${data.matchId}`);
          return;
        }
      } catch (err) {
        console.error("[useMatchmaking] polling error:", err);
      }
    }, 2000);
  }, [matchState, router, stopPolling]);

  const handleCancel = useCallback(async () => {
    stopPolling();
    setMatchState("idle");
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return {
    matchState,
    queueDuration,
    showMatchModal,
    setShowMatchModal,
    handleFindMatch,
    handleCancel
  };
}
