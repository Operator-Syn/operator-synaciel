import assert from "node:assert/strict";
import { test } from "node:test";

const backgrounds = {
  canvas: "#292831",
  surface: "#333f58",
  raised: "#3a5068",
} as const;

const foregrounds = {
  text: "#fff4ef",
  muted: "#fbbbad",
  faint: "#e3b6bb",
  signal: "#f7b0b5",
  signalStrong: "#ffd7ce",
  danger: "#ffad9e",
  success: "#acd0d3",
} as const;

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);

  if (!channels || channels.length !== 3) {
    throw new Error(`Invalid color: ${hex}`);
  }

  return channels.reduce(
    (total, channel, index) =>
      total +
      (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) *
        [0.2126, 0.7152, 0.0722][index],
    0,
  );
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

test("keeps Vesper Index semantic foregrounds readable on every surface", () => {
  for (const [foregroundName, foreground] of Object.entries(foregrounds)) {
    for (const [backgroundName, background] of Object.entries(backgrounds)) {
      assert.ok(
        contrastRatio(foreground, background) >= 4.5,
        `${foregroundName} on ${backgroundName} is below WCAG AA`,
      );
    }
  }

  assert.ok(contrastRatio(backgrounds.canvas, foregrounds.signal) >= 4.5);
  assert.ok(contrastRatio(backgrounds.canvas, foregrounds.signalStrong) >= 4.5);
});
