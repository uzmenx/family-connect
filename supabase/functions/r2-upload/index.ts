import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.525.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
      console.error("Missing R2 env vars:", {
        hasKey: !!R2_ACCESS_KEY_ID,
        hasSecret: !!R2_SECRET_ACCESS_KEY,
        hasEndpoint: !!R2_ENDPOINT,
        hasBucket: !!R2_BUCKET_NAME,
      });
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing R2 credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // @aws-sdk/client-s3 handles AWS4-HMAC-SHA256 signing correctly for R2.
    // forcePathStyle: true is REQUIRED for Cloudflare R2 (it doesn't support virtual-hosted style).
    // region: "auto" is what Cloudflare expects.
    const s3 = new S3Client({
      endpoint: R2_ENDPOINT,
      region: "auto",
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "upload") {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const path = formData.get("path") as string;

      if (!file || !path) {
        return new Response(
          JSON.stringify({ error: "file and path required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const body = new Uint8Array(arrayBuffer);

      console.log(`Uploading: bucket=${R2_BUCKET_NAME}, key=${path}, size=${body.length}, type=${file.type}`);

      // PutObjectCommand with the official SDK signs the request properly,
      // avoiding the SignatureDoesNotMatch error that aws4fetch caused.
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: path,
        Body: body,
        ContentType: file.type || "application/octet-stream",
      });

      await s3.send(command);

      // Return public URL for client access
      const publicUrl = R2_PUBLIC_URL
        ? `${R2_PUBLIC_URL}/${path}`
        : `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${path}`;

      console.log("Upload success:", publicUrl);

      return new Response(
        JSON.stringify({ url: publicUrl, path }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use ?action=upload" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("R2 upload error:", error.message, error.stack);
    return new Response(
      JSON.stringify({ error: error.message || "Upload failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
