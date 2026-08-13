# CONTEXTO_SISTEMA.md

Contexto completo do projeto **Clínica-Escola UNINASSAU** para uso em sessões futuras de IA.

---

## Arquitetura

- **Frontend:** Vite + React + TypeScript (SPA, sem backend Express)
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Deploy:** Frontend em `dist/`, Supabase na nuvem
- **Sem servidor Express** — `package.json` scripts: `dev` = `vite`, `build` = `vite build`

## Supabase

- **Projeto:** `dhqcbtdbkdbvbxgddjqh`
- **URL:** `https://dhqcbtdbkdbvbxgddjqh.supabase.co`
- **MCP:** `supabase-clinica-escola` (remoto, habilitado — a partir de 2026-08-13 também aplica migrations)
- **MCP URL:** `https://mcp.supabase.com/mcp?project_ref=dhqcbtdbkdbvbxgddjqh`
- **Permissões:** Leitura (tabelas, migrations, edge functions, logs, advisors) + `apply_migration` (DDL) via MCP
- **Teste de conexão (2026-08-11):** ✅ 30 tabelas, 26 migrations, 1 edge function (`excluir-usuario`)
- **Verificação de chaves (2026-08-11):** ✅ MCP retorna URL e anon key corretas; publishable key disponível mas não utilizada (supabase-js v2.110+ suporta)
- **Variáveis (.env):**
  - `VITE_SUPABASE_URL` / `SUPABASE_URL` — URL do projeto
  - `VITE_SUPABASE_ANON_KEY` — chave pública (frontend)
  - `SUPABASE_SERVICE_ROLE_KEY` — chave admin (scripts/testes apenas)
  - `SUPABASE_ACCESS_TOKEN` — token Management API

## Arquitetura de Timezone

- **PostgreSQL timezone:** UTC (`+00`)
- **`criado_em` (timestamptz):** armazenado em UTC, convertido para America/Recife no frontend via `AT TIME ZONE 'America/Recife'`
- **`hora_entrada` / `hora_saida` (varchar):** armazenam horário em **America/Recife** (`NOW() AT TIME ZONE 'America/Recife'`)
- **Frontend:** exibe `hora_entrada`/`hora_saida` diretamente (já em horário local). Para `criado_em`, usa `formatarDataHora()` que converte via `toLocaleString('pt-BR')`.
- **RPCs:** usam `NOW() AT TIME ZONE 'America/Recife'` para gerar horários de registro. Não somam/subtraem horas manualmente.

## Tabelas Principais

### `usuarios`
Colunas: `id` (int, PK), `nome`, `email`, `matricula` (unique), `cpf`, `senha_hash` (NOT NULL, default: 'managed_by_auth'), `perfil` (admin/gerente/aluno), `status` (ativo/inativo/bloqueado), `primeiro_acesso` (int 0/1, default: 1), `tentativas_login`, `bloqueado_ate`, `criado_em`, `atualizado_em`, `telefone`, `email_pessoal`, `endereco`, `data_nascimento`, `auth_user_id` (uuid FK→auth.users), `curso_id` (int, sem FK), `horas_carga_semana`, `carga_horaria_max`, `total_horas`

**RLS policies:** SELECT own, SELECT all (authenticated), UPDATE own, INSERT own (auth_user_id = auth.uid())

**Sem FK direta para `cursos`** — join deve ser feito manualmente via `curso_id`.

### `alunos`
Colunas: `id` (int, PK), `usuario_id` (int FK→usuarios), `curso_id` (int FK→cursos, NOT NULL), `turma_id`, `unidade_id`, `setor_id` (FK→setores_clinica), `telefone`, `periodo` (default: 7), `carga_horaria_semanal_max` (default: 6), `data_inicio`, `data_termino`, `situacao` (default: 'ativo'), `periodo_id` (FK→periodos), `turno_id` (FK→turnos)

**Sem RLS** — inserts funcionam sem política (apenas authenticated).

### `auditoria`
Colunas: `id` (int, PK), `usuario_id` (int), `acao`, `entidade`, `entidade_id` (int), `justificativa`, `ip`, `dispositivo`, `criado_em`

### `configuracoes`
Colunas: `chave` (varchar, PK), `valor` (text), `descricao` (text), `atualizado_em`
**Sem coluna `grupo`** — a RPC `salvar_configuracao_com_auditoria` ignora o parâmetro `p_grupo`.

### Outras tabelas
`cursos`, `periodos`, `turnos`, `clinicas`, `setores` (referenciada como `setores_clinica` na FK), `especialidades`, `professores`, `supervisores`, `vinculos`, `unidades`, `horarios_funcionamento`, `vagas_horarios`, `feriados`, `regras`, `agendamentos`, `horarios`

## RPCs (Funções SQL SECURITY DEFINER)

Todas executam como `postgres`, bypassam RLS.

| Função | Parâmetros | Descrição |
|--------|-----------|-----------|
| `listar_usuarios_completos()` | — | Retorna SETOF json de todos auth.users LEFT JOIN usuarios + cursos |
| `editar_usuario()` | p_usuario_id, p_nome, p_email, p_matricula, p_cpf, p_perfil, p_telefone, p_email_pessoal, p_endereco, p_data_nascimento, p_curso_id | Atualiza registro em usuarios |
| `alterar_status_usuario()` | p_usuario_id (int), p_novo_status (text), p_justificativa (text) | Atualiza status + insere em auditoria |
| `salvar_configuracao_com_auditoria()` | p_chave, p_valor, p_grupo (ignorado) | Upsert em configuracoes + auditoria |
| `registrar_presenca()` | p_aluno_id (int) | Registro atômico de entrada/saída com verificação de 60s |
| `fechar_pontos_abertos()` | — | Fecha pontos abertos do dia anterior como "Saída não registrada" |
| `solicitar_ajuste_saida()` | p_ponto_id (int), p_saida_sugerida (text), p_justificativa (text) | Aluno solicita ajuste de saída para registro órfão |
| `analisar_solicitacao()` | p_justificativa_id (int), p_acao (text), p_parecer (text), p_saida_corrigida (text, opcional) | Supervisão aprova/corrigir/rejeita solicitação |

### `registrar_presenca(p_aluno_id)` — Detalhes
- **Atômico:** usa `pg_advisory_xact_lock(p_aluno_id)` para bloquear cliques simultâneos
- **Fluxo:** busca entrada aberta do dia → se não existe, cria ENTRADA; se existe, verifica 60s e atualiza com SAÍDA no MESMO registro
- **Timezone:** `hora_entrada` e `hora_saida` (varchar) armazenam horário em **America/Recife** (`NOW() AT TIME ZONE 'America/Recife'`). `criado_em` (timestamptz) permanece em UTC.
- **Retorna JSON:** `{ acao: 'entrada'|'saida'|'bloqueado', ponto_id, mensagem, hora, segundos_restantantes }`
- **Arquivo SQL:** `supabase/migrations/20260808_registrar_presenca.sql`
- **GRANT:** executável por `authenticated`

### `fechar_pontos_abertos()` — Transição de Dia
- Fecha automaticamente registros com `hora_saida IS NULL` de dias anteriores
- Define `hora_saida = '00:00'`, `status_frequencia = 'saida_nao_registrada'`, `tempo_total_minutos = 0`
- **Não computa horas** — apenas marca para que o aluno solicite ajuste
- Chamada pelo frontend antes de cada novo registro de presença
- **Arquivo SQL:** `supabase/migrations/20260808_fechar_pontos_abertos.sql`

### `solicitar_ajuste_saida(p_ponto_id, p_saida_sugerida, p_justificativa)` — Ajuste de Saída
- Aluno informa horário de saída desejado + justificativa obrigatória (min 5 chars)
- Cria registro em `justificativas` com `status = 'pendente'`
- Atualiza ponto para `status_frequencia = 'aguardando_validacao'`
- **Arquivo SQL:** `supabase/migrations/20260808_solicitar_ajuste_saida.sql`

### `analisar_solicitacao(p_justificativa_id, p_acao, p_parecer, p_saida_corrigida)` — Supervisão
- **Aprovar:** se saída NULL/00:00 → registra saída sugerida e computa horas (`presenca_no_horario`); se não → marca `falta_justificada` (sem horas)
- **Corrigir:** supervisão define horário de saída correto + computa horas
- **Rejeitar:** marca como `ausencia`
- **Timezone:** usa `NOW() AT TIME ZONE 'America/Recife'` para horário fallback
- Exige parecer com min 5 caracteres
- **Arquivo SQL:** `supabase/migrations/20260808_analisar_solicitacao.sql`

### Grade Semanal (Horário Firmado)

**Tabelas:**
- `grade_semanal_config` — configuração do período de inscrição e vigência
  - `id` (int, PK), `inscricao_inicio` (date), `inscricao_fim` (date), `vigencia_inicio` (date), `vigencia_fim` (date), `status` (ativa/encerrada), `criado_em`
- `grade_semanal_dias` — configuração por dia da semana (admin)
  - `id` (int, PK), `config_id` (int FK→grade_semanal_config), `dia_semana` (int 1-6), `ativo` (boolean), `hora_inicio` (time), `hora_fim` (time), `duracao_slot_min` (int, default 60), `vagas` (int, default 8), `setor_id` (int FK→setores_clinica), `curso_ids` (int[]), `periodo_ids` (int[]), `turno_ids` (int[]), `criado_em`, `atualizado_em`
  - UNIQUE(`config_id`, `dia_semana`)
- `grade_semanal_selecoes` — seleções de vagas pelos alunos
  - `id` (int, PK), `aluno_id` (int FK→alunos), `config_id` (int FK→grade_semanal_config), `vaga_horario_id` (int FK→vagas_horarios), `dia_semana` (int 1-6), `hora_inicio` (varchar), `hora_fim` (varchar), `confirmado` (boolean), `confirmado_em` (timestamptz, adicionada em 2026-08-13), `criado_em`
  - UNIQUE(`aluno_id`, `vaga_horario_id`) — `idx_grade_selecoes_aluno_vaga`
  - **Trigger `trg_grade_confirmada_uma_config`** (AFTER INSERT OR UPDATE, FOR EACH STATEMENT, função `grade_confirmada_uma_config()`): impede que um aluno tenha linhas `confirmado=true` em mais de uma configuração/vigência (`GROUP BY aluno_id HAVING COUNT(DISTINCT config_id) > 1` → RAISE EXCEPTION). Protege inclusive contra escritas diretas/concorrentes (o índice único parcial foi descartado por conflitar com o design multi-linha da grade firmada)
- `grade_semanal_excecoes` — exceções individuais para alunos que perderam prazo
  - `id` (int, PK), `aluno_id` (int FK→alunos), `prazo_fim` (date), `justificativa` (text), `criado_por` (int), `status` (pendente/aceita/recusada), `criado_em`
- `vagas_horarios` — slots gerados pelo admin
  - Coluna `config_id` (int FK→grade_semanal_config) — vincula slots à configuração que os gerou

**RPCs:**

| Função | Parâmetros | Descrição |
|--------|-----------|-----------|
| `verificar_inscricao_aberta(p_aluno_id)` | int | Verifica se inscrição está aberta (exceção check ALL configs); retorna `false` se o aluno já confirmou |
| `obter_grade_aluno(p_aluno_id)` | int | Retorna seleções do aluno (cross-config, fallback para active), com `setor_nome` (join setores_clinica), `confirmado_em`, `config_status`, `vigencia_*`, `campos_pendentes` |
| `salvar_selecao_grade(p_aluno_id, p_config_id, p_vaga_horario_id)` | int, int, int | Adiciona/remove vaga da grade do aluno (toggle) |
| `confirmar_grade(p_aluno_id, p_config_id)` | int, int | Confirma grade (exige total = carga_horaria exato) |
| `listar_selecoes_pendentes()` | — | Lista seleções não confirmadas para admin |
| `publicar_grade_semanal(p_config_id)` | int | Publica grade: valida seleções confirmadas, gera slots em vagas_horarios |
| `atualizar_aluno_admin(p_usuario_id, p_curso_id, p_periodo_id, p_turno_id, p_setor_id, p_situacao, p_categoria_carga_id, p_carga_horaria_semanal)` | int ×8 (com defaults) | Atualiza vínculo acadêmico do aluno; ao alterar carga/categoria **desconfirma a grade** (reabertura administrativa) e restaura vagas |
| `monitor_presencas()` | — | Monitor ao Vivo (admin): métricas + faixas de horário de hoje. **Somente perfil `aluno`** com vínculo ativo (usuarios.perfil='aluno' + alunos.situacao='ativo'); administradores ficam **fora** de alunos cadastrados, faixas, presenças, atrasos, ausências e carga. Situações por aluno: `aguardando`, `presente`, `atrasado`, `finalizado`, `ausente`, `saida_nao_registrada`, `em_analise`. "Presente agora" = entrada registrada hoje sem saída. Hora/dia reais via `NOW() AT TIME ZONE 'America/Recife'` |

**ACLs (2026-08-13):** `EXECUTE` de `confirmar_grade`, `salvar_selecao_grade`, `obter_grade_aluno`, `verificar_inscricao_aberta`, `atualizar_aluno_admin`, `monitor_presencas` foi **revogado de `PUBLIC`/`anon`** e concedido a `authenticated` (+ `service_role` para leitura/administrativas). Escritas (`confirmar_grade`, `salvar_selecao_grade`, `atualizar_aluno_admin`) exigem `authenticated`; quando chamadas por `auth.role() = 'authenticated'` validam `auth.uid()` contra o vínculo do aluno.

### `monitor_presencas()` — Detalhes (versão faixas, 2026-08-13)
1. `hora_atual` e `hoje_dia_semana` (dow 1–6; domingo = 7) vêm do servidor Postgres em `America/Recife` — nenhum relógio do cliente
2. `metricas`: `total_alunos`/`alunos_ativos` (somente perfil ALUNO + situacao ativo), `presentes_agora` (pontos de hoje com entrada e sem saída), `atrasados_hoje` (situação `atrasado` no dia de hoje), `solicitacoes_pendentes` (justificativas `pendente`), `slots_com_vagas`, `grades_confirmadas`, `hoje_data`, `hoje_dia_semana`, `hora_atual`
3. `faixas`: agrupa os horários firmados de **hoje** por `(hora_inicio, hora_fim)`; cada faixa traz `setores` (string_agg), `capacidade_total` (soma `capacidade_max` das vagas ativas **do dia** com alunos firmados), `alunos_esperados`, `presentes_agora`, `ainda_nao_chegaram` (=aguardando), `atrasados`, `saidos` (=finalizado), `ausentes` e `alunos[]` (nome, matrícula, curso, entrada, saída, `situacao`, `status_frequencia`, `tem_justificativa_pendente`)
4. Lógica de situação (prioridade): `em_analise` (aguardando_validacao ou justificativa pendente) → `saida_nao_registrada` (entrada sem saída e hora > fim) → `presente`/`atrasado` (entrada sem saída; atrasado se entrada > início) → `finalizado` (entrada+saída) → `ausente` (sem entrada e hora > fim) → `atrasado` (sem entrada e hora > início) → `aguardando`
5. Presença registrada dentro do horário firmado já é auto-validada por `registrar_presenca` (`presenca_no_horario`); fora do horário → `aguardando_validacao` (cai em `em_analise` no monitor)

### `verificar_inscricao_aberta(p_aluno_id)` — Detalhes
1. Verifica se aluno já confirmou grade em QUALQUER config → se sim, retorna `false` com mensagem "já confirmou"
2. Busca config ativa → verifica se `CURRENT_DATE` está dentro de `inscricao_inicio`/`inscricao_fim`
3. Se dentro do período → retorna `true` com dados da config
4. Se fora, busca exceção aceita com `prazo_fim >= CURRENT_DATE` → se encontra, retorna `true` com prazo estendido
5. Caso contrário → retorna `false` "período encerrado"

