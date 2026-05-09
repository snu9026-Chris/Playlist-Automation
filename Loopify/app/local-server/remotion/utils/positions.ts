export type OverlayPosition = "tl" | "tc" | "tr" | "ml" | "mc" | "mr" | "bl" | "bc" | "br";

const MARGIN = 40;

export function getOverlayStyle(
  position: OverlayPosition,
  containerWidth: number,
  containerHeight: number,
): React.CSSProperties {
  const base: React.CSSProperties = { position: "absolute" };

  // Vertical
  if (position.startsWith("t")) base.top = MARGIN;
  else if (position.startsWith("m")) base.top = "50%";
  else base.bottom = MARGIN;

  // Horizontal
  if (position.endsWith("l")) base.left = MARGIN;
  else if (position.endsWith("c")) base.left = "50%";
  else base.right = MARGIN;

  // Center transforms
  const transforms: string[] = [];
  if (position.startsWith("m")) transforms.push("translateY(-50%)");
  if (position.endsWith("c")) transforms.push("translateX(-50%)");
  if (transforms.length > 0) base.transform = transforms.join(" ");

  return base;
}
