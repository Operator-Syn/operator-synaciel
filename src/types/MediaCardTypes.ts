// MediaCardTypes.ts
export interface MediaItem {
  id: number;
  title: string;
  type: "video" | "image";
  url: string;
  shortDescription: string;
  longDescription: string;
  projectLink: string;
  gallery: { type: "video" | "image"; url: string }[];
}
