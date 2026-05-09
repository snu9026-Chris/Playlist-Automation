import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// Vercel Cron Job: 예약 업로드 실행
// vercel.json에 cron 설정 필요: "0 * * * *" (매시간)
export async function GET(req: NextRequest) {
  // Cron 보안: Vercel Cron secret 체크
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const now = new Date().toISOString();

  // 현재 시각 이전에 예약된 pending 업로드 조회
  const { data: scheduled } = await supabase
    .from("scheduled_uploads")
    .select("*, playlist_tracks(*)")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(5);

  if (!scheduled || scheduled.length === 0) {
    return NextResponse.json({ message: "No pending uploads" });
  }

  const results: { id: string; status: string }[] = [];

  for (const item of scheduled) {
    await supabase
      .from("scheduled_uploads")
      .update({ status: "processing" })
      .eq("id", item.id);

    try {
      // TODO: 실제 YouTube 업로드 로직 (publish route와 동일)
      // 성공 시
      await supabase
        .from("scheduled_uploads")
        .update({ status: "completed" })
        .eq("id", item.id);

      results.push({ id: item.id, status: "completed" });
    } catch (e: any) {
      const retryCount = (item.retry_count ?? 0) + 1;
      await supabase
        .from("scheduled_uploads")
        .update({
          status: retryCount >= 3 ? "failed" : "pending",
          retry_count: retryCount,
          error_message: e.message,
        })
        .eq("id", item.id);

      results.push({ id: item.id, status: "failed" });
    }
  }

  return NextResponse.json({ processed: results });
}
