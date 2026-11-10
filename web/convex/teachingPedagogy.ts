import {
  TURN_WALKTHROUGH_STEPS,
  type TurnWalkthrough,
} from "../../packages/shared/src/teachingAids";

// Teaching principles adapted from the user's teaching-video transcripts.
// This controls presentation, never the authority or completeness of rules.
export type TeachingRole = "context" | "goal" | "choices" | "rule" | "recap";
export type TeachingOutline = {
  chapter: number;
  title: string;
  teachingRole?: TeachingRole;
  coreSentence?: string;
}[];

export const teachingVoice = `Use clear, concrete explanations in the chosen language. Prioritize the structure and understanding of the game; avoid social coaching, performative enthusiasm and marketing claims.
Give the learner a reason for each rule: connect the physical action, its purpose and its consequence. Introduce unfamiliar terms in plain language when first used. Use earlierCards as the planned learning path; do not assume every learner has read or understood every earlier card.
Explain observable consequences, not speculative design intent or balancing rationale. Name actual legal alternatives and their different effects. Avoid strategic slogans or universal claims such as every choice having the same two effects when some choices work differently. Use the game's precise actions rather than metaphorical upgrading or developing of components.
Explain components by their jobs, then retain their required quantities; do not open with a disconnected box inventory. Relate rules to recognizable components and board areas; do not require physical materials to follow the explanation.
Use small concrete examples with an explicit board state, a legal action and its result. Players may be described neutrally; no personal names or social roleplay are needed. An illustrative situation may be hypothetical, but all its actions, values and consequences must follow the supplied rules. Examples may use only concepts introduced in earlierCards or in preceding text of this batch. Do not introduce an unexplained action or exception through an example.
If a specific effect (such as movement, combat or a resource conversion) is taught later, choose an example of the currently taught rule instead: for placement, an available space versus an illegal or occupied space may be sufficient. Stop at the already-explained consequence rather than slipping in a future rule or a hypothetical component with unverified printed values.
Keep all required rules, exceptions, quantities and scoring rows. Avoid repeating full explanations already taught when a short reminder is enough, but never omit a required fact from its mapped cards. Separate optional variants clearly. Never invent theme, player roles, strategy, guarantees of fun, house rules, or another game's mechanics.`;

export const teachingScene = `Start by setting the scene. Use a title about the situation and one short paragraph of one or two sentences addressed to the player. If the source gives you a role, say who you are, what is happening and what you are trying to achieve in that world. If the game is abstract, describe the actual situation or challenge without inventing a role or setting. Keep action limits, turn order, and scoring procedures out of this paragraph. If the lesson uses a coreSentence, that separate line follows the scene and explains the basic mechanics.`;

export const teachingOpening = `The FIRST THREE cards of the lesson must be in chapter 0, in exactly this order:
1. teachingRole=context: ${teachingScene}
2. teachingRole=goal: how you win or lose and the overall shape of play. Give the destination before detailed procedures; preserve quantities required by this topic across these opening cards.
3. teachingRole=choices: which central decisions you make. Name actual source-supported alternatives and briefly explain how their direct effects differ. Do not give invented strategic advice, claim every choice always has the same benefits, or assert that the game is exciting or balanced. Use orientationReferenceTopics for a high-level preview only; their full rules belong later.
All three map to the required chapter-0 topic(s) and cite the passages actually supporting their content. Do not teach the full component inventory, detailed setup, rare exceptions or every scoring table in the opening. Subsequent cards use teachingRole=rule.`;

export const teachingExamples =
  "For each drafting batch that includes chapter-4 actions, include at least one short, useful worked example in an action card's example field. Empty examples are appropriate for simple facts; do not add an example to every card just to fill space.";

export const teachingRecap = `Create a compact first-game recap in chapter 7, with teachingRole=recap, in at most 3 cards. Cover the objective, complete turn/round sequence at overview level, end trigger, key scoring reminders and important beginner pitfalls. Do not repeat every scoring table or the full lesson. Finish with an optional suggestion to trace one already-explained turn step by step; identify this as a learning aid, not an official game variant. Do not change hidden information, allow take-backs, or alter rules in a supposed practice mode.`;

export const teachingAnchor = `The first context card MUST have coreSentence: one short, concrete sentence that follows the thematic paragraph and explains what you do at the table and how that helps you win or reach the objective. Use the actual actions from these rules in plain language. Move from the situation to the mechanics instead of repeating the scene. Leave detailed turn and scoring rules for later cards. Do not reduce a multi-action turn to one action, invent strategy or imply that a preview is the complete rule. All other drafting cards have an empty coreSentence. Set walkthrough to null on every ordinary card.`;

export const teachingPlayGuide = `Create a compact first-game recap in chapter 7 with teachingRole=recap, in exactly 3 cards. This content also serves as the permanently accessible game overview.
The first 2 cards are the overview: cover the objective, legal action choices and limits, the complete turn/round sequence at overview level, mandatory upkeep, end trigger, key scoring and tie reminders, and important beginner pitfalls. Use short plain-text paragraphs. Do not copy all scoring tables. Copy the EXACT coreSentence from the earlier context card onto the first overview card only. Use an empty coreSentence on the other cards. Set walkthrough to null on both overview cards.
The third card contains a COMPLETE representative example turn in walkthrough. Its short paragraphs introduce it as an illustrative learning example, not an official variant or an optimal move. Fill all 6 fields: startingState (concrete legal game state and resources), availableChoices (legal choices from that state and how many actions the turn allows or requires), chosenAction (the complete legal choice or sequence of choices for this turn, prerequisites and all costs), resolution (all resulting effects and mandatory follow-up actions in chronological order), turnEnd (mandatory cleanup, phase/round transitions where applicable and who acts next), resultingState (explicit state after the turn, consistent with all costs and gains). If a turn requires several actions or phases, demonstrate ALL of them: a single action is not a full turn. In games with simultaneous play or a shared active-player sequence, follow that actual structure instead of inventing a clockwise turn. Use standard active rules and selected expansion overrides, not optional variants. Use a situation that does not end the game so the example shows the handoff. If a stage has no extra cost or cleanup, say so explicitly when supported. Use only rules already explained in earlierCards and the supplied sources. Never reveal hidden information, change rules, allow take-backs, or add strategy. Put no separate example in the example field of these 3 cards. Cite all source passages supporting the overview and the complete example, including its actions and turn-end rules. All learning text uses the lesson language.`;

