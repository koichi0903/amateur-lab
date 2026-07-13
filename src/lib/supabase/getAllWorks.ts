import { supabase } from "@/lib/supabase";

export async function getAllWorks<T>(
  select: string
): Promise<T[]> {
  const works: T[] = [];

  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("works")
      .select(select)
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    works.push(...(data as T[]));

    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return works;
}