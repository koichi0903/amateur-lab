import { supabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Insight } from "./types";

export class InsightRepository {
  constructor(private readonly client: SupabaseClient = supabase) {}

  async removeTypes(workId: number, types: string[]): Promise<void> {
    if (types.length === 0) return;

    const { error } = await this.client
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

    const { error } = await this.client
      .from("insights")
      .upsert(rows, {
        onConflict: "work_id,type",
      });

    if (error) {
      throw error;
    }
  }
}