export const teachingQuestionVoice = `Answer the specific rules question first, in plain language. Define unfamiliar terminology and use a concrete, source-supported board-state example where useful. Give enough context without repeating the whole lesson or adding unsolicited strategy.
If the question touches a later subject, give enough explanation now; never dismiss it with "we'll get to that later". You may point to a relevant title in lessonOutline for more detail, without requiring the learner to leave this card. Never invent a chapter title. Keep source uncertainty explicit and separate from the learner's understanding. Only selected approved rulebooks are authoritative; do not substitute Google, forum answers or remembered house rules.`;

type PedagogicCard = {
  chapter: number;
  teachingRole?: TeachingRole;
  example?: string;
  coreSentence?: string;
  walkthrough?: TurnWalkthrough | null;
};
export function usesTeachingApproach(version: string) {
  return Number.parseInt(version, 10) >= 4;
}

export function usesTeachingAids(version: string) {
  return Number.parseInt(version, 10) >= 5;
}

export function validateTeachingAids(
  cards: PedagogicCard[],
  firstBatch: boolean,
  summary: boolean,
) {
  if (firstBatch && !summary && !cards[0]?.coreSentence?.trim())
    throw new Error(
      "The context card needs a concrete core sentence for this game.",
    );
  if (!summary) {
    if (
      cards.some(
        (card, index) =>
          card.walkthrough ||
          (card.coreSentence?.trim() && (!firstBatch || index !== 0)),
      )
    )
      throw new Error(
        "Keep the core sentence on the first context card and the full example turn in the recap.",
      );
    return;
  }
  if (
    cards.length !== 3 ||
    !cards[0].coreSentence?.trim() ||
    cards.slice(1).some((card) => card.coreSentence?.trim())
  )
    throw new Error(
      "Create 2 overview cards and 1 example-turn card; repeat the core sentence on the first overview card only.",
    );
  if (
    cards.slice(0, 2).some((card) => card.walkthrough) ||
    !cards[2].walkthrough ||
    TURN_WALKTHROUGH_STEPS.some(([key]) => !cards[2].walkthrough?.[key]?.trim())
  )
    throw new Error(
      "The complete example turn needs a starting state, choices, action and costs, effects, turn end and resulting state.",
    );
}

export function validateTeachingOpening(cards: PedagogicCard[]) {
  const expected: TeachingRole[] = ["context", "goal", "choices"];
  if (
    expected.some(
      (role, index) =>
        cards[index]?.chapter !== 0 || cards[index]?.teachingRole !== role,
    )
  )
    throw new Error(
      "Start with exactly ordered chapter-0 orientation cards: context, goal, choices, before the rule cards.",
    );
  if (
    cards
      .slice(3)
      .some((card) => card.teachingRole && expected.includes(card.teachingRole))
  )
    throw new Error(
      "The orientation belongs at the start; do not repeat opening cards later.",
    );
}

export function validateTeachingDraft(
  cards: PedagogicCard[],
  firstBatch: boolean,
  summary: boolean,
  version = "4",
) {
  if (summary) {
    if (cards.length > 3 || cards.some((card) => card.teachingRole !== "recap"))
      throw new Error("Keep the recap to at most 3 recap cards.");
  } else {
    if (firstBatch) validateTeachingOpening(cards);
    else if (cards.some((card) => card.teachingRole !== "rule"))
      throw new Error(
        "The opening has already been taught; use rule cards for this batch.",
      );
    if (
      cards.some((card) => card.chapter === 4) &&
      !cards.some((card) => card.chapter === 4 && card.example?.trim())
    )
      throw new Error(
        "Add at least one supported, concrete worked example to this batch of action cards.",
      );
  }
  if (usesTeachingAids(version))
    validateTeachingAids(cards, firstBatch, summary);
}

export function validateTeachingLesson(cards: PedagogicCard[], version = "4") {
  validateTeachingOpening(cards);
  if (
    cards
      .slice(3)
      .some((card) => card.chapter !== 7 && card.teachingRole !== "rule")
  )
    throw new Error(
      "Detailed rules must use rule cards after the orientation.",
    );
  const recap = cards.filter((card) => card.chapter === 7);
  if (!recap.length) throw new Error("A first-game recap is required.");
  validateTeachingDraft(recap, false, true, version);
  if (usesTeachingAids(version)) {
    validateTeachingAids(
      cards.filter((card) => card.chapter !== 7),
      true,
      false,
    );
    if (cards[0].coreSentence !== recap[0].coreSentence)
      throw new Error(
        "The game overview must repeat the exact opening core sentence.",
      );
  }
  if (
    cards.some((card) => card.chapter === 4) &&
    !cards.some((card) => card.chapter === 4 && card.example?.trim())
  )
    throw new Error(
      "The lesson needs a worked example of an action before publication.",
    );
}
