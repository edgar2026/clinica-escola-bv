import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { auth_user_id } = await req.json();

    if (!auth_user_id) {
      return new Response(
        JSON.stringify({ error: "auth_user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Delete profile data (usuarios + alunos)
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", auth_user_id)
      .single();

    if (usuario) {
      await supabase.from("alunos").delete().eq("usuario_id", usuario.id);
      await supabase.from("usuarios").delete().eq("id", usuario.id);
    }

    // 2. Delete auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(auth_user_id);

    if (authError) {
      console.error("Failed to delete auth user:", authError.message);
    }

    return new Response(
      JSON.stringify({ ok: true, usuario_id: usuario?.id ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
