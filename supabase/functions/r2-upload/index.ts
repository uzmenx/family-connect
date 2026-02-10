import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!;
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
    const R2_ENDPOINT = Deno.env.get('R2_ENDPOINT')!;
    const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME')!;

    const r2 = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    });

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'upload') {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      const path = formData.get('path') as string;

      if (!file || !path) {
        return new Response(JSON.stringify({ error: 'file and path required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const objectUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${path}`;
      const arrayBuffer = await file.arrayBuffer();

      const uploadRes = await r2.fetch(objectUrl, {
        method: 'PUT',
        body: arrayBuffer,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error('R2 upload error:', errText);
        return new Response(JSON.stringify({ error: 'Upload failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Return public URL using custom domain or R2 public URL
      const publicUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${path}`;

      return new Response(JSON.stringify({ url: publicUrl, path }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'signed-url') {
      const { path } = await req.json();
      if (!path) {
        return new Response(JSON.stringify({ error: 'path required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const objectUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${path}`;

      // Generate a signed URL valid for 1 hour
      const signed = await r2.sign(
        new Request(objectUrl, { method: 'GET' }),
        { aws: { signQuery: true, datetime: new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''), expires: 3600 } }
      );

      return new Response(JSON.stringify({ url: signed.url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use ?action=upload or ?action=signed-url' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