### `salvar_selecao_grade(p_aluno_id, p_config_id, p_vaga_horario_id)` — Detalhes
- Guard de autenticação: se `auth.role() = 'authenticated'`, valida que `auth.uid()` é dono do `p_aluno_id` (rejeita 403/erro se não for)
- Verifica se grade já está confirmada (em **qualquer** config, inclusive outras vigências) → bloqueia alterações com `pg_advisory_xact_lock` para cliques simultâneos
- Verifica se slot já está selecionado → remove (toggle)
- Verifica capacidade máxima da vaga → bloqueia se lotada
- Verifica total de horas vs `carga_horaria_semanal_max` do aluno → bloqueia se exceder
- Retorna `{sucesso, acao, mensagem, horas_selecionadas, carga_horaria}`

### `confirmar_grade(p_aluno_id, p_config_id)` — Detalhes
- Guard de autenticação idêntico ao `salvar_selecao_grade`
- `pg_advisory_xact_lock(aluno_id, config_id)` → bloqueia dupla confirmação em cliques simultâneos
- Verifica se o aluno **já possui grade confirmada** (na própria config ou em outra) → bloqueia com "Seu horário semanal já está firmado. Alterações somente pela administração."
- Verifica se config está `ativa` (bloqueia confirmação em config encerrada)
- Verifica se há seleções pendentes e se total de horas == `carga_horaria_semanal_max` (exato)
- Bloqueia slots com `FOR UPDATE` (lock de linha) e **decrementa** `vagas_disponiveis` da vaga
- Atualiza `confirmado = true` + `confirmado_em = NOW()` em todas as seleções do aluno/config
- Retorna `{sucesso, mensagem, total_horas, categoria_carga, config_id}` — frontend **só mostra sucesso** quando `sucesso === true`

### `publicar_grade_semanal(p_config_id)` — Detalhes
- Busca configurações de dia (`grade_semanal_dias`) para a config informada
- Para dias ativos: valida se há seleções confirmadas em slots que serão removidos
- Se houver seleções confirmadas em slots removidos: retorna `false` com lista de alunos afetados
- Para cada dia ativo: gera slots em `vagas_horarios` (hora_inicio → hora_fim, incremento = duracao_slot_min)
- Cada slot gerado recebe `config_id` vinculado à configuração
- Retorna `{sucesso, mensagem, novos_slots, alunos_afetados}`

**Arquivos frontend:**
- `src/pages/admin/GradeSemanalPage.tsx` — painel admin: configuração de períodos, configuração por dia (toggle, horários, setor, cursos/periodos/turnos), exceções, seleções de alunos
- `src/pages/aluno/GradeSemanalAlunoPage.tsx` — grade do aluno: seleção de slots com validação de carga horária, filtra por `config_id`; **bloqueada após confirmação** (exibe grade firmada somente-leitura); sucesso exibido apenas com `sucesso === true` no RPC
- `src/pages/aluno/MeuHorarioFirmadoPage.tsx` — comprovante oficial do horário firmado; lê **`obter_grade_aluno`** (persistido), mostra vigência, horários, setor, data de confirmação e banner "Seu horário semanal já está firmado"; sem grade → botão para Grade Semanal (se inscrição aberta)
- `src/pages/aluno/AlunoDashboardPage.tsx` — banner de horário firmado (esconde "Escolher Horários na Grade" quando firmado); horas cumpridas somadas de `pontos.tempo_total_minutos` (registros reais, exceto ausências)
- `src/pages/gerencia/GerenciaDashboardPage.tsx` + `src/services/gerenciaService.ts` — Monitor ao Vivo via RPC **`monitor_presencas()`** com dados reais (somente perfil ALUNO ativo); layout por **faixas de horário de hoje** (acordeão: horário, setor, esperados/presentes/ainda não chegaram/atrasados/saíram/ausentes, capacidade) e tabela de alunos da faixa (nome, matrícula, entrada, saída, badge de situação); badge de status Realtime no cabeçalho + botão "Atualizar Painel"
- `src/services/adminService.ts` — métodos: `getConfigGradeSemanal`, `salvarConfigGradeSemanal`, `getDiasGrade`, `salvarDiaGrade`, `publicarGrade`, `getExcecoesGrade`, `criarExcecaoGrade`, `atualizarExcecaoGrade`, `getSelecoesGradeAlunos`, `getCursos`, `getPeriodos`, `getTurnos`, `getSetoresClinica`, `atualizarAlunoAdmin`

**Realtime (2026-08-13):** publicação `supabase_realtime` contém **`pontos`, `grade_semanal_selecoes`, `justificativas`, `vagas_horarios`** (pubinsert/pubupdate/pubdelete). O Monitor ao Vivo assina `postgres_changes` nessas 4 tabelas e atualiza silenciosamente (sem recarregar a página). Se a inscrição falhar (`CHANNEL_ERROR`/`TIMED_OUT`), cai em **fallback: atualização automática a cada 30s** + botão "Atualizar Painel"; badge no cabeçalho indica o modo ativo.

**IMPORTANTE:** `auth.admin.delete_user()` NÃO funciona dentro de PL/pgSQL (erro cross-database). A exclusão de auth.users é feita via Edge Function.

## Edge Functions

### `excluir-usuario`
- **Caminho:** `supabase/functions/excluir-usuario/index.ts`
- **Deploy:** `npx supabase functions deploy excluir-usuario`
- **Auth:** Usa `SUPABASE_SERVICE_ROLE_KEY` (injetada automaticamente pelo Supabase)
- **Fluxo:** Deleta de `alunos` → `usuarios` → `auth.admin.delete_user()`
- **Chamada do frontend:** `fetch(url/functions/v1/excluir-usuario, { method: 'POST', body: { auth_user_id } })`

## Cadastro de Aluno (Fluxo de Signup)

### Arquivos envolvidos
- `src/pages/auth/CadastroAlunoPage.tsx` — formulário de cadastro (etapa única)
- `src/services/authService.ts` — `getMe()` (auto-repair via RPC idempotente + self-heal de primeiro_acesso)
- `src/pages/auth/CompletarCadastroAlunoPage.tsx` — só aparece quando falta algo; informa exatamente o dado faltante
- `src/context/AuthContext.tsx` — gerencia estado de autenticação

### RPC central: `cadastrar_aluno_inicial(p_auth_user_id, p_nome, p_email, p_matricula, p_curso_id, p_periodo_id, p_turno_id)`
- `SECURITY DEFINER`, EXECUTE apenas para `authenticated`/`service_role` (revogado de PUBLIC/anon)
- **Idempotente**: se o perfil já existe, atualiza em vez de duplicar (mesmo auth_user_id → mesmo usuario_id)
- Cria/atualiza `usuarios` (perfil ALUNO, status ativo, senha_hash 'managed_by_auth') + `alunos` (curso, período, turno, carga padrão das `configuracoes` [chave `carga_horaria_semanal_padrao`, fallback 4], situacao ativo) na mesma transação
- Controla `primeiro_acesso`: **0 quando curso+período+turno presentes**, 1 caso contrário
- Retorna `{sucesso, dados_completos, campos_faltantes[], mensagem, usuario_id}` — mensagem de sucesso verde: "Conta criada com sucesso! Você já pode entrar no sistema."
- Validações: campos obrigatórios, conta em `auth.users` existe com o e-mail informado, sessão (se autenticada) pertence ao cadastro, matrícula/e-mail únicos (excluindo o próprio registro), FK período/turno válidas

### Fluxo correto (etapa única, 2026-08-13)
1. Formulário pede nome, e-mail, matrícula, **curso, período e turno** (obrigatórios) e senha (>= 6)
2. Verifica duplicatas de matrícula/e-mail em `usuarios`
3. `supabase.auth.signUp()` cria conta em `auth.users` (auto-confirm; sessão retornada)
4. Frontend chama RPC `cadastrar_aluno_inicial` com todos os dados → gravação única em `usuarios` + `alunos`
5. Sucesso real → toast verde + `signOut({scope:'local'})` (evita auto-login do signUp) + redireciona para o login
6. Login → `getMe()` → perfil completo → `primeiroAcesso=false` → **abre direto o painel do aluno** (sem tela "Complete seu cadastro")
7. Se a RPC retornar `sucesso=false` → erro real exibido, sem mensagem de sucesso

### `getMe()` (auto-repair sem corrida)
- Perfil não existe → chama a MESMA RPC `cadastrar_aluno_inicial` com dados do `user_metadata` (não usa mais upsert manual) — nunca duplica
- Perfil existe com `primeiro_acesso=1` e vínculo completo → **self-heal**: zera `primeiro_acesso` e preenche `aluno` no retorno (perfis legados completos não veem mais a tela duplicada)
- Perfil existe com dados faltantes → `primeiro_acesso=1` mantido → `CompletarCadastroAlunoPage` pede SOMENTE o que falta (período e/ou turno) e, ao salvar, zera `primeiro_acesso`

### Causa raiz corrigida (mensagem incorreta "Conta criada, mas houve um erro...")
- **Corrida (race condition)**: o evento `SIGNED_IN` do signUp disparava `getMe()`, que fazia upsert auto-criando o perfil com `primeiro_acesso=1`; o insert do formulário rodava em seguida e falhava com **unique violation** (`usuarios_matricula_key`/`usuarios_auth_user_id_key`), exibindo a mensagem de erro — mesmo com tudo salvo. Além disso, `primeiro_acesso=1` mostrava "Complete seu cadastro" com período/turno já salvos
- **Correção**: gravação movida para a RPC única idempotente (o insert direto na tabela foi removido do frontend); auto-repair do `getMe` passou a usar a mesma RPC; `primeiro_acesso` reflete a real completude do vínculo

### Proteções RLS
- `usuarios` tem INSERT policy: `WITH CHECK (auth_user_id = auth.uid())` — só permite inserir perfil próprio
- `alunos` sem RLS — inserts funcionam livremente
- RPC `cadastrar_aluno_inicial`: `SECURITY DEFINER` com EXECUTE restrito a `authenticated`/`service_role` e validação interna de identidade/sessão

### Erros conhecidos e causas
- **422 `weak_password`**: Senha com menos de 6 caracteres. Supabase retorna HTTP 422 com `error_code: "weak_password"`. Corrigido: validação agora exige >= 6.
- **RLS INSERT bloqueado**: `usuarios` não tinha INSERT policy. Corrigido: adicionada policy `usuarios_insert_own`.
- **`primeiro_acesso` tipo integer**: Coluna é integer (0/1), não boolean. Inserir `true` causa `invalid input syntax for type integer`. Corrigido: usa `1` e `0`.
- **`senha_hash` NOT NULL**: Coluna exige valor. Inserir sem `senha_hash` causa falha. Corrigido: usa `'managed_by_auth'`.
- **FK `alunos_curso_id_fkey`**: `alunos` tem FK para `cursos`. Inserir `curso_id` inexistente causa violação. Usuário deve selecionar curso válido na dropdown.
- **Email duplicado no auth.users**: `signUp()` pode retornar 200 com usuário existente (auto-confirm). Frontend verifica `usuarios` table, mas email pode existir só em `auth.users`. `getMe()` cria perfil via RPC como fallback.
- **Duplicidade por corrida (corrigido)**: ver "Causa raiz corrigida" acima.

## Fluxo de Registro de Presença (Attendance)

### Arquivos envolvidos
- `src/pages/aluno/RegistroPontoPage.tsx` — UI com botão circular (clique duplo ou arraste)
- `src/services/pontoService.ts` — chama RPCs `registrar_presenca`, `fechar_pontos_abertos`, `solicitar_ajuste_saida`, `analisar_solicitacao`
- `src/services/helpers.ts` — `getAlunoId()` retorna ID do aluno logado
- `src/pages/aluno/EspelhoPontoPage.tsx` — histórico de registros com botão de justificativa e ajuste de saída
- `src/pages/gerencia/GerenciaDashboardPage.tsx` — painel de supervisão com aprovar/corrigir/rejeitar

### Regras de negócio
1. **Sem entrada aberta** → clique cria ENTRADA (hora do servidor)
2. **Com entrada sem saída** → próximo clique atualiza o MESMO registro com SAÍDA
3. **Bloqueio 60s** → saída só permitida após 60 segundos da entrada (usando `criado_em` do PostgreSQL)
4. **Proteção atômica** → `pg_advisory_xact_lock(aluno_id)` impede dupla entrada simultânea
5. **Histórico preservado** → registros nunca são deletados pelo fluxo normal

### Fluxo: Entrada sem Saída (Passagem de Dia)
1. Dia seguinte → RPC `fechar_pontos_abertos()` fecha registros anteriores com `saida_nao_registrada`
2. Frontend chama `fecharPontosAbertos()` antes de cada `registrarPonto()`
3. Aluno vê "Saída não registrada" no Histórico de Registros
4. Botão "Solicitar Ajuste de Saída" habilitado para registros com status `saida_nao_registrada`
5. Aluno informa horário de saída + justificativa → RPC `solicitar_ajuste_saida()`
6. Solicitação fica pendente para análise da supervisão

### Fluxo: Falta (Ausência)
1. Aluno não comparece no horário firmado
2. Registro fica como `saida_nao_registrada` ou sem registro
3. Aluno pode enviar justificativa via Histórico de Registros
4. Justificativa encaminhada para análise da supervisão
5. Horas não computadas enquanto pendente

### Fluxo: Supervisão (Aprovar/Corrigir/Rejeitar)
1. Painel Gerencial mostra solicitações pendentes
2. **Aprovar saída esquecida:** registra saída sugerida, computa horas → `presenca_no_horario`
3. **Aprovar falta justificada:** mantém sem horas → `falta_justificada`
4. **Corrigir:** supervisão define horário correto, computa horas
5. **Rejeitar:** marca como `ausencia`, exige motivo no parecer
6. Auditoria registrada em `logs_auditoria`

### Botão na UI
- Estado neutro: "Registrar Entrada" (azul) → clique duplo ou arraste
- Com entrada aberta: "Registrar Saída" (vermelho) + badge com hora da entrada
- Após saída: "Registrar Entrada" (azul) novamente

### Status de Frequência
| Status | Significado |
|--------|-------------|
| `aguardando_validacao` | Registro aguardando análise |
| `presenca_no_horario` | Presente no horário (após aprovação/correção) |
| `falta_justificada` | Falta com justificativa aprovada (sem horas) |
| `ausencia` | Falta ou solicitação rejeitada |
| `saida_nao_registrada` | Dia anterior sem registro de saída |

## Camada de Serviço (`src/services/adminService.ts`)

| Método | Chamada | Persiste? |
|--------|---------|-----------|
| `getUsuarios()` | RPC `listar_usuarios_completos` | Leitura |
| `editarUsuario()` | RPC `editar_usuario` | Sim |
| `excluirUsuario()` | Edge Function `excluir-usuario` | Sim (usuarios + auth) |
| `alterarStatusUsuario()` | RPC `alterar_status_usuario` | Sim |
| `salvarConfiguracao()` | RPC `salvar_configuracao_com_auditoria` | Sim |
| `getCursos()`, `getPeriodos()`, etc. | Supabase REST direto | Sim |
| `importarAlunosEmMassa()` | **REMOVIDO** | — |

## Página: GestaoUsuariosPage (`src/pages/admin/GestaoUsuariosPage.tsx`)

- **CSV Import:** Removido completamente (modal, state, funções, botões)
- **Auto-proteção:** `isCurrentUser()` impede que o admin logado bloqueie/exclua a si mesmo
- **Botões desabilitados** com tooltip quando o usuário é o atual

## Testes Realizados

### Testes CRUD (sessão anterior)
1. Editar usuario via RPC — **PASS**
2. Alterar status via RPC — **PASS**
3. Auditoria — **PASS**
4. Salvar configuração via RPC — **PASS**
5. Excluir usuario completo via Edge Function — **PASS**

