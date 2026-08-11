import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SENHA_TEMPORARIA = "ser@2026";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { usuario_id, auth_user_id, solicitacao_id, admin_email, origem } = await req.json();

    if (!auth_user_id) {
      return new Response(
        JSON.stringify({ error: "auth_user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verificar se o admin esta tentando redefinir a propria senha
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: adminUser }, error: adminAuthError } = await supabase.auth.getUser(token);

    if (adminAuthError || !adminUser) {
      return new Response(
        JSON.stringify({ error: "Admin authentication failed" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se admin esta redefinindo a propria senha
    if (adminUser.id === auth_user_id) {
      return new Response(
        JSON.stringify({ error: "O administrador nao pode redefinir a propria senha por este metodo." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Resetar a senha no Supabase Auth
    const { error: resetError } = await supabase.auth.admin.updateUserById(
      auth_user_id,
      { password: SENHA_TEMPORARIA }
    );

    if (resetError) {
      console.error("Failed to reset password:", resetError.message);
      return new Response(
        JSON.stringify({ error: "Falha ao redefinir senha: " + resetError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Marcar troca_senha_obrigatoria como true
    const { error: updateError } = await supabase
      .from("usuarios")
      .update({ troca_senha_obrigatoria: true })
      .eq("auth_user_id", auth_user_id);

    if (updateError) {
      console.error("Failed to update troca_senha_obrigatoria:", updateError.message);
    }

    // 4. Marcar solicitacao pendente como atendida (se fornecida)
    if (solicitacao_id) {
      const { error: solError } = await supabase
        .from("solicitacoes_reset_senha")
        .update({
          status: "atendida",
          atendida_em: new Date().toISOString(),
          atendida_por: usuario_id,
        })
        .eq("id", solicitacao_id)
        .eq("status", "pendente");

      if (solError) {
        console.error("Failed to update solicitacao:", solError.message);
      }
    } else {
      // Marcar todas as solicitacoes pendentes deste usuario como atendidas
      await supabase
        .from("solicitacoes_reset_senha")
        .update({
          status: "atendida",
          atendida_em: new Date().toISOString(),
          atendida_por: usuario_id,
        })
        .eq("usuario_id", usuario_id)
        .eq("status", "pendente");
    }

    // 5. Registrar na auditoria
    const { error: auditError } = await supabase
      .from("logs_auditoria")
      .insert({
        usuario_id: usuario_id,
        acao: "redefinicao_senha_admin",
        entidade: "usuarios",
        entidade_id: usuario_id,
        dados_novos: JSON.stringify({
          admin_responsavel: adminUser.email,
          origem: origem || "gestao_usuarios",
          data_hora: new Date().toISOString(),
        }),
        ip: req.headers.get("x-forwarded-for") || "edge-function",
        dispositivo: "Edge Function - redefinir-senha-admin",
      });

    if (auditError) {
      console.error("Failed to create audit log:", auditError.message);
    }

    // 6. Encerrar sessoes anteriores (sign out everywhere)
    try {
      await supabase.auth.admin.signOut(auth_user_id);
    } catch (signOutErr) {
      // signOut pode nao ser suportado em todas as versoes, nao bloquear por isso
      console.log("Sign out all sessions:", signOutErr);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        mensagem: "Senha redefinida com sucesso. Senha temporaria: " + SENHA_TEMPORARIA,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
