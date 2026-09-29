import { createHash, randomInt } from "node:crypto";

export const RECOVERY_CODE_COUNT = 10;

// No 0/O, 1/I/L, so codes survive being read aloud or written down.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const GROUP_LENGTH = 5;

/**
 * Codes look like "7KQ2M-XH4PD": 10 characters from a 31-symbol alphabet
 * (~49 bits of entropy), which is far beyond guessing, so a fast unsalted
 * hash is sufficient for storage.
 */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const group = () =>
    Array.from(
      { length: GROUP_LENGTH },
      () => ALPHABET[randomInt(ALPHABET.length)],
    ).join("");

  return Array.from({ length: count }, () => `${group()}-${group()}`);
}

/** Uppercases and strips spaces and dashes so formatting never matters. */
export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256")
    .update(normalizeRecoveryCode(code))
    .digest("hex");
}
