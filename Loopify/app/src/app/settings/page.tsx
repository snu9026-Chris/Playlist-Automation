import Link from "next/link";
import { ArrowLeft, Key, Database, Video, Music, Cpu } from "lucide-react";

export default function SettingsPage() {
  const envKeys = [
    { name: "Supabase", icon: Database, keys: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"], color: "emerald" },
    { name: "Spotify", icon: Music, keys: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"], color: "green" },
    { name: "YouTube (Google OAuth)", icon: Video, keys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], color: "red" },
    { name: "Gemini (이미지)", icon: Cpu, keys: ["GOOGLE_AI_API_KEY"], color: "blue" },
    { name: "OpenAI (GPT)", icon: Key, keys: ["OPENAI_API_KEY"], color: "gray" },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> 대시보드
        </Link>
        <h1 className="text-xl font-bold text-gray-900">설정</h1>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">API 연동 상태</h2>
        <div className="space-y-3">
          {envKeys.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.name} className="pearl-card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Icon className="w-5 h-5 text-gray-500" />
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                </div>
                <div className="space-y-1.5">
                  {item.keys.map((key) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <code className="text-xs px-2 py-0.5 bg-pearl-100 rounded text-gray-600 font-mono">
                        {key}
                      </code>
                      <span className="text-gray-400">→</span>
                      <span className="text-gray-400 text-xs">.env.local에서 설정</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">DB 테이블</h2>
        <div className="pearl-card p-5">
          <p className="text-sm text-gray-600 mb-3">
            Supabase SQL Editor에서 <code className="text-xs px-1.5 py-0.5 bg-pearl-100 rounded font-mono">supabase-schema.sql</code>을 실행하세요.
          </p>
          <div className="flex flex-wrap gap-2">
            {["track_bookmarks", "playlist_projects", "playlist_tracks", "scheduled_uploads"].map((t) => (
              <span key={t} className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full font-mono">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