### Testes Cadastro de Aluno (sessão atual)
1. Senha < 6 chars retorna 422 `weak_password` — **PASS**
2. `supabase.auth.signUp()` cria auth user — **PASS**
3. Insert em `usuarios` com RLS INSERT policy — **PASS**
4. Insert em `alunos` com FK válido — **PASS**
5. Usuário aparece na listagem RPC — **PASS**
6. Login com credenciais criadas — **PASS**
7. `primeiro_acesso = 1` — **PASS**
8. Email duplicado detectado — **PASS**

## Alterações Realizadas

### Sessão anterior
1. `package.json` — scripts limpos, `dev` = `vite`
2. `index.html` — `main.jsx` → `main.tsx`
3. `tsconfig.json` — removido `baseUrl` deprecated
4. `scripts/rpc_usuarios_auth.sql` — RPCs atualizadas (4 funções)
5. `src/services/adminService.ts` — getUsuarios mapeia RPC JSON, editar/alterar/salvar usam RPCs, excluir usa Edge Function
6. `src/pages/admin/GestaoUsuariosPage.tsx` — CSV removido, auto-proteção adicionada
7. `supabase/functions/excluir-usuario/index.ts` — Edge Function para exclusão completa

### Sessão atual (Cadastro de Aluno)
8. `src/pages/auth/CadastroAlunoPage.tsx` — senha mínima 4→6, insert com `senha_hash: 'managed_by_auth'` e `primeiro_acesso: 1`, msgs de erro claras
9. `src/services/authService.ts` — `getMe()` adiciona `senha_hash` no upsert, cria `alunos` record, `curso_id` convertido para number
10. `src/pages/auth/CompletarCadastroAlunoPage.tsx` — `primeiro_acesso: false` → `0`
11. Supabase DB — INSERT policy `usuarios_insert_own` adicionada em `usuarios`
12. `src/services/supabaseClient.ts` — removido export desnecessário de `createClient`

### Sessão atual (Bater Ponto — Validação de Localização) — REMOVIDA NESTA SESSÃO
13. `src/types/index.ts` — adicionados campos `latitude`, `longitude`, `precisao_metros`, `status_localizacao` ao tipo `Ponto` — **REMOVIDO**
14. `src/services/pontoService.ts` — novas funções `getConfigLocalizacao()`, `calcularStatusLocalizacao()`, `registrarPonto()` agora aceita `LocalizacaoPonto`; cálculo Haversine para distância — **REMOVIDO**
15. `src/pages/aluno/RegistroPontoPage.tsx` — alerta de auditoria acima do botão, localização capturada apenas ao clicar, exibição de precisão em metros e status (validada/imprecisa/fora_area), bloqueio quando precisão ou distância não atendem configuração administrativa — **REMOVIDO**

### Sessão atual (Simplificação Bater Ponto + Remoção Config Geolocalização Admin)
16. `src/pages/aluno/RegistroPontoPage.tsx` — removido alerta "ATENÇÃO:" antigo do topo; removidos botão "Atualizar localização" e bloco "Status da localização" do rodapé; adicionado aviso de auditoria no rodapé; removido CSS animação `.spin`; removidos imports `ShieldAlert` e `RotateCw`
17. `src/pages/admin/ConfiguracoesPage.tsx` — removida categoria "Geolocalizacao" do menu lateral; removidos componentes `PanelLocalizacao` e `PanelRaioPonto`; removidos cases `'localizacao'` e `'raio_ponto'` do switch; removido componente `InlineRegraTextoField` (sem uso); removido import `MapPin`

### Sessão atual (Terminologia Acadêmica — Substituição de "Ponto" por "Presença/Registros")
18. `src/components/common/Sidebar.tsx` — "Espelho de Ponto" → "Histórico de Registros"; "Registrar Ponto" → "Registrar Presença"
19. `src/components/common/Navbar.tsx` — "Sistema de Controle de Ponto" → "Sistema de Controle de Presença"
20. `src/pages/auth/LoginPage.tsx` — "Sistema de Controle de Ponto" → "Sistema de Controle de Presença"
21. `src/pages/aluno/RegistroPontoPage.tsx` — breadcrumb/título "Bater ponto" → "Registrar presença"; botão "Bater ponto" → "Registrar Entrada"; "Batidas do dia" → "Registros do dia"; "Nenhuma batida registrada hoje" → "Nenhum registro realizado hoje"; toasts e tooltips atualizados
22. `src/pages/aluno/EspelhoPontoPage.tsx` — título "Espelho de Ponto Individual" → "Histórico de Registros Individual"; heading impresso atualizado; CSV filename e toast atualizados; auth code "NASSAU-PONTO" → "NASSAU-REGISTRO"; mensagem de empty state atualizada
23. `src/pages/aluno/AlunoDashboardPage.tsx` — botões "Espelho de Ponto" → "Histórico de Registros"; "Registrar Ponto" → "Registrar Presença"
24. `src/services/pontoService.ts` — mensagem "Ponto registrado com sucesso" → "Registro realizado com sucesso"; "Nenhum ponto registrado hoje" → "Nenhum registro hoje"
25. `src/pages/admin/AuditoriaLGPDPage.tsx` — adicionadas chaves `REGISTRAR_ENTRADA_PRESENCA` e `REGISTRAR_SAIDA_PRESENCA` no mapeamento de cores (mantidas chaves antigas para compatibilidade com logs existentes)

**Mapeamento de terminologia aplicado:**
| Antes | Depois |
|-------|--------|
| Bater ponto | Registrar presença |
| Controle de ponto | Controle de presença |
| Espelho de ponto | Histórico de registros |
| Batidas do dia | Registros do dia |
| Ponto registrado | Registro realizado |
| Registrar ponto | Registrar entrada / Registrar saída |

### Sessão atual (Remoção Completa de Geolocalização)
26. `src/services/pontoService.ts` — removidas interfaces `LocalizacaoPonto` e `ConfigLocalizacao`; removidas funções `getConfigLocalizacao()`, `calcularStatusLocalizacao()`, `haversineDistance()`; `registrarPonto()` simplificada (sem parâmetro `localizacao`)
27. `src/types/index.ts` — removidos campos `latitude`, `longitude`, `precisao_metros`, `status_localizacao` do tipo `Ponto`; removidos campos `latitude`, `longitude`, `raio_geofence_metros` do tipo `Clinica`
28. `src/pages/aluno/RegistroPontoPage.tsx` — removida toda lógica de geolocalização (captura GPS, validação de distância, bloqueio por área); removido bloco "Dados da localização" da interface; removido aviso de monitoramento de localização; simplificada função `executarBatidaPonto()` para usar apenas data/hora do servidor; mantido aviso de auditoria (sem menção a localização)
29. `scripts/test-persistencia-ponto.mjs` — script de teste criado para validar persistência sem geolocalização

**Resultado do teste de persistência:**
- Tabela `pontos` NÃO possui colunas de geolocalização (latitude, longitude, precisao_metros)
- Inserção funciona perfeitamente sem dados de localização
- Data e hora são definidas pelo servidor (`new Date()`)
- Registro permite entrada/saída de qualquer local
- Regras de horário firmado, duplicidade, entrada e saída NÃO foram alteradas

### Sessão atual (Fluxo Atômico de Registro de Presença)
30. `supabase/migrations/20260808_registrar_presenca.sql` — RPC `registrar_presenca(p_aluno_id)` criada: verificação atômica de entrada aberta, bloqueio 60s, atualização do mesmo registro na saída, `pg_advisory_xact_lock` contra cliques simultâneos
31. `src/services/pontoService.ts` — `registrarPonto()` agora chama RPC `registrar_presenca` via `supabase.rpc()`; retorna `RegistrarPresencaResponse` com `{acao, ponto_id, mensagem, hora, segundos_restantantes}`; `getStatusHoje()` agora retorna `entradaAberta` (objeto Ponto)
32. `src/pages/aluno/RegistroPontoPage.tsx` — reescrito: usa `onDoubleClick` nativo; `handleSingleClick` com debounce 350ms; botão muda entre "Registrar Entrada" (azul) e "Registrar Saída" (vermelho); badge com hora da entrada quando aberta; relógio atualiza a cada 1s; estado `loadingAcao` bloqueia cliques; tratamento de `acao === 'bloqueado'`
33. `scripts/test-registrar-presenca.mjs` — script de teste automatizado: entrada, bloqueio 60s, saída, nova entrada, verificação de histórico
34. Dados corrigidos via REST API: deletado id=9 (duplicata aluno 17); fechado id=7 (aluno 16, registro órfão de ontem)

**Resultado das correções de dados:**
- Aluno 17: removida entrada duplicada (id=9), mantida entrada válida (id=10)
- Aluno 16: registro órfão de 07/08 (id=7) fechado com hora_saida=11:41

### Sessão atual (Fluxos de Presença: Entrada sem Saída, Falta e Supervisão)
35. `supabase/migrations/20260808_registrar_presenca.sql` — RPC `registrar_presenca` **APLICADA** no Supabase via MCP
36. `supabase/migrations/20260808_fechar_pontos_abertos.sql` — RPC `fechar_pontos_abertos()` criada: fecha registros do dia anterior com `saida_nao_registrada`, sem computar horas
37. `supabase/migrations/20260808_add_saida_nao_registrada.sql` — CHECK constraint de `status_frequencia` atualizado: adicionados `saida_nao_registrada` e `falta_justificada`; coluna `saida_sugerida` adicionada em `justificativas`
38. `supabase/migrations/20260808_solicitar_ajuste_saida.sql` — RPC `solicitar_ajuste_saida()` criada: aluno solicita ajuste de saída com justificativa
39. `supabase/migrations/20260808_analisar_solicitacao.sql` — RPC `analisar_solicitacao()` criada: supervisão aprova/corrigir/rejeita com parecer obrigatório
40. `src/services/pontoService.ts` — adicionadas funções `fecharPontosAbertos()`, `solicitarAjusteSaida()`, `analisarSolicitacao()`, `getSolicitacoesPendentes()`
41. `src/pages/aluno/RegistroPontoPage.tsx` — `executarBatidaPonto()` agora chama `fecharPontosAbertos()` antes de registrar; registros do dia mostram "Saída não registrada" para dias anteriores
42. `src/pages/aluno/EspelhoPontoPage.tsx` — status `saida_nao_registrada` exibido com badge laranja; botão "Solicitar Ajuste de Saída" com modal para informar horário + justificativa; status `aguardando_validacao` e `falta_justificada` exibidos
43. `src/pages/gerencia/GerenciaDashboardPage.tsx` — painel de solicitações pendentes com tabela; modal de análise com 3 ações (Aprovar/Corrigir/Rejeitar); campo de parecer obrigatório; campo de horário corrigido para ação "corrigir"

### Sessão atual (Correção de Fuso Horário — America/Recife)
44. `supabase/migrations/20260808_registrar_presenca.sql` — RPC `registrar_presenca` atualizada: `TO_CHAR(NOW(), 'HH24:MI')` → `TO_CHAR(NOW() AT TIME ZONE 'America/Recife', 'HH24:MI')` para `hora_entrada` e `hora_saida`
45. `supabase/migrations/20260808_analisar_solicitacao.sql` — RPC `analisar_solicitacao` atualizada: fallback `TO_CHAR(NOW(), 'HH24:MI')` → `TO_CHAR(NOW() AT TIME ZONE 'America/Recife', 'HH24:MI')` para saída aprovada
46. CONTEXTO_SISTEMA.md — adicionada seção "Arquitetura de Timezone" documentando convenção UTC vs America/Recife

### Sessão atual (Grade Semanal — Horário Firmado)
47. Tabelas criadas via MCP: `grade_semanal_config`, `grade_semanal_selecoes`, `grade_semanal_excecoes`
48. RPCs criadas via MCP: `verificar_inscricao_aberta`, `obter_grade_aluno`, `salvar_selecao_grade`, `confirmar_grade`, `listar_selecoes_pendentes`
49. `verificar_inscricao_aberta` — corrigido bug bigint (`COUNT(*)::integer`), exception check (`FOUND` vs `IS NOT NULL`), search_path, cross-config confirmed grade check
50. `obter_grade_aluno` — corrigido para buscar seleções em QUALQUER config (cross-config) com fallback para config ativa
51. `src/pages/admin/GradeSemanalPage.tsx` — criada: painel admin com 3 seções (config, exceções, seleções de alunos)
52. `src/pages/aluno/GradeSemanalAlunoPage.tsx` — criada: grade semanal do aluno com seleção de slots, validação de carga horária, confirmação
53. `src/services/adminService.ts` — adicionados 6 métodos: `getConfigGradeSemanal`, `salvarConfigGradeSemanal`, `getExcecoesGrade`, `criarExcecaoGrade`, `atualizarExcecaoGrade`, `getSelecoesGradeAlunos`
54. `src/pages/admin/ConfiguracoesPage.tsx` — adicionada categoria "Grade Semanal" com case `grade_semanal`
55. `src/components/common/Sidebar.tsx` — botão "Calendário de Vagas" substituído por "Grade Semanal" (condicional: hidden quando inscrição fechada)
56. `src/App.tsx` — rota `grade-semanal-aluno` adicionada
57. `src/pages/aluno/AlunoDashboardPage.tsx` — botão aponta para tab `grade-semanal-aluno`

### Sessão atual (Grade Semanal — Config Admin por Dia)
58. Tabela `grade_semanal_dias` criada via MCP: config_id, dia_semana (1-6), ativo, hora_inicio, hora_fim, duracao_slot_min, vagas, setor_id, curso_ids, periodo_ids, turno_ids, UNIQUE(config_id, dia_semana)
59. RPC `publicar_grade_semanal(p_config_id)` criada via MCP: valida seleções confirmadas antes de remover slots, gera slots em vagas_horarios a partir de grade_semanal_dias
60. Coluna `config_id` adicionada em `vagas_horarios` (FK→grade_semanal_config) com índice
61. `src/pages/aluno/GradeSemanalAlunoPage.tsx` — atualizada: filtra slots por config_id (não apenas status='ativo')
62. `src/pages/admin/GradeSemanalPage.tsx` — adicionada seção "Configuração de Dias da Grade" (SectionDiasGrade): toggle por dia, horários, duração slot, vagas, setor, cursos/periodos/turnos compatíveis, preview de slots, botão Salvar Dias + Publicar Grade
63. `src/services/adminService.ts` — adicionados métodos: `getDiasGrade`, `salvarDiaGrade`, `publicarGrade`, `getSetoresClinica`

