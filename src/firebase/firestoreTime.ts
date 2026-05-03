import type { Timestamp } from "firebase/firestore";

export function firestoreTimestampMs(u: unknown): number {
  if (
    u != null &&
    typeof u === "object" &&
    "toMillis" in u &&
    typeof (u as Timestamp).toMillis === "function"
  ) {
    return (u as Timestamp).toMillis();
  }
  return 0;
}
