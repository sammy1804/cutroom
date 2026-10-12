import "server-only";
import { z } from "zod";
import { structured } from "@/server/ai/claude";

/** AI command bar router: decides which library or agent should handle a request. */

export const commandSchema = z.object({
  intent: z.enum(["animations", "assets", "references", "research", "creative_dna", "answer"]),
  query: z.string().describe("The request rewritten as a focused query for the chosen system"),
  mediaType: z.enum(["image", "video", "audio", "any"]),
  answer: z.string().describe("Only for intent=answer: a short direct reply. Otherwise empty."),
});

export type CommandRoute = z.infer<typeof commandSchema>;

export async function routeCommand(input: string, context: string): Promise<CommandRoute> {
  return structured({
    schema: commandSchema,
    effort: "low",
    maxTokens: 2000,
    system:
      "You route requests in a video production tool to the right system:\n" +
      "- animations: motion, transitions, text/title animation, 'make it feel more X' (Animation Library)\n" +
      "- assets: find usable footage, photos, music or sound to put in the video (Asset Sourcing, licence-aware)\n" +
      "- references: find saved visual references or ones similar to a reference (Reference Library)\n" +
      "- research: research the audience, competitors or trends for the current campaign (Research Brain)\n" +
      "- creative_dna: summarise or rebuild the creative direction from references\n" +
      "- answer: anything else; reply briefly.\n" +
      "If the request mixes a reference with motion ('make the transition feel like the third reference'), choose animations.",
    content: `Where the user is: ${context}\n\nRequest: ${input}`,
  });
}