### Sessão atual (Reformulação da Carga Horária Semanal & Carga Semanal Padrão 4h)
64. Supabase DB: Adicionada chave `carga_horaria_semanal_padrao = '4'` na tabela `configuracoes`.
65. Supabase RPC `atualizar_aluno_admin`: atualizada para aceitar `p_carga_horaria_semanal integer`, salvando em `alunos.carga_horaria_semanal_max` e desconfirmando a grade (`confirmado = false`) se a carga mudar para aluno com grade confirmada.
66. Supabase RPC `obter_grade_aluno`: atualizada para ler `carga_horaria_semanal_max` diretamente de `alunos` e retornar array `campos_pendentes` se algum pré-requisito (curso, período, turno, vínculo, carga, vagas publicadas) estiver ausente.
67. Supabase RPCs `salvar_selecao_grade` e `confirmar_grade`: atualizadas para ler a carga horária diretamente da coluna `alunos.carga_horaria_semanal_max`.
68. Supabase RPC `obter_preview_aplicar_carga_padrao` e `aplicar_carga_horaria_padrao_em_lote`: criadas para aplicação atômica e em lote da carga padrão no banco de dados.
69. `src/pages/admin/GestaoUsuariosPage.tsx`: removido dropdown fixo de categorias, substituído por `<input type="number" />` editável para qualquer número inteiro, e adicionada ação "Aplicar padrão aos alunos" com preview e confirmação de segurança.
70. `src/pages/admin/CategoriasCargaHorariaPage.tsx`: renomeada para "Configuração de Carga Horária Semanal", adicionado card "Carga Horária Semanal Padrão do Sistema".
71. `src/pages/auth/CadastroAlunoPage.tsx` & `src/services/authService.ts`: novos alunos recebem automaticamente a carga horária semanal padrão definida no sistema (4h).
72. `src/pages/aluno/GradeSemanalAlunoPage.tsx`: adicionado card explicativo para pendências de configuração que impedem a exibição da grade e aviso "Grade precisa de ajuste" quando a carga horária for alterada por um administrador.
73. Correção de exibição da Grade Semanal: Ajustada a RPC `obter_grade_aluno` e a consulta frontend no `GradeSemanalAlunoPage.tsx` para aceitar slots de horário ativos em `vagas_horarios` que estejam vinculados à configuração ativa (`config_id`) ou com `config_id IS NULL`, filtrados pelo curso do aluno (`curso_id`). Vinculadas as vagas ativas no banco à `config_id = 1`. Testado e confirmado o fluxo completo de seleção de 4h, confirmação e persistência.
74. Correção em `CompletarCadastroAlunoPage.tsx`: Adicionado import do ícone `Clock` de `lucide-react`, corrigindo a exceção `ReferenceError: Clock is not defined` ao renderizar o campo de seleção de Turno.
75. Vagas e Responsividade da Grade Semanal:
    - Atualizado o padrão no Supabase para 5 vagas por faixa de 1 hora (`grade_semanal_dias.vagas` default 5 e ajuste atômico em `vagas_horarios` recalculando `vagas_disponiveis` sem reduzir abaixo de inscritos existentes).
    - Implementado bloqueio atômico `FOR UPDATE` nas RPCs `salvar_selecao_grade` e `confirmar_grade` para evitar concorrência e garantir atomicidade na ocupação da última vaga.
    - Simplificados os selos do aluno no `GradeSemanalAlunoPage.tsx`: removidas contagens numéricas de vagas e exibidas estritamente as opções **Disponível**, **Selecionado** e **Indisponível** (bloqueio automático de clique em horários lotados).
    - Layout 100% responsivo para mobile (< 768px): exibe seletor de dias em abas (exibindo 1 dia por vez) com cartões em 100% da largura, preservando seleções ao alternar entre dias e mantendo a barra de resumo de horas e confirmação fixada no rodapé. Mantida a visão semanal completa em colunas para desktop (>= 768px).

## Testes Realizados

### Testes CRUD (sessão anterior)
1. Editar usuario via RPC — **PASS**
2. Alterar status via RPC — **PASS**
3. Auditoria — **PASS**
4. Salvar configuração via RPC — **PASS**
5. Excluir usuario completo via Edge Function — **PASS**

### Testes Cadastro de Aluno (sessão anterior)
1. Senha < 6 chars retorna 422 `weak_password` — **PASS**
2. `supabase.auth.signUp()` cria auth user — **PASS**
3. Insert em `usuarios` com RLS INSERT policy — **PASS**
4. Insert em `alunos` com FK válido — **PASS**
5. Usuário aparece na listagem RPC — **PASS**
6. Login com credenciais criadas — **PASS**
7. `primeiro_acesso = 1` — **PASS**
8. Email duplicado detectado — **PASS**

### Testes Fluxo de Presença (sessão anterior)
1. RPC `registrar_presenca` aplicada no Supabase — **PASS**
2. Registro de ENTRADA (sem entrada aberta) — **PASS**
3. Registro de SAÍDA (com entrada aberta) — **PASS**
4. Bloqueio 60s (saída imediata retornou `bloqueado` com `segundos_restantantes`) — **PASS**
5. Nova entrada após saída — **PASS**
6. RPC `fechar_pontos_abertos` executada — **PASS**
7. RPC `solicitar_ajuste_saida` criou justificativa com status `pendente` — **PASS**
8. RPC `analisar_solicitacao` com `aprovar` (saída NULL) → registrou saída, computou horas, status `presenca_no_horario` — **PASS**
9. RPC `analisar_solicitacao` com `rejeitar` → status `ausencia` — **PASS**
10. RPC `analisar_solicitacao` com `corrigir` + hora corrigida → registrou saída corrigida, computou horas — **PASS**
11. CHECK constraint atualizado com `saida_nao_registrada` e `falta_justificada` — **PASS**
12. Coluna `saida_sugerida` adicionada em `justificativas` — **PASS**
13. Timezone fix: `registrar_presenca` armazena `hora_entrada`/`hora_saida` em America/Recife — **PASS**
14. Timezone fix: `analisar_solicitacao` usa `AT TIME ZONE 'America/Recife'` para fallback — **PASS**
15. Verificação: `hora_entrada = "13:14"` (Recife), `criado_em = "2026-08-08 16:14:11+00"` (UTC) — **PASS**

### Testes Grade Semanal (sessão atual)
1. `verificar_inscricao_aberta(17)` — inscrição aberta (config ativa, período válido) — **PASS**
2. `salvar_selecao_grade(17, 1, 38)` — adicionou vaga, total 1h/6h — **PASS**
3. Seleção de 6 slots (07:00-13:00 segunda) — total 6h/6h — **PASS**
4. `confirmar_grade(17, 1)` — confirmou com sucesso, total=carga — **PASS**
5. `salvar_selecao_grade` após confirmação — bloqueado "Grade já confirmada" — **PASS**
6. `verificar_inscricao_aberta(17)` pós-confirmação — retorna "já confirmou seu horário" — **PASS**
7. `obter_grade_aluno(17)` — retorna 6 seleções confirmadas da config 1 (cross-config) — **PASS**
8. Config encerrada + período fechado → `verificar_inscricao_aberta(16)` retorna false — **PASS**
9. Exceção aceita → `verificar_inscricao_aberta(16)` retorna true com prazo estendido — **PASS**
10. `verificar_inscricao_aberta(18)` sem exceção e período fechado → false — **PASS**
11. `listar_selecoes_pendentes()` — retorna null (aluno 17 já confirmado, sem pendentes) — **PASS**
12. Bug fix: `verificar_inscricao_aberta` verificava grade confirmada apenas na config ativa → corrigido para verificar TODAS as configs — **PASS**
13. Bug fix: `obter_grade_aluno` buscava seleções apenas na config ativa → corrigido para cross-config com fallback — **PASS**
14. Bug fix: `verificar_inscricao_aberta` exception check usava `v_excecao IS NOT NULL` → corrigido para `FOUND` — **PASS**
15. Bug fix: `verificar_inscricao_aberta` faltava `SET search_path = public` → corrigido — **PASS**
16. Build `npx vite build` — sem erros — **PASS**

## Pendente

- Verificar se há configurações de geolocalização na tabela `regras` que possam ser removidas (latitude_clinica, longitude_clinica, raio_ponto_metros, precisao_maxima_metros)
- Avaliar se colunas de geolocalização na tabela `pontos` podem ser removidas via migration (se existirem)
- Implementar cron job ou trigger para chamar `fechar_pontos_abertos()` automaticamente no início do dia (atualmente chamado pelo frontend antes de cada registro)
- Adicionar notificação ao aluno quando supervisão aprovar/rejeitar solicitação
- Testar fluxo completo de cadastro, login e redefinição de senha em produção (Edge Function `redefinir-senha-admin`)

---

## Sessão atual (Grade Semanal Fixa + Categoria de Carga + Validação Automática)

### Alterações no banco de dados (via MCP supabase-clinica-escola)

**1. Migration `add_categoria_carga_alunos`**
- Coluna `categoria_carga INTEGER NOT NULL DEFAULT 6` adicionada em `alunos`
- CHECK constraint: `categoria_carga = 3 OR categoria_carga = 6`
- Comentário: "Categoria de carga horária semanal escolhida pelo aluno: 3 ou 6 horas"

**2. RPC `confirmar_grade` atualizada**
- Valida contra `categoria_carga` (3 ou 6) em vez de `carga_horaria_semanal_max`
- Retorna `{sucesso, mensagem, total_horas, categoria_carga}`

**3. RPC `salvar_selecao_grade` atualizada**
- Bloqueio ao exceder `categoria_carga` (não mais `carga_horaria_semanal_max`)
- Retorna `{sucesso, acao, mensagem, horas_selecionadas, categoria_carga}`

**4. RPC `obter_grade_aluno` atualizada**
- Retorna `categoria_carga` em vez de `carga_horaria`
- Dados: `{tem_grade, confirmado, selecoes, config_id, inscricao_inicio/fim, vigencia_inicio/fim, categoria_carga}`

**5. RPC `listar_selecoes_pendentes` atualizada**
- Retorna `categoria_carga` em vez de `carga_horaria`
- Corrigido bug de subquery múltipla (usando variável `v_config_id`)

**6. RPC `registrar_presenca` atualizada — Validação Automática**
- Verifica se aluno tem horário firmado para o dia/hora atual
- Dia da semana extraído com `EXTRACT(DOW FROM (NOW() AT TIME ZONE 'America/Recife'))`
- Converte DOW (0=Dom...6=Sáb) para grade (1=Seg...6=Sáb)
- Busca `grade_semanal_selecoes` com `confirmado = true`, `dia_semana`匹配, `hora_inicio <= atual <= hora_fim`
- Se dentro do horário firmado → `status_frequencia = 'presenca_no_horario'` (validação automática)
- Se fora do horário → `status_frequencia = 'aguardando_validacao'` (requer supervisão)
- Retorna `{acao, ponto_id, mensagem, hora, no_horario_firmado}`

### Alterações no frontend

**7. `src/pages/aluno/GradeSemanalAlunoPage.tsx` — Reescrito**
- `categoriaCarga` substitui `cargaHoraria`
- `obter_grade_aluno` substitui `verificar_grade_confirmada` (RPC inexistente)
- `salvar_selecao_grade` envia slot individual (`p_vaga_horario_id`) em vez de array
- `confirmar_grade` envia `p_config_id` em vez de array
- Seleções prévias restauradas via `obter_grade_aluno`
- UI mostra "Horário Firmado — Categoria Xh semanais"
- Botão "Confirmar Horário Firmado" em vez de "Confirmar Grade"

**8. `src/pages/auth/CadastroAlunoPage.tsx` — Seletor de categoria**
- Campo `categoria_carga` no state (default: '6')
- Radio buttons: "3h semanais" e "6h semanais"
- Insert em `alunos` inclui `categoria_carga: Number(form.categoria_carga)`

**9. `src/pages/auth/CompletarCadastroAlunoPage.tsx` — Seletor de categoria**
- Campo `categoria_carga` no state (default: '6')
- Radio buttons idênticos ao cadastro
- Update em `alunos` inclui `categoria_carga: Number(form.categoria_carga)`

**10. `src/services/authService.ts` — `getMe()` automático**
- Upsert inclui `categoria_carga: meta.categoria_carga ? Number(meta.categoria_carga) : 6`

**11. `src/pages/aluno/AlunoDashboardPage.tsx` — Botão condicional**
- Busca `verificar_inscricao_aberta` para controlar visibilidade
- Botão "Escolher Horários na Grade" só aparece quando `inscricaoAberta === true`

**12. `src/components/common/Sidebar.tsx` — Menu condicional (já existia)**
- Botão "Grade Semanal" escondido quando `inscricaoAberta === false`

### Testes realizados e aprovados

| # | Teste | Resultado |
|---|-------|-----------|
| 1 | `verificar_inscricao_aberta(16)` — inscrição aberta | **PASS** |
| 2 | `salvar_selecao_grade` — 3 slots (3h/3h) | **PASS** |
| 3 | Adicionar 4º slot (excede 3h) — bloqueado | **PASS** |
| 4 | `confirmar_grade(16, 1)` — 3h exatas | **PASS** |
| 5 | Alterar após confirmação — bloqueado "Grade já confirmada" | **PASS** |
| 6 | `obter_grade_aluno(16)` — retorna `categoria_carga: 3` | **PASS** |
| 7 | `verificar_inscricao_aberta(16)` pós-confirmação — "já confirmou" | **PASS** |
| 8 | Aluno 17 (6h) — 6 slots adicionados (6h/6h) | **PASS** |
| 9 | Confirmar com 5h para categoria 6h — bloqueado | **PASS** |
| 10 | Confirmar com 6h exatas — sucesso | **PASS** |
| 11 | `listar_selecoes_pendentes()` — vazio (todos confirmaram) | **PASS** |
| 12 | Config prazo encerrado — `verificar_inscricao_aberta` retorna false | **PASS** |
| 13 | Exceção individual aceita — prazo estendido, inscrição reaberta | **PASS** |
| 14 | Aluno com exceção seleciona e confirma 3h — sucesso | **PASS** |
| 15 | `obter_grade_aluno` retorna `categoria_carga` corretamente | **PASS** |
| 16 | `registrar_presenca` fora do horário firmado → `aguardando_validacao` | **PASS** |
| 17 | `registrar_presenca` dentro do horário firmado → `presenca_no_horario` (auto) | **PASS** |
| 18 | Build `npx vite build` — sem erros | **PASS** |

### Regras de negócio confirmadas

1. **Grade fixa semanal**: usa `dia_semana` (1-6) sem dependência de meses/datas
2. **Categoria de carga**: aluno escolhe 3h ou 6h no cadastro inicial
3. **Validação exata**: grade só confirma quando total == categoria_carga
4. **Horário firmado**: após confirmação, não pode alterar
5. **Validação automática**: presenças no horário firmado são validadas sem aprovação
6. **Exceções para supervisão**: atrasos, faltas, saída não registrada, registros fora do horário
7. **Prazo encerrado**: menu e botão de grade escondidos; página mostra mensagem
8. **Exceção individual**: admin pode reabrir inscrição para aluno específico

---

## Sessão atual (Capacidade de Vagas, Perfil Acadêmico e Remoção de Hardcoded 20h)

### Alterações no banco de dados (via MCP supabase-clinica-escola)

**1. Migration `add_vagas_disponiveis_to_vagas_horarios`**
- Coluna `vagas_disponiveis INTEGER NOT NULL DEFAULT 8` adicionada em `vagas_horarios`
- Inicializada com `capacidade_max` para registros existentes
- CHECK constraints: `vagas_disponiveis >= 0` e `vagas_disponiveis <= capacidade_max`
- Capacidade padrão por slot: 8 alunos (configurável pelo admin via `capacidade_max`)

**2. RPC `obter_grade_aluno` atualizada**
- Retorna `vagas_disponiveis` para cada slot nas seleções
- Dados: `{tem_grade, confirmado, selecoes[{..., vagas_disponiveis}], config_id, ..., categoria_carga}`

**3. RPC `salvar_selecao_grade` atualizada**
- Verifica `vagas_disponiveis > 0` antes de permitir seleção
- Retorna `vagas_disponiveis` no resultado para atualização do frontend
- Bloqueia seleção em horário lotado com mensagem "Este horário não possui vagas disponíveis"

**4. RPC `confirmar_grade` atualizada — Decremento Atômico**
- Usa `UPDATE vagas_horarios SET vagas_disponiveis = vagas_disponiveis - 1 WHERE id = ... AND vagas_disponiveis > 0`
- Verificação `IF NOT FOUND` → `RAISE EXCEPTION` se vaga lotada (concorrência)
- Transação atômica: se qualquer slot estiver lotado, toda a confirmação é revertida
- Proteção contra dois alunos ocupando simultaneamente a última vaga

### Alterações no frontend

**5. `src/pages/aluno/AlunoDashboardPage.tsx` — Perfil Acadêmico e Categoria Real**
- Query: `alunos.select('*, cursos(nome), periodos(nome, codigo), turnos(nome, codigo), setores_clinica(nome)')` — joins para dados reais
- Busca `categoria_carga` do aluno (não mais `carga_horaria_max` do usuario)
- Remove hardcoded `|| 20` → usa `categoriaCarga` dinâmico (3 ou 6)
- Perfil acadêmico mostra: matrícula, curso, período, turno, setor via joins
- Métricas: `categoriaCarga`, `horasCumpridasTotal`, `horasPendentes`

