import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Strip any accidental KEY=... prefix from env values */
function cleanEnv(name: string): string {
  const raw = Deno.env.get(name) ?? "";
  // If someone stored "R2_ENDPOINT=https://..." instead of just the value
  const eqIdx = raw.indexOf("=");
  if (eqIdx !== -1 && raw.substring(0, eqIdx) === name) {
    return raw.substring(eqIdx + 1).trim();
  }
  return raw.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const R2_ACCESS_KEY_ID = cleanEnv("R2_ACCESS_KEY_ID");
    const R2_SECRET_ACCESS_KEY = cleanEnv("R2_SECRET_ACCESS_KEY");
    const R2_ENDPOINT = cleanEnv("R2_ENDPOINT");
    const R2_BUCKET_NAME = cleanEnv("R2_BUCKET_NAME");
    const R2_PUBLIC_URL = cleanEnv("R2_PUBLIC_URL"); // optional custom domain

    // Validate required secrets
    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET_NAME) {
      console.error(
        "Missing R2 secrets. Check that R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME are set correctly (values only, no KEY= prefix).",
      );
      return new Response(JSON.stringify({ error: "Server misconfiguration: missing R2 credentials" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate endpoint is a proper URL
    try {
      new URL(R2_ENDPOINT);
    } catch {
      console.error(`R2_ENDPOINT is not a valid URL: "${R2_ENDPOINT}"`);
      return new Response(JSON.stringify({ error: "Server misconfiguration: invalid R2 endpoint" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const r2 = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    });

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "upload") {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const path = formData.get("path") as string;

      if (!file || !path) {
        return new Response(JSON.stringify({ error: "file and path required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const objectUrl = `${R2_ENDPOINT}/${path}`;
      console.log("Uploading to:", objectUrl);

      const arrayBuffer = await file.arrayBuffer();

      const uploadRes = await r2.fetch(objectUrl, {
        method: "PUT",
        body: arrayBuffer,
        headers: { "Content-Type": file.type },
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error("R2 upload error:", uploadRes.status, errText);
        return new Response(JSON.stringify({ error: `Upload failed: ${uploadRes.status}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build public URL: use custom domain if set, otherwise use R2 dev URL
      const publicUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${path}` : `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${path}`;

      return new Response(JSON.stringify({ url: publicUrl, path }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "signed-url") {
      const { path } = await req.json();
      if (!path) {
        return new Response(JSON.stringify({ error: "path required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const objectUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${path}`;

      const signed = await r2.sign(new Request(objectUrl, { method: "GET" }), {
        aws: { signQuery: true, datetime: new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""), expires: 3600 },
      });

      return new Response(JSON.stringify({ url: signed.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use ?action=upload or ?action=signed-url" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
