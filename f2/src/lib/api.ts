import axios from 'axios';
import type { ApiResponse, HomepageData, VideoItem, Subtitle } from '@/types';

const RAILWAY_BACKEND_URL = 'https://backend-production-25ab.up.railway.app';

const api = axios.create({
  baseURL: `${RAILWAY_BACKEND_URL}/api`,
});

export const getHomepage = async (lang = 'RANDOM') => {
  const response = await api.get<ApiResponse<HomepageData>>('/homepage', {
    params: { lang },
  });
  return response.data;
};

export const getTrending = async (page = 0, perPage = 18, lang = 'RANDOM') => {
  const response = await api.get<ApiResponse<{ items: VideoItem[] }>>('/trending', {
    params: { page, perPage, lang },
  });
  return response.data;
};

export const searchVideos = async (query: string, page = 1, perPage = 24, filterLang = 'RANDOM') => {
  const response = await api.get<ApiResponse<{ items: VideoItem[] }>>(`/search/${query}`, {
    params: { page, perPage, filterLang },
  });
  return response.data;
};

export const getVideoInfo = async (movieId: string) => {
  const response = await api.get<ApiResponse<{ subject: VideoItem }>>(`/info/${movieId}`);
  return response.data;
};

export const getVideoSources = async (movieId: string, season = 0, episode = 0) => {
  const response = await api.get<ApiResponse<{ processedSources: any[]; processedSubtitles: Subtitle[] }>>(`/sources/${movieId}`, {
    params: { season, episode },
  });
  return response.data;
};

export const getRelatedVideos = async (movieId: string, lang = 'RANDOM') => {
  const response = await api.get<ApiResponse<{ items: VideoItem[] }>>(`/related/${movieId}`, {
    params: { lang },
  });
  return response.data;
};
