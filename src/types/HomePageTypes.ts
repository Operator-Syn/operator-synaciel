export interface HomeTool {
  label: string;
  imageUrl: string;
}

export interface HomeProject {
  id: number;
  title: string;
  type: "video" | "image";
  short_description: string;
  project_link: string;
  display_order: number;
}

export interface HomePageTypes {
  site: {
    headerPhrase?: string;
    mobileHeaderPhrase?: string;
    profileImage?: string;
    status?: string;
  };
  profile: Array<{
    label: string;
    value: string;
  }>;
  sections: {
    pitch: {
      items: Array<{
        title: string;
        content: string;
      }>;
    };
    social: {
      items: Array<{
        label: string;
        image_url: string;
        target_url: string;
      }>;
    };
    loadouts: Array<{
      category: string;
      tools: HomeTool[];
    }>;
  };
  projects: HomeProject[];
}
