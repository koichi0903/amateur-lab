import { createWorkSocialImage } from "@/lib/workSocialImage";

export const alt = "Hakkutsu LAB work image";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return createWorkSocialImage(id);
}
