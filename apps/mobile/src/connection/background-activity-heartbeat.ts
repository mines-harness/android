import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";

const REPORT_INTERVAL_MS = 25_000;

export function mobileActivityHeartbeats<E, R>(
  appStates: Stream.Stream<string | null | undefined, E, R>,
): Stream.Stream<void, E, R> {
  return appStates.pipe(
    Stream.map((state) => state === "active"),
    Stream.changes,
    Stream.switchMap((active) =>
      active
        ? Stream.concat(
            Stream.succeed(undefined),
            Stream.fromSchedule(Schedule.spaced(`${REPORT_INTERVAL_MS} millis`)).pipe(
              Stream.as(undefined),
            ),
          )
        : Stream.empty,
    ),
  );
}
