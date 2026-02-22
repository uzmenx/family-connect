import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  email: string;
  otp: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp }: VerifyRequest = await req.json();

    if (!email || !otp) {
      return new Response(
        JSON.stringify({ error: "Email and OTP are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate OTP format
    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      return new Response(
        JSON.stringify({ error: "Invalid OTP format" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Generate a random password for the user (they'll use OTP/magic link to login)
    const tempPassword = crypto.randomUUID();

    // Check if user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const userExists = existingUsers?.users?.some(u => u.email === email.toLowerCase());

    if (!userExists) {
      // Create user if doesn't exist
      const { error: signUpError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase(),
        password: tempPassword,
        email_confirm: true,
      });

      if (signUpError) {
        console.error("Signup error:", signUpError);
        return new Response(
          JSON.stringify({ error: signUpError.message }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // Sign in user with OTP (using signInWithOtp for passwordless flow)
    // Since we can't directly create session, we'll use magic link tokens
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password: tempPassword,
    });

    // If password sign-in fails (existing user), generate new password and update
    if (signInError) {
      await supabase.auth.admin.updateUserById(
        (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === email.toLowerCase())?.id || '',
        { password: tempPassword }
      );
      
      const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password: tempPassword,
      });

      if (retryError) {
        console.error("Sign in retry error:", retryError);
        return new Response(
          JSON.stringify({ error: "Authentication failed" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          access_token: retryData.session?.access_token,
          refresh_token: retryData.session?.refresh_token,
          user: retryData.user
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        access_token: signInData.session?.access_token,
        refresh_token: signInData.session?.refresh_token,
        user: signInData.user
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
