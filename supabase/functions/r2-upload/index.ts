import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const R2_ACCESS_KEY_ID = (Deno.env.get("R2_ACCESS_KEY_ID") ?? "").trim();
    const R2_SECRET_ACCESS_KEY = (Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "").trim();
    const R2_ENDPOINT = (Deno.env.get("R2_ENDPOINT") ?? "").trim();
    const R2_BUCKET_NAME = (Deno.env.get("R2_BUCKET_NAME") ?? "").trim();
    const R2_PUBLIC_URL = (Deno.env.get("R2_PUBLIC_URL") ?? "").trim();

    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET_NAME) {
      console.error("Missing R2 secrets");
      return new Response(JSON.stringify({ error: "Server misconfiguration: missing R2 credentials" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CRITICAL: Configure aws4fetch with service:"s3" and region:"auto"
    // Without these, the signature will NOT match what Cloudflare R2 expects,
    // causing 403 SignatureDoesNotMatch even with correct credentials.
    const r2 = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
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

      // R2 uses path-style: https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
      const objectUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${path}`;
      console.log("Uploading to:", objectUrl);

      const arrayBuffer = await file.arrayBuffer();

      // Use r2.fetch which automatically signs the request with correct
      // AWS4-HMAC-SHA256 signature for Cloudflare R2 (service=s3, region=auto)
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

      // Build public URL using R2_PUBLIC_URL (r2.dev subdomain or custom domain)
      const publicUrl = R2_PUBLIC_URL
        ? `${R2_PUBLIC_URL}/${path}`
        : `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${path}`;

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