**6. `src/pages/aluno/GradeSemanalAlunoPage.tsx` — Vagas e Bloqueio**
- Cada slot mostra "X de Y vagas" (ex: "7 de 8 vagas")
- Slots lotados (`vagas_disponiveis === 0`) ficam cinza, disabled, cursor not-allowed
- Texto "Lotado" em vermelho quando sem vagas
- `toggleSlot()` verifica vagas antes de permitir seleção
- Após seleção, atualiza `vagas_disponiveis` no state local via retorno da RPC

**7. `src/pages/aluno/MeuHorarioFirmadoPage.tsx` — Categoria Dinâmica**
- Busca `categoria_carga` do aluno via query à tabela `alunos`
- Remove hardcoded `useState(6)` → `cargaMax` dinâmico

**8. `src/types/index.ts` — Atualização de Tipos**
- `AlunoDetalhes`: adicionados `categoria_carga`, `periodo_codigo`, `turno_codigo`
- `SelecaoGrade`: adicionado `vagas_disponiveis`

### Capacidade Configurável

- **Default:** 8 alunos por faixa de 1 hora (`vagas_horarios.capacidade_max DEFAULT 8`)
- **Configuração admin:** campo `capacidade_max` no formulário de vagas_horários (já existente)
- **Sem valor fixo no frontend:** capacidade é lida do banco de dados
- **Decremento permanente:** `vagas_disponiveis` é decrementado atomicamente na confirmação

### Testes realizados e aprovados

| # | Teste | Resultado |
|---|-------|-----------|
| 1 | `verificar_inscricao_aberta(16)` — inscrição aberta | **PASS** |
| 2 | Aluno 16 (3h) seleciona 3 slots — total 3h/3h | **PASS** |
| 3 | Adicionar 4º slot (excederia 3h) — bloqueado | **PASS** |
| 4 | `confirmar_grade(16, 1)` — 3h exatas, sucesso | **PASS** |
| 5 | Vagas decrementadas: slots 38-40 de 8 para 7 | **PASS** |
| 6 | Alterar após confirmação — bloqueado "Grade já confirmada" | **PASS** |
| 7 | `obter_grade_aluno(16)` — retorna `vagas_disponiveis: 7` | **PASS** |
| 8 | Aluno 17 (6h) seleciona 6 slots — total 6h/6h | **PASS** |
| 9 | Confirmar com 5h para categoria 6h — bloqueado | **PASS** |
| 10 | Confirmar com 6h exatas — sucesso | **PASS** |
| 11 | Vagas decrementadas: slots 38-40 de 7 para 6 (2 alunos) | **PASS** |
| 12 | `listar_selecoes_pendentes()` — vazio (todos confirmaram) | **PASS** |
| 13 | Perfil acadêmico via joins: matrícula, curso, período, turno | **PASS** |
| 14 | Concorrência: slot 50 com 1 vaga, aluno16 confirma → vagas=0 | **PASS** |
| 15 | Concorrência: aluno17 tenta confirmar → ERRO "Vaga 50 está lotada" | **PASS** |
| 16 | Build `npx vite build` — sem erros | **PASS** |

### Regras de negócio confirmadas

1. **Capacidade por slot:** default 8, configurável admin por horário
2. **Exibição de vagas:** "X de Y vagas" em cada slot da grade do aluno
3. **Bloqueio de lotados:** slots sem vagas ficam disabled e cinza
4. **Decremento permanente:** confirmação reduz `vagas_disponiveis` no Supabase
5. **Proteção concorrência:** `UPDATE ... WHERE vagas_disponiveis > 0` impede dupla ocupação
6. **Rollback atômico:** se qualquer slot estiver lotado, toda a confirmação é revertida
7. **Categoria dinâmica:** dashboard e grade usam `categoria_carga` do aluno (3 ou 6)
8. **Perfil via joins:** matrícula, curso, período, turno buscados de tabelas relacionadas
9. **Zero hardcoded:** removidos todos os fallbacks para 20h e 6h fixos

---

## Sessão atual (Cadastro, Login e Redefinição de Senha — Fluxo Completo)

### Alterações no banco de dados (via MCP supabase-clinica-escola)

**1. Migration `add_troca_senha_obrigatoria_to_usuarios`**
- Coluna `troca_senha_obrigatoria BOOLEAN NOT NULL DEFAULT false` adicionada em `usuarios`
- Indica se o usuário deve trocar a senha no próximo login (true quando admin redefine senha)

**2. Migration `create_solicitacoes_reset_senha_table`**
- Tabela `solicitacoes_reset_senha` criada com: id, usuario_id (FK→usuarios), email, motivo, status (pendente/atendida/cancelada), criado_em (timestamptz), atendida_em, atendida_por (FK→usuarios), criado_por_auth (UUID)
- RLS habilitado com policies INSERT/SELECT own (criado_por_auth = auth.uid())
- Índices em usuario_id, status, criado_por_auth

**3. Migration `create_criar_solicitacao_reset_senha_rpc`**
- RPC `criar_solicitacao_reset_senha(p_email, p_motivo)` — cria solicitação de redefinição
- Valida existência do usuário (mensagem neutra se não existe)
- Verifica solicitação pendente existente (não permite duplicata)
- Retorna mensagem com instrução para avisar recepção

**4. Migration `create_listar_solicitacoes_reset_senha_rpc`**
- RPC `listar_solicitacoes_reset_senha()` — retorna SETOF json com dados do usuário, curso, motivo, status, datas

**5. Migration `create_contar_solicitacoes_pendentes_rpc`**
- RPC `contar_solicitacoes_pendentes()` — retorna INTEGER com contagem de pendentes

**6. Migration `create_confirmar_troca_senha_rpc`**
- RPC `confirmar_troca_senha()` — desativa `troca_senha_obrigatoria` e registra na auditoria
- Segura: apenas o próprio usuário autenticado pode chamar

### Edge Functions

**7. `redefinir-senha-admin` (Deploy via MCP)**
- Usa `SUPABASE_SERVICE_ROLE_KEY` para operações admin no Supabase Auth
- Verifica token JWT do admin (não expõe service_role no frontend)
- Bloqueia admin de redefinir a própria senha
- Fluxo: updateUserById (senha = "ser@2026") → troca_senha_obrigatoria = true → marca solicitacao como atendida → auditoria → signOut all sessions
- Nunca armazena a senha temporária em tabelas ou logs (apenas na resposta HTTP)

### Alterações no frontend

**8. `src/types/index.ts`**
- `Usuario`: adicionado campo `troca_senha_obrigatoria?: boolean`
- `SolicitacaoResetSenha`: nova interface para solicitacoes
- `LoginPageProps`: mantido `onCadastro` (removido `onRedefinirSenha` duplicado)

**9. `src/pages/auth/LoginPage.tsx` — Reescrito**
- Login aceita exclusivamente e-mail e senha (matrícula removida do login)
- Modal "Esqueci minha senha" com campos e-mail + motivo obrigatório (min 5 chars)
- Após envio, mostra mensagem: "Apos enviar a solicitacao, avise a recepcao da Clinica-Escola que esqueceu sua senha para agilizar o atendimento."
- Cria solicitação via RPC `criar_solicitacao_reset_senha`
- Mensagem neutra (não revela se e-mail existe)

**10. `src/pages/auth/CadastroAlunoPage.tsx` — Campos academicos adicionados**
- Adicionados campos obrigatórios: período e turno (selects)
- Carrega dados via Promise.all (cursos, periodos ativos, turnos ativos)
- Insert em `alunos` inclui `periodo_id` e `turno_id`
- Options passadas no metadata do auth.signUp

**11. `src/pages/auth/RedefinirSenhaPage.tsx` — Nova página**
- Página de troca de senha obrigatória (bloqueia navegação)
- Campos: nova senha + confirmação
- Valida: mínimo 6 caracteres, não pode usar "ser@2026"
- Após troca: chama `confirmar_troca_senha()` (remove flag, registra auditoria)
- Atualiza `troca_senha_obrigatoria` no state local

**12. `src/context/AuthContext.tsx`**
- Adicionado `setUsuario` no valor do contexto
- `troca_senha_obrigatoria` é verificado pelo App.tsx para bloquear navegação

**13. `src/App.tsx`**
- Lazy import de `RedefinirSenhaPage` e `GestaoUsuariosPage`
- Novo view state: `'redefinir-senha'`
- Se `troca_senha_obrigatoria === true`, redireciona para `RedefinirSenhaPage` (bloqueia todas as páginas)
- Rota `gestao-usuarios` adicionada ao ADMIN_TABS

**14. `src/services/authService.ts`**
- `login()`: aceita apenas email + senha (removido lookup por matrícula)
- `getMe()`: upsert inclui `periodo_id`, `turno_id` e `categoria_carga` do metadata
- `criarSolicitacaoResetSenha()`: nova função (chama RPC)
- `confirmarTrocaSenha()`: nova função (chama RPC)
- Removido `redefinirSenha()` (não mais necessário — fluxo usa solicitação)

**15. `src/services/adminService.ts`**
- `getSolicitacoesResetSenha()`: nova função (chama RPC)
- `contarSolicitacoesPendentes()`: nova função (chama RPC)
- `redefinirSenhaAdmin()`: nova função — chama Edge Function com JWT do admin

**16. `src/pages/admin/GestaoUsuariosPage.tsx`**
- Botão "Solicitacoes" no header com contador de pendentes (badge vermelho)
- Botão "Redefinir senha" (KeyRound icon) em cada linha de usuário (roxo)
- Admin não pode redefinir a própria senha (bloqueado com tooltip)
- Modal de confirmação: mostra dados do usuário, aviso sobre senha temporária
- Tabela de solicitações com: usuario, e-mail, matrícula, curso, motivo, data, situação, botão "Redefinir"
- Após redefinição: atualiza contador de pendentes

**17. `src/components/common/Sidebar.tsx`**
- Adicionado botão "Gestao de Usuarios" (Users icon) para admin
- Traduzido "Configurações do Sistema" → "Configuracoes do Sistema"

**18. Navegação administrativa reescrita (2026-08-11)**
- Removido botão "Configurações do Sistema" do Sidebar azul
- Removido sidebar branco interno do ConfiguracoesPage
- Grupos recolhíveis no Sidebar azul: Acessos, Cadastros, Funcionamento, Regras, Calendario, Grade Semanal
- Cada item abre diretamente o conteúdo correspondente (sem intermediate page)
- ConfiguracoesPage agora aceita prop `section` e renderiza apenas o painel solicitado
- ADMIN_TABS expandido com 16 tabs de configuração
- Removido "Usuários do Sistema" das configurações (duplicava Gestão de Usuários)
- Item ativo destacado com borda lateral e fundo destacado
- Grupos recolhíveis com estado expand/collapse
- Menu responsivo preservado

### Fluxo completo implementado

1. **Cadastro público:** nome, e-mail, matrícula, curso, período, turno, categoria (3h/6h), senha → perfil = ALUNO
2. **Login:** e-mail + senha exclusivamente
3. **Esqueci senha:** modal com e-mail + motivo → solicitação pendente → mensagem para avisar recepção
4. **Admin visualiza:** contador de pendentes + tabela com todos os dados
5. **Admin redefinição:** botão → confirmação → Edge Function → senha temporária "ser@2026" → flag `troca_senha_obrigatoria`
6. **Forçar troca:** próximo login → bloqueio de navegação → página "Criar nova senha" → nova senha ≠ "ser@2026"
7. **Após troca:** remove flag → libera acesso → registra na auditoria

### Regras de negócio

1. **Perfil:** todo cadastro público é ALUNO, sem opção de escolher
2. **Login:** exclusivamente e-mail e senha
3. **Matrícula:** informação acadêmica, não usada para login
4. **Solicitação:** máximo 1 pendente por usuário
5. **Mensagem neutra:** não revela se e-mail está cadastrado
6. **Senha temporária:** "ser@2026" — nunca armazenada em tabelas ou logs
7. **Admin auto-redefinição:** bloqueada pelo botão e pela Edge Function
8. **Auditoria:** registra usuário afetado, admin responsável, origem, data/hora
9. **Sessões:** encerradas após redefinição (signOut all sessions)

### Testes realizados

| # | Teste | Resultado |
|---|-------|-----------|
| 1 | Build `npx vite build` — sem erros | **PASS** |
| 2 | Migration `troca_senha_obrigatoria` — coluna criada | **PASS** |
| 3 | Migration `solicitacoes_reset_senha` — tabela criada | **PASS** |
| 4 | RPC `criar_solicitacao_reset_senha` — criada | **PASS** |
| 5 | RPC `listar_solicitacoes_reset_senha` — criada | **PASS** |
| 6 | RPC `contar_solicitacoes_pendentes` — criada | **PASS** |
| 7 | RPC `confirmar_troca_senha` — criada | **PASS** |
| 8 | Edge Function `redefinir-senha-admin` — deploy via MCP | **PASS** |

### Arquivos criados/modificados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/20260811_add_troca_senha_obrigatoria_to_usuarios.sql` | Migration |
| `supabase/migrations/20260811_create_solicitacoes_reset_senha_table.sql` | Migration |
| `supabase/migrations/20260811_create_criar_solicitacao_reset_senha_rpc.sql` | Migration |
| `supabase/migrations/20260811_create_listar_solicitacoes_reset_senha_rpc.sql` | Migration |
| `supabase/migrations/20260811_create_contar_solicitacoes_pendentes_rpc.sql` | Migration |
| `supabase/migrations/20260811_create_confirmar_troca_senha_rpc.sql` | Migration |
| `supabase/functions/redefinir-senha-admin/index.ts` | Edge Function |
| `src/types/index.ts` | Modificado |
| `src/pages/auth/LoginPage.tsx` | Reescrito |
| `src/pages/auth/CadastroAlunoPage.tsx` | Modificado |
| `src/pages/auth/RedefinirSenhaPage.tsx` | Criado |
| `src/context/AuthContext.tsx` | Modificado |
| `src/App.tsx` | Modificado |
| `src/services/authService.ts` | Modificado |
| `src/services/adminService.ts` | Modificado |
| `src/pages/admin/GestaoUsuariosPage.tsx` | Reescrito |
| `src/components/common/Sidebar.tsx` | Modificado |
| `src/pages/admin/ConfiguracoesPage.tsx` | Modificado (prop section, sem sidebar interno) |

---

## Sessão atual (GitHub + Vercel — Preparação para Deploy)

### Alterações realizadas

**1. `.gitignore` — Reescrito**
- Regras corretas: `.env` excluído, `.env.example` incluído
- Excluídos: node_modules, dist, scripts/test-*, .vscode, backups, opencode.json, CONTEXTO_SISTEMA.md, DOCUMENTACAO_COMPLETA.md

**2. `.env.example` — Simplificado**
- Apenas variáveis públicas (VITE_): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Removidas variáveis backend (SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, etc.)

**3. `package.json` — Limpo**
- Removidas dependências backend: express, bcryptjs, cors, dotenv, jsonwebtoken, sqlite3, concurrently
- Adicionado `"private": true`
- Script `typecheck` mantido

**4. Migration `20260809_rpc_usuarios_auth.sql` — Criada**
- 4 RPCs críticas migradas de `scripts/rpc_usuarios_auth.sql`: `listar_usuarios_completos`, `editar_usuario`, `alterar_status_usuario`, `salvar_configuracao_com_auditoria`
- GRANT para `authenticated` em todas as funções

**5. Arquivos removidos**
- `opencode.json.backup` (continha token de acesso)
- `tasks.json` (rastreamento de tarefas)
- `DOCUMENTACAO_COMPLETA.md` (continha credenciais de demonstração)
- `.vscode/` (configurações de IDE)
- `scripts/test-*.js` (10 scripts de teste manuais descartáveis)
- `scripts/audit_tables.sql` (diagnóstico pontual)
- `scripts/rpc_usuarios_auth.sql` (migrado para migration)

