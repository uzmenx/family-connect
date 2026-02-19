import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FALLBACK_SHORTS = [
  { id: "dQw4w9WgXcQ", title: "Amazing Family Moments", thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg", channelTitle: "Family Vlog" },
  { id: "9bZkp7q19f0", title: "Gangnam Style", thumbnail: "https://img.youtube.com/vi/9bZkp7q19f0/hqdefault.jpg", channelTitle: "PSY" },
  { id: "JGwWNGJdvx8", title: "Shape of You", thumbnail: "https://img.youtube.com/vi/JGwWNGJdvx8/hqdefault.jpg", channelTitle: "Ed Sheeran" },
  { id: "kJQP7kiw5Fk", title: "Despacito", thumbnail: "https://img.youtube.com/vi/kJQP7kiw5Fk/hqdefault.jpg", channelTitle: "Luis Fonsi" },
  { id: "RgKAFK5djSk", title: "See You Again", thumbnail: "https://img.youtube.com/vi/RgKAFK5djSk/hqdefault.jpg", channelTitle: "Wiz Khalifa" },
  { id: "OPf0YbXqDm0", title: "Uptown Funk", thumbnail: "https://img.youtube.com/vi/OPf0YbXqDm0/hqdefault.jpg", channelTitle: "Mark Ronson" },
  { id: "fRh_vgS2dFE", title: "Sorry", thumbnail: "https://img.youtube.com/vi/fRh_vgS2dFE/hqdefault.jpg", channelTitle: "Justin Bieber" },
  { id: "CevxZvSJLk8", title: "Roar", thumbnail: "https://img.youtube.com/vi/CevxZvSJLk8/hqdefault.jpg", channelTitle: "Katy Perry" },
  { id: "YqeW9_5kURI", title: "Summer Hit", thumbnail: "https://img.youtube.com/vi/YqeW9_5kURI/hqdefault.jpg", channelTitle: "Music Mix" },
  { id: "hT_nvWreIhg", title: "Counting Stars", thumbnail: "https://img.youtube.com/vi/hT_nvWreIhg/hqdefault.jpg", channelTitle: "OneRepublic" },
  { id: "pRpeEdMmmQ0", title: "Shake It Off", thumbnail: "https://img.youtube.com/vi/pRpeEdMmmQ0/hqdefault.jpg", channelTitle: "Taylor Swift" },
  { id: "lp-EO5I60KA", title: "Blinding Lights", thumbnail: "https://img.youtube.com/vi/lp-EO5I60KA/hqdefault.jpg", channelTitle: "The Weeknd" },
  { id: "60ItHLz5WEA", title: "Alan Walker - Faded", thumbnail: "https://img.youtube.com/vi/60ItHLz5WEA/hqdefault.jpg", channelTitle: "Alan Walker" },
  { id: "bo_efYhYU2A", title: "Believer", thumbnail: "https://img.youtube.com/vi/bo_efYhYU2A/hqdefault.jpg", channelTitle: "Imagine Dragons" },
  { id: "SlPhMPnQ58k", title: "Happier", thumbnail: "https://img.youtube.com/vi/SlPhMPnQ58k/hqdefault.jpg", channelTitle: "Marshmello" },
];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q") || "shorts trending viral funny";
    const pageToken = url.searchParams.get("pageToken") || "";
    const maxResults = url.searchParams.get("maxResults") || "20";

    const apiKey = Deno.env.get("YOUTUBE_API_KEY");
    if (!apiKey) {
      console.error("YOUTUBE_API_KEY not set, using fallback");
      return new Response(
        JSON.stringify({ shorts: FALLBACK_SHORTS, nextPageToken: null, fallback: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchParams = new URLSearchParams({
      part: "snippet",
      type: "video",
      videoDuration: "short",
      q: query,
      maxResults,
      order: "relevance",
      key: apiKey,
    });

    if (pageToken) {
      searchParams.set("pageToken", pageToken);
    }

    const ytUrl = `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`;
    console.log("Fetching YouTube:", ytUrl.replace(apiKey, "KEY"));

    const response = await fetch(ytUrl, {
      headers: {
        Referer: "https://id-preview--a3e75228-4721-4d5e-89be-d93e66feadcd.lovable.app/",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("YouTube API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ shorts: FALLBACK_SHORTS, nextPageToken: null, fallback: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    const shorts = (data.items || [])
      .map((item: Record<string, unknown>) => {
        const id = (item.id as Record<string, unknown>)?.videoId as string;
        const snippet = item.snippet as Record<string, unknown>;
        const thumbnails = snippet?.thumbnails as Record<string, Record<string, unknown>>;
        return {
          id,
          title: snippet?.title as string,
          thumbnail:
            (thumbnails?.high?.url as string) ||
            (thumbnails?.medium?.url as string) ||
            (thumbnails?.default?.url as string),
          channelTitle: snippet?.channelTitle as string,
        };
      })
      .filter((s: { id: string }) => s.id);

    console.log(`Returned ${shorts.length} shorts, nextPageToken: ${data.nextPageToken || "none"}`);

    // If API returned too few results, supplement with fallbacks
    let finalShorts = shorts;
    if (shorts.length < 5) {
      const existingIds = new Set(shorts.map((s: { id: string }) => s.id));
      const extras = FALLBACK_SHORTS.filter(f => !existingIds.has(f.id));
      finalShorts = [...shorts, ...extras];
    }

    return new Response(
      JSON.stringify({ shorts: finalShorts, nextPageToken: data.nextPageToken || null, fallback: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ shorts: FALLBACK_SHORTS, nextPageToken: null, fallback: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
