// Simple video manager for global pause functionality
let currentPlayingVideo: string | null = null;

export const pauseAllVideos = () => {
  // Pause all video elements on the page
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    if (!video.paused) {
      video.pause();
    }
  });
};

export const setCurrentPlayingVideo = (videoUrl: string) => {
  // Pause all other videos when this one starts playing
  pauseAllVideos();
  currentPlayingVideo = videoUrl;
};

export const getCurrentPlayingVideo = () => currentPlayingVideo;

// Simple timestamp storage using Map
const videoTimestamps = new Map<string, number>();

export const getVideoTimestamp = (videoUrl: string): number => {
  return videoTimestamps.get(videoUrl) || 0;
};

export const setVideoTimestamp = (videoUrl: string, timestamp: number) => {
  videoTimestamps.set(videoUrl, timestamp);
};