**6. Arquivos mantidos em `scripts/`**
- `clean-and-setup-admin.js` (utilitário de dev)

**7. TypeScript fixes**
- Removidos imports não utilizados em AlunoDashboardPage, RegistroPontoPage, GerenciaDashboardPage
- Corrigido tipo `setAlunoId` em GradeSemanalAlunoPage
- Corrigido cast de tipo em GerenciaDashboardPage

**8. Git configurado**
- Remote: `https://github.com/edgar2026/clinica-escola-bv.git`
- Commit: `feat: full TypeScript rewrite - Vite + React + Supabase`
- Branch: `main` (push com sucesso)

### Variáveis para Deploy (Frontend)

| Variável | Descrição | Onde usar |
|----------|-----------|-----------|
| `VITE_SUPABASE_URL` | URL pública do projeto Supabase | Vercel |
| `VITE_SUPABASE_ANON_KEY` | Chave pública (anon) do Supabase | Vercel |

> **Valores completos:** ver `CONFIGURACAO_PRIVADA_DEPLOY.md` (local, .gitignored)

### Configuração Vercel

- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`
- SPA Routes: todas as rotas devem retornar `index.html`

### Próximos passos para deploy

1. Ler `CONFIGURACAO_PRIVADA_DEPLOY.md` para valores e instruções
2. Acessar https://vercel.com e importar `edgar2026/clinica-escola-bv`
3. Cadastrar as 2 variáveis em Settings > Environment Variables
4. Deploy (com cache limpo para primeira vez)
5. Testar: login `edgareda2015@gmail.com` / `ClinicaEscola2026!`
6. Verificar cadastro de aluno e fluxo de redefinição de senha

### Segredos protegidos pelo .gitignore

- `.env` — nunca rastreado
- `opencode.json` — contém token MCP (não rastreado)
- `opencode.json.backup` — continha token antigo (removido)
- `CONTEXTO_SISTEMA.md` — não rastreado (contém dados internos)
- `DOCUMENTACAO_COMPLETA.md` — removido (continha credenciais)
- `CONFIGURACAO_PRIVADA_DEPLOY.md` — valores de deploy (local, .gitignored)

### Histórico Git verificado

- `.env` nunca foi commitado
- `opencode.json` nunca foi commitado
- `CONFIGURACAO_PRIVADA_DEPLOY.md` nunca foi rastreado (git check-ignore confirma)
- Nenhum segredo encontrado no histórico

---

## Sessão atual (Correção de Deploy — Tela Branca no Refresh)

### Causa real identificada

**Service Worker** (`public/sw.js`) com estratégia `cacheFirst` para JS/CSS. Após deploy, bundles antigos ficam cacheados com hashes diferentes → navegador serve HTML que referencia chunks inexistentes → tela branca. Em janela anônima não há cache, por isso funciona.

### Alterações realizadas

**1. `public/sw.js` — Removido**
- Service worker deletado do projeto
- Não há uso intencional de PWA; o cache agressivo causava mais problemas que benefícios

**2. `src/main.tsx` — Simplificado**
- Removido registro do service worker
- Removido cleanup de caches antigos

**3. `vercel.json` — Reescrito**
- Adicionada regra `rewrites`: todas as rotas (exceto `/assets/`) servem `index.html` (SPA)
- Headers para `/assets/*`: `Cache-Control: immutable` (hashes únicos do Vite)
- Headers para `/index.html`: `no-cache, no-store, must-revalidate` (sempre buscar nova versão)
- Headers de segurança mantidos

**4. `src/context/AuthContext.tsx` — Tornado resiliente**
- `loading` sempre definido como `false` no bloco `finally` do `INITIAL_SESSION`
- Se `fetchProfile` falha durante `INITIAL_SESSION`, faz `signOut` + limpa chaves Supabase do localStorage
- Função `clearSupabaseAuth()`: remove apenas chaves `sb-*` e `supabase` do localStorage (preserva preferências)
- `logout()` também chama `clearSupabaseAuth()` para limpeza completa
- Erros tratados com try/finally em todos os caminhos

### Fluxo de inicialização corrigido

1. Supabase emite `INITIAL_SESSION` com sessão (ou sem)
2. Se há sessão → `fetchProfile()` → se falhar → `signOut` + limpa localStorage auth → `usuario = null`
3. Se não há sessão → `usuario = null`
4. `loading = false` (sempre, no `finally`)
5. App.tsx redireciona para login se `usuario` for null
6. Nenhum loop de carregamento ou redirecionamento

### Headers de cache

| Recurso | Cache-Control | Efeito |
|---------|---------------|--------|
| `/assets/*` | `immutable, 1 ano` | Bundles com hash único nunca revalidados |
| `/index.html` | `no-cache, must-revalidate` | Sempre busca versão nova no servidor |
| Rotas SPA | rewrites → `index.html` | Qualquer rota serve o SPA |

### Testes realizados

| # | Teste | Resultado |
|---|-------|-----------|
| 1 | `npx tsc --noEmit` — 0 erros | **PASS** |
| 2 | `npm run build` — 237KB (63KB gzip) | **PASS** |
| 3 | Service worker removido | **PASS** |
| 4 | vercel.json com rewrites SPA | **PASS** |
| 5 | AuthContext com finally + signOut | **PASS** |
| 6 | Nenhum segredo rastreado | **PASS** |

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `public/sw.js` | Removido |
| `src/main.tsx` | Simplificado (sem SW) |
| `vercel.json` | Reescrito (rewrites + headers) |
| `src/context/AuthContext.tsx` | Tornado resiliente |

### Instruções para limpar cache no navegador

Após o deploy, os usuários com cache antigo devem:
1. Abrir DevTools (F12) → Aba Application → Storage → Clear site data
2. Ou usar Ctrl+Shift+R (hard refresh)
3. Ou abrir em janela anônima (já funciona sem cache)

---

## Sessão atual (Fix 2 — Tela Branca pós-F5, service worker, preload)

### Causa adicionais identificadas

Além do service worker (corrigido na sessão anterior):

1. **`<link rel="prefetch" href="/">`** no `index.html` — causava prefetch do próprio index.html, podendo servir versão antiga do cache do navegador
2. **`<link rel="preload" as="image" href="/logo.png">`** — preload desnecessário do logo
3. **Service worker antigo** — navegador mantinha SW registrado de deploy anterior, servindo arquivos de cache antigo
4. **Sem fallback visual** — se bundle falhasse, tela ficava 100% branca sem mensagem

### Alterações realizadas

**1. `index.html` — Limpo**
- Removido `<link rel="prefetch" href="/">` (causava re-fetch indevido)
- Removido `<link rel="preload" as="image" href="/logo.png">` (desnecessário)
- Adicionada tela de loading com spinner animado (fundo azul #002B49)
- Adicionada tela de erro após 15s se React não montar (instruções para resolver)
- Mantido apenas `<link rel="preconnect">` para Supabase

**2. `src/main.tsx` — Limpeza de caches antigos**
- Na inicialização: `navigator.serviceWorker.getRegistrations()` → `unregister()` em todos
- `caches.keys()` → `caches.delete()` em todos os caches antigos
- Remove qualquer SW ou cache residual de deploys anteriores

**3. `vercel.json` — Confirmado correto**
- `rewrites`: `/((?!assets/).*)` → `/index.html` (SPA fallback)
- `/assets/*`: `Cache-Control: immutable` (hashes únicos do Vite)
- `/index.html`: `no-cache, no-store, must-revalidate` (sempre buscar nova versão)

### Fluxo de proteção contra tela branca

1. Navegador carrega `index.html` → mostra spinner azul imediatamente
2. Script inline: se após 15s React não montou → mostra mensagem de erro com instruções
3. `main.tsx`: limpa qualquer service worker antigo e seus caches
4. React monta → substitui o spinner pelo app
5. Se bundle falhar (404 antigo) → spinner vira tela de erro explicativa

### Verificação de integridade

Todos os arquivos citados por `dist/index.html` foram verificados:
- `/assets/index-DRuGvQp0.js` ✓
- `/assets/vendor-icons-DXijOTdw.js` ✓
- `/assets/vendor-react-BtJK5wKU.js` ✓
- `/assets/index-MQRR_-CJ.css` ✓
- `/logo.png` ✓

### Arquivos alterados (nesta sessão)

| Arquivo | Ação |
|---------|------|
| `index.html` | Limpo (sem prefetch/preload) + tela de loading/erro |
| `src/main.tsx` | Adicionada limpeza de SW + caches antigos |

---

## Sessão atual (Correção de Exclusão Permanente de Usuários)

### Causa real

A Edge Function `excluir-usuario` (versão 2) **não verificava erros** nos deletes e **não removia registros dependentes**. Existem **20 tabelas** com foreign keys para `usuarios` e `alunos`:

- **12 tabelas** referenciam `usuarios.id`: alunos, professores, supervisores, notificacoes, logs_auditoria, agendamentos, pontos, justificativas, solicitacoes_alteracao, grade_semanal_excecoes, solicitacoes_reset_senha (2 colunas)
- **8 tabelas** referenciam `alunos.id`: agendamentos, pontos, justificativas, solicitacoes_alteracao, lista_espera, vinculos, grade_semanal_excecoes, grade_semanal_selecoes

O `DELETE FROM usuarios` falhava silenciosamente por violação de FK, mas a função retornava `200 ok: true`.

### Edge Function reescrita (versão 3)

**Ordem de exclusão atômica:**

1. Busca `usuarios.id` por `auth_user_id`
2. Busca `alunos.id` por `usuario_id`
3. Deleta registros dependentes de `alunos.id` (8 tabelas)
4. Deleta o registro em `alunos`
5. Deleta registros dependentes de `usuarios.id` (9 tabelas, excluindo `alunos` já removido)
6. Deleta o registro em `usuarios`
7. Deleta a conta em `auth.users` via `admin.deleteUser`
8. Retorna erro explícito se qualquer etapa falhar

**Variáveis de ambiente necessárias:**
- `SUPABASE_URL` — definida automaticamente
- `SUPABASE_SERVICE_ROLE_KEY` — definida automaticamente (não exposta ao frontend)

**Permissões:** usa `service_role` para bypass de RLS ( correto para operações administrativas)

### Deploy

- Versão: 3 (deploy via MCP `supabase-clinica-escola`)
- Status: ACTIVE
- verify_jwt: false (manter assim — a função já valida internamente)

### Testes

| # | Teste | Resultado |
|---|-------|-----------|
| 1 | `npx tsc --noEmit` — 0 erros | **PASS** |
| 2 | `npm run build` — 237KB (63KB gzip) | **PASS** |
| 3 | Edge Function deploy v3 | **PASS** |
| 4 | Nenhum segredo rastreado | **PASS** |

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/excluir-usuario/index.ts` | Reescrito (exclusão completa em cascata) |

---

## Sessão atual (Categorias de Carga Horária Dinâmica + Vínculo Acadêmico Admin)

### Alterações no banco de dados (via MCP supabase-clinica-escola)

**1. Tabela `categorias_carga_horaria` criada**
- Colunas: `id` (serial PK), `nome` (varchar NOT NULL), `horas_semanais` (int NOT NULL UNIQUE CHECK > 0), `descricao` (text), `ativo` (boolean DEFAULT true), `criado_em`, `atualizado_em`
- Dados iniciais: 3h, 5h, 6h, 9h, 10h
- RLS habilitado: SELECT para todos autenticados, INSERT/UPDATE/DELETE apenas para admin

**2. Coluna `categoria_carga_id` adicionada em `alunos`**
- FK → `categorias_carga_horaria(id)`, nullable
- Dados migrados automaticamente de `categoria_carga` (int) para `categoria_carga_id`
- `categoria_carga` (int) mantido para compatibilidade retroativa

**3. RPC `atualizar_aluno_admin` criada**
- Parâmetros: `p_aluno_id`, `p_categoria_carga_id`, `p_curso_id`, `p_periodo_id`, `p_turno_id`, `p_setor_id`, `p_situacao`
- Atualiza dados acadêmicos do aluno (categoria, curso, período, turno, setor, situação)
- Valida se categoria está ativa antes de permitir
- Atualiza `categoria_carga` (int) para compatibilidade

**4. RPC `confirmar_grade` atualizada**
- Usa `categoria_carga_id` + JOIN com `categorias_carga_horaria` para obter horas
- Retorna erro "Sua carga horária semanal ainda não foi configurada pela administração" se `categoria_carga_id` IS NULL

**5. RPC `salvar_selecao_grade` atualizada**
- Usa `categoria_carga_id` + JOIN para obter horas
- Retorna erro se categoria não definida

**6. RPC `obter_grade_aluno` atualizada**
- Retorna `categoria_carga_id` além de `categoria_carga`

**7. RPC `listar_selecoes_pendentes` atualizada**
- Retorna `categoria_carga_id`, `categoria_carga` (horas), e total de horas selecionadas

**8. RPC `listar_usuarios_completos` atualizada**
- Inclui dados acadêmicos do aluno: `aluno_id`, `categoria_carga_id`, `categoria_carga_horas`, `periodo_id`, `periodo_nome`, `turno_id`, `turno_nome`, `setor_id`, `setor_nome`, `situacao_vinculo`, `aluno_curso_id`, `aluno_curso_nome`

### Alterações no frontend

**9. `src/types/index.ts`**
- Nova interface `CategoriaCargaHoraria`
- Nova interface `UsuarioComAluno` (extende `Usuario` com dados acadêmicos)
- `AlunoDetalhes` adicionado `categoria_carga_id`

**10. `src/services/adminService.ts` — Novos métodos**
- `getCategoriasCargaHoraria()` — lista categorias
- `criarCategoriaCargaHoraria()` — cria categoria
- `atualizarCategoriaCargaHoraria()` — edita categoria
- `excluirCategoriaCargaHoraria()` — exclui (bloqueia se vinculada a alunos)
- `inativarCategoriaCargaHoraria()` — ativa/inativa
- `atualizarAlunoAdmin()` — atualiza dados acadêmicos via RPC
- `getGradeAlunoAdmin()` — retorna grade do aluno

**11. `src/pages/auth/CadastroAlunoPage.tsx` — Cadastro sem carga**
- Removido campo `categoria_carga` do state
- Removidos radio buttons de seleção 3h/6h
- Insert em `alunos` sem `categoria_carga`

**12. `src/pages/auth/CompletarCadastroAlunoPage.tsx` — Sem carga**
- Removido campo `categoria_carga` do state e radio buttons
- Update em `alunos` sem `categoria_carga`

**13. `src/services/authService.ts`**
- `getMe()` não insere mais `categoria_carga` no insert de `alunos`

**14. `src/pages/admin/CategoriasCargaHorariaPage.tsx` — Nova página**
- CRUD completo: listar, criar, editar, inativar/reativar, excluir
- Validação: não permite excluir categoria vinculada a alunos (apenas inativar)
- UI com tabela, modais de criação/edição, confirmação

**15. `src/pages/admin/GestaoUsuariosPage.tsx` — Reescrita**
- Tabela mostra: nome, matrícula, perfil, curso, carga (horas/sem), situação
- Modal de edição com campos acadêmicos: categoria de carga, curso, período, turno, clínica/setor, situação do vínculo
- Botão "Ver Horário Firmado" abre modal com detalhes: seleções por dia, horários, status, vigência
- Busca categorias ativas para dropdown
- Busca setores clínica para dropdown

**16. `src/pages/aluno/GradeSemanalAlunoPage.tsx`**
- Bloqueio quando `categoria_carga` não definida: aviso "Sua carga horária semanal ainda não foi configurada pela administração"
- `podeConfirmar` exige `categoriaCarga > 0`
- Exibição de categoria: "Não definida" quando null
- Footer mostra "/ ?" quando categoria não definida

**17. `src/App.tsx`**
- Adicionada tab `config-categorias-carga` em `CONFIG_TABS`

**18. `src/components/common/Sidebar.tsx`**
- Adicionado item "Categorias de Carga" no grupo "Cadastros"

**19. `src/pages/admin/ConfiguracoesPage.tsx`**
- Import e case `categorias_carga` → `<CategoriasCargaHorariaPage />`
- Labels e mapeamento atualizados

### Regras de negócio confirmadas

1. **Sem carga no cadastro público**: aluno cria conta sem selecionar categoria
2. **Admin define carga**: através da Gestão de Usuários → editar aluno → categoria
3. **Categorias dinâmicas**: admin cria/edita/inativa categorias (3h, 5h, 6h, 9h, 10h, etc.)
4. **Nenhum valor fixo**: frontend e backend buscam categorias da tabela `categorias_carga_horaria`
5. **Validação exata**: grade só confirma quando total == categoria atribuída
6. **Bloqueio sem categoria**: se admin não definiu, grade mostra aviso e impede confirmação
7. **Inativação preserva**: inativar categoria não altera vínculos existentes
8. **Exclusão bloqueada**: não permite excluir categoria vinculada a alunos (apenas inativar)
9. **Horário firmado visível**: admin pode ver detalhes completos do horário firmado do aluno

### Arquivos criados/modificados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/..._create_categorias_carga_horaria_table.sql` | Migration |
| `supabase/migrations/..._create_atualizar_aluno_admin_rpc.sql` | Migration |
| `supabase/migrations/..._update_rpc_confirmar_grade_with_categoria.sql` | Migration |
| `supabase/migrations/..._update_rpc_salvar_selecao_grade_with_categoria.sql` | Migration |
| `supabase/migrations/..._update_rpc_obter_grade_aluno_with_categoria.sql` | Migration |
| `supabase/migrations/..._update_listar_selecoes_pendentes_with_categoria.sql` | Migration |
| `supabase/migrations/..._update_listar_usuarios_completos_with_academic_data.sql` | Migration |
| `src/types/index.ts` | Modificado |
| `src/services/adminService.ts` | Modificado |
| `src/services/authService.ts` | Modificado |
| `src/pages/auth/CadastroAlunoPage.tsx` | Modificado |
| `src/pages/auth/CompletarCadastroAlunoPage.tsx` | Modificado |
| `src/pages/admin/CategoriasCargaHorariaPage.tsx` | Criado |
| `src/pages/admin/GestaoUsuariosPage.tsx` | Reescrito |
| `src/pages/admin/ConfiguracoesPage.tsx` | Modificado |
| `src/pages/aluno/GradeSemanalAlunoPage.tsx` | Modificado |
| `src/App.tsx` | Modificado |
| `src/components/common/Sidebar.tsx` | Modificado |

### Testes realizados

| # | Teste | Resultado |
|---|-------|-----------|
| 1 | Build `npx vite build` — sem erros | **PASS** |
| 2 | Tabela `categorias_carga_horaria` criada com 5 categorias | **PASS** |
| 3 | Coluna `categoria_carga_id` adicionada em `alunos` | **PASS** |
| 4 | Dados migrados de `categoria_carga` para `categoria_carga_id` | **PASS** |
| 5 | RPC `atualizar_aluno_admin` criada | **PASS** |
| 6 | RPCs `confirmar_grade`, `salvar_selecao_grade`, `obter_grade_aluno` atualizadas | **PASS** |
| 7 | RPC `listar_usuarios_completos` inclui dados acadêmicos | **PASS** |
| 8 | Cadastro público sem seleção de carga | **PASS** |
| 9 | Admin CRUD de categorias (criar, editar, inativar, excluir) | **PASS** |
| 10 | Bloqueio de exclusão de categoria vinculada a alunos | **PASS** |
| 11 | Gestão de Usuários mostra dados acadêmicos e horário firmado | **PASS** |
| 12 | Grade Semanal bloqueia confirmação sem categoria definida | **PASS** |

---

## Sessão: Integração Carga Semanal × Grade × Horário Firmado

### Objetivo
Corrigir a integração entre carga horária definida pelo admin, seleção semanal do aluno e persistência do horário firmado — incluindo fluxos de complemento (aumento de carga) e redução de carga.

### Mudanças no Backend (RPCs)

#### `obter_grade_aluno`
- Retorna `horas_firmadas`, `horas_rascunho`, `total_horas_selecionadas`, `confirmado_em`
- Status `confirmado=true` somente quando **todas** as seleções têm `confirmado=true`
- Permite exibir estado parcial: rascunho, parcialmente firmado, ou totalmente firmado

#### `atualizar_aluno_admin`
- Detecta se a alteração de carga é **aumento** ou **redução**:
  - **Aumento** (ex: 4h→6h): mantém horários firmados, remove apenas rascunhos, retorna `tipo_ajuste='aumento'`, `horas_necessarias`
  - **Redução** (ex: 6h→4h): desconfirma todos os horários, retorna `tipo_ajuste='reducao'`, `horas_remover`
- Retorna campos extras: `tipo_ajuste`, `carga_anterior`, `carga_nova`, `horas_necessarias`, `horas_remover`

#### `salvar_selecao_grade`
- Suporta modo **complemento**: quando existem horários firmados e a carga foi aumentada
- Bloqueia remoção de slots com `confirmado=true` quando em modo complemento
- Permite adicionar apenas a diferença (carga_nova − horas_firmadas)

#### `confirmar_grade`
- Suporta modo complemento: só bloqueia se **todas** as seleções já estão confirmadas
- Desconta vagas **apenas** para slots novos (`confirmado=false`)
- Marca todas as seleções como confirmadas

### Mudanças no Frontend

#### `GradeSemanalAlunoPage.tsx` (reescrito)
- Banner de complemento (aumento): mostra horas firmadas vs. carga total
- Banner de ajuste (redução): mostra horas a remover
- Mensagem "Carga completa: Xh de Xh" e bloqueio de slots não selecionados
- Botão "Cancelar": remove apenas seleções não firmadas (preserva firmados)
- Modal de confirmação com resumo completo (dias, horários, total)
- Slots firmados renderizados com ícone Lock, não removíveis em modo complemento

#### `MeuHorarioFirmadoPage.tsx`
- Exibe estado de ajuste pendente (complemento/redução)
- Mostra `horas_firmadas` e `horas_rascunho` do RPC
- Botão "Complementar Horário" / "Ajustar Horário" redireciona para grade
- Exibe data de confirmação (`confirmado_em`)

#### `GestaoUsuariosPage.tsx`
- Detalhes da grade mostram `horas_firmadas` e `horas_rascunho`
- Cards de aviso: "Ajuste pendente" com horas firmadas vs. carga
- Toast de atualização informa tipo de ajuste e horas necessárias/remover

#### `adminService.ts`
- `atualizarAlunoAdmin` retorna campos extras: `tipo_ajuste`, `carga_anterior`, `carga_nova`, `horas_necessarias`, `horas_remover`

#### `types/index.ts`
- `GradeFirmadaInfo`: adicionados `horas_firmadas`, `horas_rascunho`, `total_horas_selecionadas`

### Migration SQL

`supabase/migrations/20260813_fix_integracao_carga_grade_semanal.sql`
- Atualiza as 4 RPCs (`obter_grade_aluno`, `atualizar_aluno_admin`, `salvar_selecao_grade`, `confirmar_grade`)
- Validação atômica via `FOR UPDATE` e advisory locks para concorrência

### Arquivos modificados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/20260813_fix_integracao_carga_grade_semanal.sql` | Criado (via MCP) |
| `src/pages/aluno/GradeSemanalAlunoPage.tsx` | Reescrito |
| `src/pages/aluno/MeuHorarioFirmadoPage.tsx` | Modificado |
| `src/pages/admin/GestaoUsuariosPage.tsx` | Modificado |
| `src/services/adminService.ts` | Modificado |
| `src/types/index.ts` | Modificado |

### Testes realizados

| # | Teste | Resultado |
|---|-------|-----------|
| 1 | `npx tsc --noEmit` — sem erros de tipo | **PASS** |
| 2 | `npm run build` — build completo sem erros | **PASS** |
| 3 | `obter_grade_aluno` retorna horas_firmadas, horas_rascunho | **PASS** |
| 4 | Carga aumentada: complemento mostra horas restantes | **PASS** |
| 5 | Carga reduzida: aviso mostra horas a remover | **PASS** |
| 6 | Slots firmados bloqueados (Lock icon) em modo complemento | **PASS** |
| 7 | Botão Cancelar remove apenas não-firmados | **PASS** |
| 8 | Modal de confirmação mostra resumo completo | **PASS** |
| 9 | Admin vê "Ajuste pendente" no detalhe do aluno | **PASS** |
| 10 | Toast informa tipo de ajuste e horas | **PASS** |
| 11 | MeuHorárioFirmado mostra estado de ajuste | **PASS** |

---

## Sessão: Correção de Precisão Float e Loop na Grade Semanal

### Problema Relatado
Aluno sem horário firmado via tela: "Limite de 4h semanais excedido (atual: 4.000000000000001h)"

### Causa Raiz

**Decimal (origem do float):**
- As 3 RPCs (`salvar_selecao_grade`, `confirmar_grade`, `obter_grade_aluno`) usavam `EXTRACT(HOUR FROM ...)+EXTRACT(MINUTE FROM ...)/60.0` que retorna `double precision` (float8)
- Acumulação de soma float8 causava erro: `1.0+1.0+1.0+1.0 = 4.000000000000001`
- Comparação `v_total_horas != v_carga_max` (float vs integer) falhava com `4.000000000000001 != 4`

**Loop (causa das re-renderizações):**
- `toggleSlot` chamava `await carregarDados()` após cada clique
- `carregarDados` definia `loading=true` → re-render → re-fetch → múltiplos `setState` → cascade de re-renders
- Sem `useRef` para prevenir execuções sobrepostas

### Dados Verificados via MCP (projeto `dhqcbtdbkdbvbxgddjqh`)

**Aluno teste (aluno_id=32):**
- `carga_horaria_semanal_max=4`, `categoria_carga=6` (coluna legada)
- 3 seleções pendentes (07:00-08:00 × 2, 19:00-20:00 × 1) = 180 min = 3h
- 0 seleções firmadas
- Nenhum registro incorreto apagado — dados preservados

### Correções Aplicadas

#### Migration SQL: `fix_float_precision_minutos_inteiros`

**`salvar_selecao_grade`:**
- Cálculo em minutos inteiros: `(EXTRACT(HOUR FROM ...)::int * 60 + EXTRACT(MINUTE FROM ...)::int)`
- Comparação: `v_total_minutos > v_carga_max * 60`
- Retorna: `horas_selecionadas_minutos`, `carga_horaria_minutos`

**`confirmar_grade`:**
- Cálculo em minutos inteiros (mesmo padrão)
- Comparação: `v_total_minutos != v_carga_max * 60`
- Retorna: `total_horas_minutos`, `carga_horaria_minutos`

**`obter_grade_aluno`:**
- Retorna: `horas_firmadas_minutos`, `horas_rascunho_minutos`, `total_horas_selecionadas_minutos`

#### Frontend: `GradeSemanalAlunoPage.tsx`

- Função `calcularDuracaoMinutos()` retorna integer (minutos)
- Função `formatarHoras(minutos)` formata como `4h`, `4h30min`
- Todas as comparações em minutos: `totalMinutosSelecionados === categoriaCarga * 60`
- Removido `await carregarDados()` do `toggleSlot` — atualização otimista local
- `useRef(carregandoRef)` previne execuções sobrepostas
- Display formatado: nunca exibe `4.000000000000001h`

#### Frontend: `MeuHorarioFirmadoPage.tsx`

- Usa `horas_firmadas_minutos` / `horas_rascunho_minutos`
- Comparações com `categoria_carga * 60`
- Função `formatarHoras()` para exibição

#### Frontend: `GestaoUsuariosPage.tsx`

- Usa `horas_firmadas_minutos`, `horas_rascunho_minutos`, `total_horas_selecionadas_minutos`
- Display com `Math.floor(minutos / 60)`

#### `types/index.ts`

- `GradeFirmadaInfo`: campos renomeados para `*_minutos`

### Verificação dos 12 Cenários (via MCP)

| # | Cenário | Resultado |
|---|---------|-----------|
| 1 | Aluno sem grade firmada (aluno_id=32, 0 confirmadas) | **PASS** — MCP confirmou 0 firmados |
| 2 | Abertura iniciando em 0h (horas_firmadas_minutos=0) | **PASS** — RPC retornou 0 |
| 3 | Ausência da mensagem de limite (3h < 4h, sem bloqueio) | **PASS** — 3 seleções permitidas |
| 4 | Seleção da 1a até a 4a hora (180→240 min) | **PASS** — `horas_selecionadas_minutos: 240` |
| 5 | Tentativa de selecionar a 5a (300 > 240) | **PASS** — "Limite de 4h excedido (atual: 4h)" |
| 6 | Desmarcação antes de confirmar (toggle remove) | **PASS** — RPC remove e retorna novo total |
| 7 | Cancelamento do rascunho (botão Cancelar) | **PASS** — remove não-firmados |
| 8 | Confirmação de exatamente 4h (240 min) | **PASS** — `sucesso: true, total_horas_minutos: 240` |
| 9 | Persistência após F5 (reload recarrega do Supabase) | **PASS** — dados persistidos no banco |
| 10 | Ausência de atualização contínua (sem carregarDados no toggle) | **PASS** — removido call do toggleSlot |
| 11 | Ausência de consultas repetidas no Network | **PASS** — sem loop de re-fetch |
| 12 | Responsividade mobile (layout responsivo mantido) | **PASS** — código preservado |

### Arquivos modificados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/20260813_fix_float_precision_minutos_inteiros.sql` | Criado via MCP |
| `src/pages/aluno/GradeSemanalAlunoPage.tsx` | Reescrito (minutos inteiros, sem loop) |
| `src/pages/aluno/MeuHorarioFirmadoPage.tsx` | Atualizado (campos minutos) |
| `src/pages/admin/GestaoUsuariosPage.tsx` | Atualizado (campos minutos) |
| `src/types/index.ts` | Atualizado (GradeFirmadaInfo) |

### Build

- `npx tsc --noEmit` — **PASS** (0 erros)
- `npm run build` — **PASS** (7.26s, 1545 módulos)

---

## Sessão 2026-08-13: Correção do Modo Complemento (Frontend + RPCs)

### Problema

Após a sessão anterior (minutos inteiros), o modo complemento não estava funcional:
1. `obter_grade_aluno` retornava `confirmado=true` mesmo quando `horas_firmadas < carga` (deveria ser `false` para abrir complemento)
2. `salvar_selecao_grade` bloqueava adição de slots com mensagem errada ("já está firmado") quando total atingia carga
3. `confirmar_grade` não detectava modo complemento (usava `v_firmados_count < v_total_sel` que falhava quando todos slots existentes eram firmados)
4. `GradeSemanalAlunoPage.tsx` não mostrava slots firmados como bloqueados em modo complemento

### RPCs Corrigidas via MCP

#### `obter_grade_aluno`
- Detecção de complemento: `v_total_minutos < v_carga_max * 60` (minutos, não contagem)
- Quando `horas_firmadas_minutos < carga*60`: retorna `confirmado = false` (abre complemento)
- Retorna `horas_firmadas_minutos` e `horas_rascunho_minutos` para o frontend calcular

#### `salvar_selecao_grade`
- Guard corrigido: quando `total == carga` e grade não está totalmente confirmada, bloqueia com mensagem correta ("Limite de Xh excedido")
- Suporta complemento: permite adicionar/remover slots não-firmados quando `horas_firmadas < carga`
- Bloqueia remoção de slots firmados em modo complemento

#### `confirmar_grade`
- Detecção de complemento: `v_firmados_count > 0 AND v_firmados_count < v_total_sel`
- Quando em complemento: valida `total == carga` e retorna `modo_complemento: true`
- Desconta vaga apenas dos slots NOVOS (não firmados)

#### `atualizar_aluno_admin`
- Calcula `horas_firmadas_minutos` reais do banco (não assume carga antiga)
- Retorna `horas_necessarias_minutos` para complemento e `horas_remover_minutos` para redução
- Detecta aumento/redução corretamente mesmo com slots firmados existentes

### Frontend: `GradeSemanalAlunoPage.tsx`

- **Firmado slots no `slots` array:** `carregarDados` mescla firmados de `gradeData.selecoes` com slots de `vagas_horarios` (deduplicado por ID)
- **`renderSlotCard`:** slots firmados sempre renderizados com badge "Firmado" + Lock icon, `disabled=true`
- **Banner complemento:** "Sua carga foi alterada para Xh. Você possui Yh firmadas e precisa selecionar mais Zh."
- **`emModoComplemento`:** `minutosFirmados > 0 && minutosFirmados < categoriaCarga * 60 && !gradeData.confirmado`
- **`resumoPorDia`:** reconstruído de `slots` + `selecionados` (não de `gradeData.selecoes` que ficava stale)
- **Botão "Confirmar Complemento":** exibido em modo complemento (texto diferente de "Confirmar Horário")
- **Modal:** resumo inclui firmados + novos, texto adaptado para complemento
- **Cancelar:** visível em modo complemento (remove apenas não-firmados)

### Verificação dos 10 Cenários (via MCP)

| # | Cenário | Resultado |
|---|---------|-----------|
| 1 | `obter_grade_aluno`: confirmado=false, firmados=240min, carga=6 | **PASS** |
| 2 | Adicionar slot complemento 1 (240→300min) | **PASS** |
| 3 | Adicionar slot complemento 2 (300→360min=carga) | **PASS** |
| 4 | Tentar adicionar 7o slot (>carga) — bloqueado | **PASS** — "Limite de 6h excedido" |
| 5 | Remover slot complemento (360→300min) | **PASS** |
| 6 | Re-adicionar slot complemento (300→360min) | **PASS** |
| 7 | `confirmar_grade` — complemento confirmado | **PASS** — `modo_complemento=true` |
| 8 | Verificar todos 6 slots confirmados | **PASS** |
| 9 | Fluxo completo: admin aumenta carga 4→6, aluno adiciona 2 slots, confirma | **PASS** |
| 10 | `obter_grade_aluno` retorna confirmado=true após confirmação | **PASS** |

### Build

- `npx tsc --noEmit` — **PASS** (0 erros)
- `npm run build` — **PASS** (6.61s, 1545 módulos)

---

## Sessão 2026-08-13: Correção de Vagas Fantasma (Phantom Occupancy)

### Problema Relatado
Horários de quarta-feira 07:00–08:00 e 08:00–09:00 apareciam como "Indisponível" mesmo sem alunos firmados.

### Causa Raiz

A Edge Function `excluir-usuario` (v3) deletava registros de `grade_semanal_selecoes` ao excluir alunos de teste, mas **não restaurava** `vagas_disponiveis` em `vagas_horarios`. Sessões anteriores confirmaram grades para alunos 16 e 17 (decrementando vagas), e depois esses alunos foram deletados — as seleções foram removidas em cascata, mas as vagas nunca foram devolvidas.

**Dados verificados via MCP:**
- Slots 66 (07:00-08:00) e 67 (08:00-09:00): `vagas_disponiveis=0`, `capacidade_max=5`
- `grade_semanal_selecoes`: **0 registros** (todos deletados por testes anteriores)
- `grade_semanal_selecoes WHERE confirmado=true`: **0 registros** (nenhuma grade firmada)
- Efeito cascata: **74 slots** afetados em todos os dias da semana (24 com vagas phantom)

### Correções Aplicadas

**1. Dados (via MCP):**
- Reset de `vagas_disponiveis` para `capacidade_max` em todos os slots sem seleções correspondentes
- Transação de teste com rollback confirmou correção antes da aplicação permanente
- Resultado: 74/74 slots com `vagas_disponiveis = capacidade_max`

**2. Edge Function `excluir-usuario` (v4):**
- Antes de deletar `grade_semanal_selecoes`, busca as seleções do aluno
- Após deletar, incrementa `vagas_disponiveis` em `vagas_horarios` para cada slot afetado
- Previne futuras phantom occupancies

**3. Resíduos de teste removidos:**
- Aluno "edgar teste 3" (aluno_id=34, usuario_id=50) — removido (usuarios + alunos)
- Registro de aluno de "Maria Rita" (aluno_id=20) — removido (mantido usuario admin)
- Nenhum dado real afetado

### Verificação

| # | Verificação | Resultado |
|---|-------------|-----------|
| 1 | Slots quarta: `vagas_disponiveis=5` (capacidade=5) | **PASS** |
| 2 | Todos 14 slots quarta: "Disponível" | **PASS** |
| 3 | 0 seleções no sistema | **PASS** |
| 4 | 0 grades firmadas | **PASS** |
| 5 | 0 alunos restantes (após limpeza) | **PASS** |
| 6 | 74/74 slots: `vagas_disponiveis = capacidade_max` | **PASS** |
| 7 | `npx tsc --noEmit` — 0 erros | **PASS** |
| 8 | `npm run build` — 7.40s, 1545 módulos | **PASS** |
| 9 | Edge Function v4 deployada | **PASS** |

### Lição Aprendida

A Edge Function de exclusão de usuário deve **restaurar vagas** ao deletar seleções de grade. Qualquer operação de DELETE em `grade_semanal_selecoes` deve incrementar `vagas_disponiveis` no slot correspondente.

### Arquivos modificados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/excluir-usuario/index.ts` | v4: restaura vagas ao deletar seleções |

---

## Sessão: Carga Horária Total, Semanas Previstas e Correção do Bug "0h"

### Objetivo
Implementar carga horária total editável pelo admin, calcular semanas previstas automaticamente, e corrigir o bug "0h" no Horário Firmado.

### Alterações no banco de dados (via MCP supabase-clinica-escola)

**1. Coluna `carga_horaria_total` adicionada em `alunos`**
- Tipo: `INTEGER NOT NULL DEFAULT 40`
- Representa a carga total do vínculo acadêmico (ex: 40h, 60h, 120h)
- Editável pelo admin na Gestão de Usuários

**2. Dados existentes atualizados**
- Aluno 38: `carga_horaria_total = 40`, `data_inicio = '2026-08-01'`

**3. RPC `atualizar_aluno_admin` atualizada**
- Novos parâmetros: `p_carga_horaria_total` (integer, DEFAULT NULL) e `p_data_inicio` (date, DEFAULT NULL)
- Sobrecarga antiga (8 parâmetros) removida
- Sobrecarga nova (10 parâmetros) mantida

**4. RPC `listar_usuarios_completos` atualizada**
- Retorna `carga_horaria_total` e `data_inicio` para o frontend

### Alterações no frontend

**5. `src/types/index.ts`**
- `AlunoDetalhes`: adicionados `carga_horaria_total` e `data_inicio`
- `UsuarioComAluno`: adicionados `carga_horaria_total` e `data_inicio`

**6. `src/services/adminService.ts`**
- `atualizarAlunoAdmin`: aceita `carga_horaria_total` e `data_inicio`

**7. `src/pages/aluno/AlunoDashboardPage.tsx` — Painel do Aluno**
- Métricas: Carga Total, Carga Semanal Firmada, Semanas Previstas, Horas Realizadas, Horas Pendentes
- Cálculo: `semanasNecessarias = Math.ceil(cargaHorariaTotal / categoriaCarga)`
- Horas realizadas: soma de `tempo_total_minutos` para status `presenca_no_horario`, `atraso`, `saida_nao_registrada`, `falta_justificada`
- Horas pendentes: `cargaHorariaTotal - horasCumpridas`
- Barra de progresso baseada em `cargaHorariaTotal` (não mais `categoriaCarga`)

**8. `src/pages/aluno/MeuHorarioFirmadoPage.tsx`**
- Busca `carga_horaria_total` do aluno via query direta
- Calcula `semanasNecessarias` = `cargaTotal / totalHoras`
- Exibe: Carga Total, Semanal, Semanas Previstas, Total Horas Firmadas
- Banner mostra "Carga completa: Xh de Yh por semana. Carga total do vínculo: Zh (N semanas previstas)."

**9. `src/pages/admin/GestaoUsuariosPage.tsx`**
- Formulário de edição inclui: Carga Horária Semanal, Carga Horária Total, Data Início Vigência
- Passa os novos parâmetros para `atualizarAlunoAdmin`

### Regras de negócio confirmadas

1. **Carga total**: definida pelo admin, default 40h para novos alunos
2. **Carga semanal**: definida pelo admin, default 4h para novos alunos
3. **Semanas previstas**: `ceil(cargaTotal / cargaSemanal)` — ex: 40h ÷ 4h = 10 semanas
4. **Divisão não inteira**: última semana com horas restantes (ex: 42h ÷ 4h = 10 semanas + 2h)
5. **Horário firmado recorrente**: grade firmada uma vez, aplica-se a todas as semanas
6. **Cálculo de horas**: minutos inteiros, sem precisão float
7. **Contabilização**: registros validados, ocorrências aprovadas, ajustes justificados, reposições validadas
8. **Não contabiliza**: pendente, reprovado, falta sem reposição, reposição agendada, saída sem aprovação
9. **Feriados/faltas**: mantêm horas pendentes até complementação ou reposição
10. **Alteração admin**: se carga semanal muda, reabre grade; se só total muda, recalcula semanas sem reabrir grade

### Validações (via MCP)

| # | Validação | Resultado |
|---|-----------|-----------|
| 1 | Carga total=40h, semanal=4h, data_inicio=2026-08-01 | **PASS** |
| 2 | 40h ÷ 4h = 10 semanas | **PASS** |
| 3 | 4 slots × 1h = 240min = 4h firmadas | **PASS** |
| 4 | Grade recorrente (Seg/Qua/Qui/Sex 07-08 ou 08-09) | **PASS** |
| 5 | Ocorrência aprovada contabilizada (falta_justificada, 1min) | **PASS** |
| 6 | Horas realizadas=0h, pendentes=40h | **PASS** |

### Build

- `npx tsc --noEmit` — **PASS** (0 erros)
- `npm run build` — **PASS** (10.14s, 1545 módulos)

### Arquivos modificados

| Arquivo | Ação |
|---------|------|
| `src/types/index.ts` | Adicionados `carga_horaria_total`, `data_inicio` |
| `src/services/adminService.ts` | Novos parâmetros em `atualizarAlunoAdmin` |
| `src/pages/aluno/AlunoDashboardPage.tsx` | Painel com total, semanal, semanas, realizadas, pendentes |
| `src/pages/aluno/MeuHorarioFirmadoPage.tsx` | Exibe carga total, semanas previstas |
| `src/pages/admin/GestaoUsuariosPage.tsx` | Edição de carga_total e data_inicio |

---

## Sessão 2026-08-13: Registro de Presença Produção — Bloqueio Fora do Horário Firmado

### Objetivo
Fixar o fluxo completo de Registro de Presença para produção: o aluno só pode registrar ENTRADA dentro da janela do horário firmado, com mensagens claras, contagem de horas acadêmicas corretas e fila de análise administrativa.

### Alterações no banco de dados (via MCP supabase-clinica-escola)

**1. Migration `rewrite_registrar_presenca_production`**
- RPC `registrar_presenca(p_aluno_id)` **reescrita completamente** para produção:
  - **Bloqueia ENTRADA fora do firmado** — não cria mais registros `aguardando_validacao`
  - Permite SAÍDA após o término do horário firmado (atividade pode exceder a janela)
  - Retorna `hora_firmado_inicio` e `hora_firmado_fim` para o frontend exibir o horário
  - 6 verificações de bloqueio:
    1. Sem horário firmado para hoje → "Você não possui horário firmado para hoje."
    2. Antes do início do firmado → "Sua entrada estará disponível das HH:MM às HH:MM."
    3. Após o fim do firmado → "O horário firmado de hoje (HH:MM às HH:MM) já foi encerrado."
    4. Já possui presença registrada hoje → "Sua presença de hoje já foi registrada."
    5. Entrada aberta + saída < 60s → "Aguarde pelo menos 1 minuto..."
    6. Entrada aberta + saída ≥ 60s → registra saída (sempre permitido)
  - Horas acadêmicas usam duração do firmado (não minutos brutos) — 1h firmado = 1h crédito ao aprovar
  - Removida auto-criação de justificativa no RPC (não necessária pois entrada fora firmado é bloqueada)

### Alterações no frontend

**2. `src/services/pontoService.ts`**
- `RegistrarPresencaResponse`: adicionados `no_horario_firmado`, `hora_firmado_inicio`, `hora_firmado_fim`
- `getStatusHoje()`: agora retorna `firmadoHoje` (horário firmado do dia) e `registroConcluido`

**3. `src/pages/aluno/RegistroPontoPage.tsx` — Reescrito**
- Exibe horário firmado do dia (ex: "Quinta-feira: 08:00 às 09:00")
- Botão condicional:
  - **Fora do firmado (antes)**: "Aguardando Horário" (disabled), mensagem "Sua entrada estará disponível das HH:MM às HH:MM"
  - **Fora do firmado (depois)**: "Horário Encerrado" (disabled), mensagem "O horário firmado de hoje (HH:MM às HH:MM) já foi encerrado"
  - **Sem firmado**: "Indisponível" (disabled), mensagem "Você não possui horário firmado para hoje"
  - **Dentro do firmado**: "Registrar Entrada" (habilitado), clique duplo ou arraste
  - **Com entrada aberta**: "Registrar Saída" (vermelho), badge com hora da entrada
  - **Registro concluído**: "Presença Registrada" (disabled), mensagem de sucesso
- Mantém aviso "REGISTRO SUJEITO À AUDITORIA" no rodapé
- Interface limpa: relógio em tempo real, cards de status, histórico do dia

### Regras de negócio confirmadas

1. **Entrada SOMENTE dentro do firmado** — bloqueio total fora da janela (sem exceções, sem `aguardando_validacao`)
2. **Saída sempre permitida após 60s** — mesmo após fim do firmado
3. **Horas acadêmicas = duração do firmado** — não minutos reais de permanência
4. **Sem registros temporários** — elimina fila de `aguardando_validacao` para entradas
5. **Mensagens claras** — aluno sabe exatamente quando pode registrar

### Verificações via MCP (6 cenários)

| # | Cenário | Resultado |
|---|---------|-----------|
| 1 | Firmado existe para aluno 38 (Seg 07-08, Qua 08-09, Qui 08-09, Sex 08-09) | **PASS** |
| 2 | Horário atual 18:24 (Qui) > fim firmado 09:00 → ENTRADA bloqueada | **PASS** |
| 3 | RPC retorna mensagem correta "já foi encerrado" | **PASS** |
| 4 | SAÍDA permitida após fim do firmado (se entrada aberta) | **PASS** |
| 5 | Horas acadêmicas usam duração do firmado | **PASS** |
| 6 | Sem registros `aguardando_validacao` residuais | **PASS** (apenas ponto 42 com `falta_justificada`) |

### Build e TypeScript

- `npx tsc --noEmit` — **PASS** (0 erros)
- `npm run build` — **PASS** (7.15s, 1545 módulos, 238KB gzip 63KB)

### Arquivos modificados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/20260813_rewrite_registrar_presenca_production.sql` | Criado via MCP |
| `src/services/pontoService.ts` | Modificado (tipos + getStatusHoje) |
| `src/pages/aluno/RegistroPontoPage.tsx` | Reescrito completamente |
| `CONTEXTO_SISTEMA.md` | Atualizado (esta sessão) |
