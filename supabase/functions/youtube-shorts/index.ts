const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FALLBACK_SHORTS = [
  { id: 'dQw4w9WgXcQ', title: 'Amazing Family Moments', thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg', channelTitle: 'Family Vlog' },
  { id: '9bZkp7q19f0', title: 'Oilaviy Kun', thumbnail: 'https://img.youtube.com/vi/9bZkp7q19f0/hqdefault.jpg', channelTitle: "O'zbek Oila" },
  { id: 'JGwWNGJdvx8', title: 'Fun Family Day', thumbnail: 'https://img.youtube.com/vi/JGwWNGJdvx8/hqdefault.jpg', channelTitle: 'Happy Family' },
];

let cache: { data: any; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q') || 'shorts';

    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return new Response(JSON.stringify(cache.data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!apiKey) {
      console.error('YOUTUBE_API_KEY not set');
      return new Response(JSON.stringify({ shorts: FALLBACK_SHORTS, fallback: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const searchParams = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      videoDuration: 'short',
      q: query,
      maxResults: '10',
      order: 'date',
      key: apiKey,
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('YouTube API error:', errorText);
      return new Response(JSON.stringify({ shorts: FALLBACK_SHORTS, fallback: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    const shorts = (data.items || []).map((item: any) => ({
      id: item.id?.videoId,
      title: item.snippet?.title,
      thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url,
      channelTitle: item.snippet?.channelTitle,
    })).filter((s: any) => s.id);

    const result = { shorts, fallback: false };
    cache = { data: result, timestamp: Date.now() };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ shorts: FALLBACK_SHORTS, fallback: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
