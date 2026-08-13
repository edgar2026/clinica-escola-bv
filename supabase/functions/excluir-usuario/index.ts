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

    // 1. Find the usuario
    const { data: usuario, error: findError } = await supabase
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", auth_user_id)
      .single();

    if (findError || !usuario) {
      return new Response(
        JSON.stringify({ error: "Usuario nao encontrado", details: findError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const usuarioId = usuario.id;

    // 2. Delete dependent records that reference alunos.id (indirect dependents)
    const alunoDependentTables = [
      "agendamentos",
      "pontos",
      "justificativas",
      "solicitacoes_alteracao",
      "lista_espera",
      "vinculos",
      "grade_semanal_excecoes",
      "grade_semanal_selecoes",
    ];

    // First find the aluno record
    const { data: aluno } = await supabase
      .from("alunos")
      .select("id")
      .eq("usuario_id", usuarioId)
      .maybeSingle();

    if (aluno) {
      // Fetch grade selections BEFORE deleting to restore vagas_disponiveis
      const { data: selecoes } = await supabase
        .from("grade_semanal_selecoes")
        .select("vaga_horario_id")
        .eq("aluno_id", aluno.id);

      for (const table of alunoDependentTables) {
        const { error } = await supabase.from(table).delete().eq("aluno_id", aluno.id);
        if (error) {
          console.error(`Failed to delete from ${table}:`, error.message);
        }
      }

      // Restore vagas_disponiveis for deleted selections
      if (selecoes && selecoes.length > 0) {
        const vagaIds = [...new Set(selecoes.map((s: { vaga_horario_id: number }) => s.vaga_horario_id))];
        for (const vagaId of vagaIds) {
          const { data: vaga } = await supabase
            .from("vagas_horarios")
            .select("vagas_disponiveis, capacidade_max")
            .eq("id", vagaId)
            .single();
          if (vaga && vaga.vagas_disponiveis < vaga.capacidade_max) {
            await supabase
              .from("vagas_horarios")
              .update({ vagas_disponiveis: vaga.vagas_disponiveis + 1 })
              .eq("id", vagaId);
          }
        }
      }

      // Delete the aluno record itself
      const { error } = await supabase.from("alunos").delete().eq("id", aluno.id);
      if (error) {
        console.error("Failed to delete aluno:", error.message);
      }
    }

    // 3. Delete dependent records that reference usuarios.id (direct dependents)
    const usuarioDependentTables = [
      { table: "notificacoes", column: "usuario_id" },
      { table: "logs_auditoria", column: "usuario_id" },
      { table: "agendamentos", column: "criado_por" },
      { table: "pontos", column: "validado_por" },
      { table: "justificativas", column: "analisado_por" },
      { table: "solicitacoes_alteracao", column: "atendido_por" },
      { table: "grade_semanal_excecoes", column: "criado_por" },
      { table: "solicitacoes_reset_senha", column: "usuario_id" },
      { table: "solicitacoes_reset_senha", column: "atendida_por" },
    ];

    for (const { table, column } of usuarioDependentTables) {
      const { error } = await supabase.from(table).delete().eq(column, usuarioId);
      if (error) {
        console.error(`Failed to delete from ${table} (${column}):`, error.message);
      }
    }

    // 4. Delete the usuario record
    const { error: deleteUsuarioError } = await supabase.from("usuarios").delete().eq("id", usuarioId);
    if (deleteUsuarioError) {
      console.error("Failed to delete usuario:", deleteUsuarioError.message);
      return new Response(
        JSON.stringify({ error: "Falha ao excluir perfil do usuario", details: deleteUsuarioError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Delete the auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(auth_user_id);
    if (authError) {
      console.error("Failed to delete auth user:", authError.message);
      return new Response(
        JSON.stringify({ error: "Falha ao excluir conta de autenticacao", details: authError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, usuario_id: usuarioId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
