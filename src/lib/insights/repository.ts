import { supabase } from "@/lib/supabase";
import type { Insight } from "./types";

export class InsightRepository {
  async removeTypes(workId: number, types: string[]): Promise<void> {
    if (types.length === 0) return;

    const { error } = await supabase
      .from("insights")
      .delete()
      .eq("work_id", workId)
      .in("type", types);

    if (error) {
      throw error;
    }
  }

  async save(insights: Insight[]): Promise<void> {
    if (insights.length === 0) {
      return;
    }

    const rows = insights.map((insight) => ({
      work_id: insight.workId,
      type: insight.type,
      title: insight.title,
      description: insight.description,
      priority: insight.priority,
      score: insight.score,
      payload: insight.payload,
    }));

    const { error } = await supabase
      .from("insights")
      .upsert(rows, {
        onConflict: "work_id,type",
      });

    if (error) {
      throw error;
    }
  }
}
