export type LoadingPose = "waiting" | "searching" | "reading" | "thinking";

export function rulebookLoadingPose(phase: string): LoadingPose {
  if (phase === "queued") return "waiting";
  return /search|discover|download/i.test(phase) ? "searching" : "reading";
}

const lessonPhases = ["inventory", "drafting", "summary", "checking"];

export function lessonPreparationProgress(phase: string) {
  const index = lessonPhases.indexOf(phase);
  if (index < 0) return {};
  return {
    progress: index === 0 ? undefined : (index / lessonPhases.length) * 100,
    progressText: `Stage ${index + 1} of ${lessonPhases.length}`,
  };
}

export function loadingPercent(progress?: number) {
  return typeof progress === "number" && Number.isFinite(progress)
    ? Math.round(Math.min(100, Math.max(0, progress)))
    : undefined;
}
