import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://hakkutsu-lab.com",
    },
    {
      url: "https://hakkutsu-lab.com/ranking",
    },
    {
      url: "https://hakkutsu-lab.com/search",
    },
    {
      url: "https://hakkutsu-lab.com/actress",
    },
    {
      url: "https://hakkutsu-lab.com/genre",
    },
    {
      url: "https://hakkutsu-lab.com/new",
    },
  ];
}