import { readFileSync } from "node:fs";
import { join } from "node:path";

const ENV_PATH = "C:/Users/USER/Desktop/Personal Management/.env.local";
const DOCS_DIR = "C:/Users/USER/Desktop/Playlist Automation/planning-docs";

const envContent = readFileSync(ENV_PATH, "utf-8");
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPA_URL || !SUPA_KEY) {
  console.error("missing env", { hasUrl: !!SUPA_URL, hasKey: !!SUPA_KEY });
  process.exit(1);
}

async function sb(path, method = "GET", body = null, prefer = null) {
  const headers = {
    apikey: SUPA_KEY,
    Authorization: `Bearer ${SUPA_KEY}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`ERR ${method} ${path}`, res.status, text);
    return null;
  }
  try { return JSON.parse(text); } catch { return text; }
}

let projects = await sb("projects?name=eq.Loopify&select=*");
let project = projects && projects[0];
if (!project) {
  console.log("Creating Loopify project...");
  const created = await sb(
    "projects",
    "POST",
    { name: "Loopify", description: "Spotify 트렌드 분석 기반 AI 음악 쇼츠 15개 자동 생성·업로드 본인 전용 웹 서비스" },
    "return=representation"
  );
  project = created && created[0];
}
console.log("Project:", project?.id, project?.name);
if (!project) process.exit(1);

const docs = [
  "01-context-priming.json",
  "02-feature-spec.json",
  "03-screen-structure.json",
  "04-design-spec.json",
];

for (const fname of docs) {
  const doc = JSON.parse(readFileSync(join(DOCS_DIR, fname), "utf-8"));
  const payload = {
    project_id: project.id,
    doc_type: doc.doc_type,
    phase: doc.phase,
    title: doc.title,
    summary: doc.summary,
    key_decisions: doc.key_decisions,
    sections: doc.sections,
    dev_notes: doc.dev_notes,
    tags: doc.tags,
    updated_at: new Date().toISOString(),
  };
  const result = await sb(
    "planning_docs?on_conflict=project_id,doc_type",
    "POST",
    payload,
    "return=representation,resolution=merge-duplicates"
  );
  console.log(`${fname}:`, result ? "OK" : "FAILED");
}
