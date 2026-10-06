import path from "node:path";
import fs from "node:fs";

export function resolveMediaFile(root, encodedName) {
  let name;
  try { name = decodeURIComponent(encodedName); } catch { return null; }
  if (!name || /[\\/\x00]/.test(name) || name.includes("..")) return null;
  const target = path.resolve(root, name);
  if (path.dirname(target) !== path.resolve(root)) return null;
  // Existing symlinks must not expose files outside the media directory.
  if (fs.existsSync(target) && path.dirname(fs.realpathSync(target)) !== fs.realpathSync(root)) return null;
  return target;
}

export function isAllowedOrigin(origin, configured) {
  if (!origin) return true; // Remotion and local command-line clients
  const allowed = (configured || "http://localhost:3002,http://127.0.0.1:3002").split(",").map(s => s.trim());
  return allowed.includes(origin);
}
