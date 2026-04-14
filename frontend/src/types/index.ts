export interface Subtitle {
  id: string;
  lang: string;
  language: string;
  label: string;
  url: string;
}

export interface Episode {
  episodeId: string;
  episode: number;
  season: number;
  title?: string;
}

export interface VideoItem {
  subjectId: string;
  title: string;
  thumbnail?: string;
  cover?: {
    url: string;
  };
  stills?: {
    url: string;
  };
  languages?: string[];
  subjectType: number; // 1 for Movie, 2 for Series
  updateTime?: string;
  duration?: string;
  quality?: string;
  rating?: string;
  year?: string;
  synopsis?: string;
  desc?: string;
  episodeList?: Episode[];
}

export interface VideoSection {
  title: string;
  items: VideoItem[];
}

export interface HomepageData {
  sections: VideoSection[];
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  message?: string;
}
