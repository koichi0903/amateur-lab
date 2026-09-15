import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MyfansXExecutionRedirect({
  searchParams,
}: {
  searchParams?: Promise<{ media?: string }>;
}) {
  const params = await searchParams;
  redirect(params?.media ? `/admin/myfans?media=${params.media}` : "/admin/myfans");
}
