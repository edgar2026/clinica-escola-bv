require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runCleanup() {
  console.log('🧹 Iniciando limpeza completa de dados fictícios...');

  const adminEmails = [
    process.env.ADMIN_EMAIL
   
  ].filter(Boolean);

  if (adminEmails.length === 0) {
    console.error('Defina pelo menos ADMIN_EMAIL no .env');
    process.exit(1);
  }

  const defaultPassword = process.env.ADMIN_PASSWORD || process.env.VITE_DEV_ADMIN_PASSWORD;
  if (!defaultPassword) { console.error('Defina ADMIN_PASSWORD ou VITE_DEV_ADMIN_PASSWORD no .env'); process.exit(1); }
  const senhaHash = bcrypt.hashSync(defaultPassword, 10);

  // 1. Limpar tabelas operacionais fictícias do PostgreSQL
  const operationalTables = [
    'logs_auditoria',
    'notificacoes',
    'lista_espera',
    'solicitacoes_alteracao',
    'justificativas',
    'pontos',
    'agendamentos',
    'vagas_horarios',
    'horarios',
    'alunos',
    'supervisores'
  ];

  for (const table of operationalTables) {
    const { error } = await supabaseAdmin.from(table).delete().neq('id', 0);
    if (error) {
      console.log(`  ⚠️ Aviso ao limpar tabela ${table}:`, error.message);
    } else {
      console.log(`  ✅ Tabela '${table}' zerada com sucesso.`);
    }
  }

  // 2. Limpar usuários fictícios em public.usuarios (mantendo apenas adminEmails)
  console.log('🧹 Removendo usuários fictícios da tabela public.usuarios...');
  const { data: currentDbUsers } = await supabaseAdmin.from('usuarios').select('id, email');
  if (currentDbUsers) {
    for (const u of currentDbUsers) {
      if (!adminEmails.includes((u.email || '').toLowerCase())) {
        console.log(`  🗑️ Deletando de public.usuarios: ${u.email}`);
        await supabaseAdmin.from('usuarios').delete().eq('id', u.id);
      }
    }
  }

  // 3. Limpar usuários fictícios em auth.users (Supabase Auth)
  console.log('🧹 Removendo usuários fictícios do Supabase Auth (auth.users)...');
  const { data: authListData, error: authListErr } = await supabaseAdmin.auth.admin.listUsers();

  if (!authListErr && authListData?.users) {
    for (const user of authListData.users) {
      const emailLower = (user.email || '').toLowerCase();
      if (!adminEmails.includes(emailLower)) {
        console.log(`  🗑️ Deletando do Auth: ${user.email} (${user.id})`);
        await supabaseAdmin.auth.admin.deleteUser(user.id);
      }
    }
  }

  // 4. Criar / Atualizar contas de Administrador no Auth e no public.usuarios
  console.log('👑 Garantindo contas de Administrador ativas...');

  const adminProfiles = [
    { email: process.env.ADMIN_EMAIL, matricula: process.env.ADMIN_MATRICULA || 'ADM001', nome: process.env.ADMIN_NAME || 'Administrador' },
    process.env.ADMIN_EMAIL_2 ? { email: process.env.ADMIN_EMAIL_2, matricula: process.env.ADMIN_MATRICULA_2 || 'ADM002', nome: process.env.ADMIN_NAME_2 || 'Administrador 2' } : null,
    process.env.ADMIN_EMAIL_3 ? { email: process.env.ADMIN_EMAIL_3, matricula: process.env.ADMIN_MATRICULA_3 || 'ADM003', nome: process.env.ADMIN_NAME_3 || 'Administrador 3' } : null,
  ].filter(Boolean);

  // Recarregar lista de usuários auth atualizada
  const { data: updatedAuthList } = await supabaseAdmin.auth.admin.listUsers();
  const authUsersMap = new Map((updatedAuthList?.users || []).map(u => [u.email.toLowerCase(), u]));

  for (const admin of adminProfiles) {
    let authUser = authUsersMap.get(admin.email.toLowerCase());

    if (authUser) {
      // Atualizar no Auth
      const { data: updated, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        password: defaultPassword,
        email_confirm: true,
        user_metadata: { nome: admin.nome, perfil: 'admin', matricula: admin.matricula }
      });
      if (updateErr) {
        console.error(`  ❌ Erro ao atualizar Admin no Auth (${admin.email}):`, updateErr.message);
      } else {
        authUser = updated.user;
        console.log(`  ✅ Admin atualizado no Supabase Auth: ${admin.email}`);
      }
    } else {
      // Criar no Auth
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: admin.email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: { nome: admin.nome, perfil: 'admin', matricula: admin.matricula }
      });
      if (createErr) {
        console.error(`  ❌ Erro ao criar Admin no Auth (${admin.email}):`, createErr.message);
      } else {
        authUser = created.user;
        console.log(`  ✅ Admin criado no Supabase Auth: ${admin.email}`);
      }
    }

    // Upsert na tabela public.usuarios
    if (authUser) {
      const { data: existingPublic } = await supabaseAdmin
        .from('usuarios')
        .select('id')
        .eq('email', admin.email)
        .maybeSingle();

      if (existingPublic) {
        const { error: upErr } = await supabaseAdmin
          .from('usuarios')
          .update({
            nome: admin.nome,
            matricula: admin.matricula,
            senha_hash: senhaHash,
            perfil: 'admin',
            status: 'ativo',
            primeiro_acesso: 0,
            auth_user_id: authUser.id,
            tentativas_login: 0,
            bloqueado_ate: null
          })
          .eq('id', existingPublic.id);

        if (upErr) console.error(`  ❌ Erro ao atualizar public.usuarios (${admin.email}):`, upErr.message);
        else console.log(`  ✅ Perfil public.usuarios atualizado: ${admin.email}`);
      } else {
        const { error: insErr } = await supabaseAdmin
          .from('usuarios')
          .insert({
            nome: admin.nome,
            email: admin.email,
            matricula: admin.matricula,
            senha_hash: senhaHash,
            perfil: 'admin',
            status: 'ativo',
            primeiro_acesso: 0,
            auth_user_id: authUser.id
          });

        if (insErr) console.error(`  ❌ Erro ao inserir public.usuarios (${admin.email}):`, insErr.message);
        else console.log(`  ✅ Perfil public.usuarios criado: ${admin.email}`);
      }
    }
  }

  // 5. Garantir dados básicos de referência para formulários (Cursos, Unidades, Turnos)
  console.log('📌 Garantindo estrutura limpa de dados de referência...');

  await supabaseAdmin.from('cursos').upsert([
    { id: 1, nome: 'Odontologia', codigo: 'ODONTO', descricao: 'Curso de Odontologia' },
    { id: 2, nome: 'Psicologia', codigo: 'PSICO', descricao: 'Curso de Psicologia' }
  ], { onConflict: 'id' });

  await supabaseAdmin.from('unidades').upsert([
    { id: 1, nome: 'Unidade Graças', cidade: 'Recife' }
  ], { onConflict: 'id' });

  await supabaseAdmin.from('turnos').upsert([
    { id: 1, nome: 'Manhã', codigo: 'MANHA', hora_inicio: '07:00:00', hora_fim: '12:00:00' },
    { id: 2, nome: 'Tarde', codigo: 'TARDE', hora_inicio: '13:00:00', hora_fim: '18:00:00' },
    { id: 3, nome: 'Noite', codigo: 'NOITE', hora_inicio: '18:00:00', hora_fim: '22:00:00' }
  ], { onConflict: 'id' });

  console.log('\n🎉 LIMPEZA CONCLUÍDA COM SUCESSO!');
  console.log('O sistema agora contém apenas dados reais e as contas de Administrador ativas.');
}

runCleanup().catch(err => {
  console.error('💥 Erro fatal durante a limpeza:', err);
  process.exit(1);
});
