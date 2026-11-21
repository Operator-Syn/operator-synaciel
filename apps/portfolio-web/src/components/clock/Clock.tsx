import { useEffect, useMemo, useState } from "react";
import { startVisibilityAwareTicker } from "./visibilityTicker";

function useClock() {
  const [time, setTime] = useState(new Date());

  // The ticker owns the interval and the visibility listener and stops both from
  // this effect's cleanup, so a background tab stops waking once a second.
  useEffect(() => startVisibilityAwareTicker(() => setTime(new Date()), { document }).stop, []);

  return time;
}

interface ClockProps {
  compact?: boolean;
}

export default function ClockPanel({ compact = false }: ClockProps) {
  const time = useClock();
  const greeting = useMemo(() => {
    const hour = time.getHours();
    if (hour >= 5 && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 14) return "Good Noon";
    if (hour >= 14 && hour < 18) return "Good Afternoon";
    return "Good Evening";
  }, [time]);
  const formattedTime = useMemo(
    () =>
      time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    [time],
  );

  return (
    <section
      className={
        compact ? "homepage-clock" : "surface-panel flex min-h-36 flex-col justify-between p-5"
      }
    >
      <p className="font-mono text-meta uppercase tracking-[0.06em] text-text-muted">
        {greeting} / {formattedTime}
      </p>
      <p className="text-sm text-text-muted">
        Take a look around - I hope you find something that inspires you.
      </p>
    </section>
  );
}
