/** The project journey: one project, seven states, one question each. */
export const JOURNEY = [
  { id: "idea", label: "Idea", question: "What are you trying to say?" },
  { id: "explore", label: "Explore", question: "What should this feel like?" },
  { id: "direction", label: "Direction", question: "Which direction feels right?" },
  { id: "story", label: "Story", question: "How should the idea unfold?" },
  { id: "design", label: "Design", question: "What should it look like?" },
  { id: "motion", label: "Motion", question: "How should it move?" },
  { id: "final", label: "Final", question: "Ready to make it?" },
] as const;

export type JourneyStage = (typeof JOURNEY)[number]["id"];

export const stageInfo = (id: string) => JOURNEY.find((s) => s.id === id) ?? JOURNEY[0];
export const stageIndex = (id: string) => Math.max(0, JOURNEY.findIndex((s) => s.id === id));
