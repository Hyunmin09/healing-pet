/**
 * Korean healing message pool.
 *
 * `pickMessage` selects a message for the pet's current state. It is
 * intentionally not fully pure (uses `Math.random`), but the tests only verify
 * category membership and pool size, never a specific random draw. The minimum
 * inter-message interval (`messageFreqMs`) is enforced by the caller (todo 8),
 * not here.
 */

import type { State } from "./fsm";

/** Messages shown when the pet is hungry (satiety < 20). */
export const HUNGRY_MSGS: readonly string[] = [
  "배가 고파요…",
  "뭐 좀 먹고 싶어요…",
  "속이 좀 비어 있어요…",
];

/** Messages shown while being petted. */
export const PETTED_MSGS: readonly string[] = [
  "기분 좋아~",
  "더 쓰다듬어 줘~",
  "따뜻한 손길이 좋아요~",
];

/** Messages shown while chasing the cursor. */
export const CHASING_MSGS: readonly string[] = [
  "따라갈게~",
  "기다려봐~",
  "저기로 가볼까?",
];

/** Calm ambient messages shown while idle or roaming. */
export const CALM_MSGS: readonly string[] = [
  "오늘도 고생 많았어 🌿",
  "잠깐 눈을 쉬어볼까?",
  "물 한 잔 마실 시간이야",
  "숨을 크게 들이쉬어 보자",
  "잘 하고 있어, 천천히 가도 돼",
  "햇살 좋은 날이야, 나가볼래?",
  "틈틈이 스트레칭하고 있어?",
  "너의 하루가 평온하길 🌙",
];

/** All message pools combined (used for pool-size assertions). */
export const ALL_MSGS: readonly string[] = [
  ...HUNGRY_MSGS,
  ...PETTED_MSGS,
  ...CHASING_MSGS,
  ...CALM_MSGS,
];

/** Pick a random element from a non-empty array. */
function pickRandom<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Select a healing message for the given state and needs, or `null` when the
 * pet should stay silent (e.g. while sleeping).
 */
export function pickMessage(
  state: State,
  needs: { satiety: number; mood: number },
): string | null {
  // Sleeping pets never speak.
  if (state === "Sleeping") {
    return null;
  }

  // Hunger takes priority over ambient chatter.
  if (needs.satiety < 20) {
    return pickRandom(HUNGRY_MSGS);
  }

  switch (state) {
    case "BeingPetted":
      return pickRandom(PETTED_MSGS);
    case "Chasing":
      return pickRandom(CHASING_MSGS);
    case "Idle":
    case "Roaming":
      return pickRandom(CALM_MSGS);
    case "Eating":
      // Eating pets stay quiet (no dedicated pool).
      return null;
  }
}
