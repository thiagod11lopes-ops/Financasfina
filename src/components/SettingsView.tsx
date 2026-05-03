import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadDashboardTabs,
  notifyDashboardTabsSync,
  removeMonthFromDashboardTabs,
  resetDashboardTabsToCurrentMonth,
} from "../dashboardTabs";
import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../firebase/AuthProvider";
import { useUserDocCloud } from "../firebase/userDocCloud";
import { countMonthEntries, formatMonthLabelPt, monthKey } from "../utils/format";
import { MonthYearPickerModal } from "./MonthYearPickerModal";
import {
  USERS_ALL_OPTION,
  USERS_SYNC_EVENT,
  USER_COLOR_PRESETS,
  addUserWithColor,
  getTodosMergedBackground,
  loadUserRecords,
  notifyUsersSync,
  removeUserName,
  setUserColor,
  type UserRecord,
} from "../users";

const DEFAULT_NEW_COLOR = USER_COLOR_PRESETS[0]!;

export function SettingsView({ visible = true }: { visible?: boolean }) {
  const { state, deleteMonthData, resetAllData } = useFinance();
  const { configured: fbOk, ready: authReady, user: fbUser, signInWithGoogle, signOutUser, lastError } = useAuth();
  const cloud = useUserDocCloud();
  const [deletePickerOpen, setDeletePickerOpen] = useState(false);
  const [wipeStep, setWipeStep] = useState<0 | 1>(0);
  const [userRecords, setUserRecords] = useState<UserRecord[]>(() => loadUserRecords());
  const [newUser, setNewUser] = useState("");
  const [newUserColor, setNewUserColor] = useState<string>(DEFAULT_NEW_COLOR);

  const tabsForPicker = useMemo(() => loadDashboardTabs().tabs, [state, deletePickerOpen]);

  const todosMergedBg = useMemo(() => getTodosMergedBackground(), [userRecords]);

  const getMonthEntryCount = useCallback((ym: string) => countMonthEntries(state, ym), [state]);

  useEffect(() => {
    const sync = () => setUserRecords(loadUserRecords());
    window.addEventListener(USERS_SYNC_EVENT, sync);
    return () => window.removeEventListener(USERS_SYNC_EVENT, sync);
  }, []);

  useEffect(() => {
    if (visible) return;
    setDeletePickerOpen(false);
    setWipeStep(0);
  }, [visible]);

  const handleDeleteMonthConfirm = useCallback(
    (ym: string) => {
      const c = countMonthEntries(state, ym);
      if (c === 0) return;
      if (
        !window.confirm(
          `Excluir ${c} lançamento(s) de ${formatMonthLabelPt(ym)}? Esta ação não pode ser desfeita.`,
        )
      ) {
        return;
      }
      deleteMonthData(ym);
      removeMonthFromDashboardTabs(ym);
      notifyDashboardTabsSync();
      cloud.scheduleDashboardTabsPush(loadDashboardTabs());
      setDeletePickerOpen(false);
    },
    [state, deleteMonthData, cloud],
  );

  const handleWipeAll = useCallback(() => {
    resetAllData();
    resetDashboardTabsToCurrentMonth();
    notifyDashboardTabsSync();
    cloud.scheduleDashboardTabsPush(loadDashboardTabs());
    setWipeStep(0);
  }, [resetAllData, cloud]);

  const handleAddUser = useCallback(() => {
    const v = newUser.trim();
    if (!v) return;
    addUserWithColor(v, newUserColor);
    setUserRecords(loadUserRecords());
    setNewUser("");
    setNewUserColor(DEFAULT_NEW_COLOR);
    notifyUsersSync();
    cloud.scheduleUsersPush(loadUserRecords());
  }, [newUser, newUserColor, cloud]);

  const handleRemoveUser = useCallback((name: string) => {
    removeUserName(name);
    setUserRecords(loadUserRecords());
    notifyUsersSync();
    cloud.scheduleUsersPush(loadUserRecords());
  }, [cloud]);

  const handleColorChange = useCallback((name: string, hex: string) => {
    setUserColor(name, hex);
    setUserRecords(loadUserRecords());
    notifyUsersSync();
    cloud.scheduleUsersPush(loadUserRecords());
  }, [cloud]);

  return (
    <>
      <div className="card card-glow settings-card">
        <span className="badge">Ajustes</span>
        <h3 className="settings-section-title">Sincronização (Firebase)</h3>
        {!fbOk ? (
          <p className="settings-muted">
            Para guardar fluxo, contas e mercado na nuvem, crie um projeto no{" "}
            <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer">
              Firebase Console
            </a>
            , ative <strong>Authentication → Google</strong> e <strong>Firestore</strong>, copie as chaves web
            para um ficheiro <code className="settings-inline-code">.env</code> (veja <code className="settings-inline-code">.env.example</code> na raiz do projeto) e volte a executar <code className="settings-inline-code">npm run dev</code> ou o build.
          </p>
        ) : !authReady ? (
          <p className="settings-muted">A carregar sessão…</p>
        ) : fbUser ? (
          <div className="settings-firebase-row">
            <p className="settings-muted">
              Conta: <strong>{fbUser.email ?? fbUser.displayName ?? fbUser.uid}</strong>. Finanças, resumo, agenda e
              utilizadores sincronizam no Firestore; ao sair, guarda-se uma cópia local para usar sem login.
            </p>
            <button type="button" className="settings-btn settings-btn--outline" onClick={() => void signOutUser()}>
              Sair da conta Google
            </button>
          </div>
        ) : (
          <div className="settings-firebase-row">
            <p className="settings-muted">
              Entre com a mesma conta Google em vários dispositivos para sincronizar finanças, abas do resumo, agenda
              familiar e lista de utilizadores responsáveis (última alteração na nuvem prevalece).
            </p>
            <button type="button" className="settings-btn settings-btn--primary" onClick={() => void signInWithGoogle()}>
              Entrar com Google
            </button>
          </div>
        )}
        {lastError ? <p className="settings-firebase-error">{lastError}</p> : null}

        <h3 className="settings-section-title">Usuários responsáveis</h3>
        <p className="settings-muted">
          Cadastre nomes e uma cor para cada um (visível nos cartões da aba <strong>Rotina</strong> na agenda). A opção{" "}
          <strong>Todos</strong> mostra uma cor que junta as cores de todos os utilizadores (atualiza-se automaticamente).
        </p>
        <div className="settings-users-add-block">
          <div className="settings-users-row">
            <input
              className="input"
              value={newUser}
              onChange={(e) => setNewUser(e.target.value)}
              placeholder="Nome do usuário"
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddUser();
                }
              }}
            />
            <label className="settings-user-color-field">
              <span className="visually-hidden">Cor do novo usuário</span>
              <input
                type="color"
                className="settings-user-color-input"
                value={newUserColor}
                onChange={(e) => setNewUserColor(e.target.value)}
                aria-label="Cor do novo usuário"
              />
            </label>
            <button type="button" className="settings-btn settings-btn--outline settings-users-add" onClick={handleAddUser}>
              Adicionar
            </button>
          </div>
          <div className="settings-user-swatches" role="group" aria-label="Cores sugeridas">
            {USER_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className={`settings-user-swatch-btn${newUserColor.toLowerCase() === c ? " is-active" : ""}`}
                style={{ background: c }}
                title={c}
                aria-label={`Usar cor ${c}`}
                onClick={() => setNewUserColor(c)}
              />
            ))}
          </div>
        </div>
        <div className="settings-users-list" aria-label="Usuários cadastrados">
          {userRecords.map((rec) => (
            <div key={rec.name} className="settings-user-chip">
              {rec.name === USERS_ALL_OPTION ? (
                <span
                  className="settings-user-chip__dot settings-user-chip__dot--merged"
                  style={{ background: todosMergedBg }}
                  title="Combinação das cores de todos os utilizadores"
                  aria-hidden
                />
              ) : rec.color ? (
                <span className="settings-user-chip__dot" style={{ background: rec.color }} aria-hidden />
              ) : null}
              <span className="settings-user-chip__name">{rec.name}</span>
              {rec.name !== USERS_ALL_OPTION ? (
                <>
                  <label className="settings-user-chip__color-label">
                    <span className="visually-hidden">Cor de {rec.name}</span>
                    <input
                      type="color"
                      className="settings-user-chip__color"
                      value={rec.color ?? DEFAULT_NEW_COLOR}
                      onChange={(e) => handleColorChange(rec.name, e.target.value)}
                      aria-label={`Cor de ${rec.name}`}
                    />
                  </label>
                  <button
                    type="button"
                    className="settings-user-chip__remove"
                    onClick={() => handleRemoveUser(rec.name)}
                    aria-label={`Remover ${rec.name}`}
                  >
                    ✕
                  </button>
                </>
              ) : null}
            </div>
          ))}
        </div>

        <h3 className="settings-section-title">Dados por mês</h3>
        <p className="settings-muted">
          Abra o calendário, escolha um mês que tenha lançamentos e confirme para apagar só aquele período (fluxo,
          mercado, combustível e gastos variáveis).
        </p>
        <button type="button" className="settings-btn settings-btn--outline" onClick={() => setDeletePickerOpen(true)}>
          Excluir dados de um mês…
        </button>
      </div>

      <div className="card settings-card settings-danger-card">
        <h3 className="settings-section-title settings-danger-title">Zona de perigo</h3>
        <p className="settings-muted">
          Excluir tudo apaga permanentemente fluxo de caixa, contas fixas, contas variáveis (e seus gastos),
          supermercado, combustível e entradas futuras. As abas do resumo voltam só ao mês atual.
        </p>
        {wipeStep === 0 ? (
          <button type="button" className="settings-btn settings-btn--danger-ghost" onClick={() => setWipeStep(1)}>
            Excluir todos os dados…
          </button>
        ) : (
          <div className="settings-wipe-confirm">
            <p className="settings-wipe-warn">Tem certeza? Não há como recuperar.</p>
            <div className="settings-wipe-actions">
              <button type="button" className="settings-btn settings-btn--outline" onClick={() => setWipeStep(0)}>
                Cancelar
              </button>
              <button type="button" className="settings-btn settings-btn--danger" onClick={handleWipeAll}>
                Excluir tudo agora
              </button>
            </div>
          </div>
        )}
      </div>

      <MonthYearPickerModal
        open={deletePickerOpen}
        initialYm={monthKey(new Date())}
        existingTabs={tabsForPicker}
        mode="delete"
        getMonthEntryCount={getMonthEntryCount}
        onClose={() => setDeletePickerOpen(false)}
        onConfirm={handleDeleteMonthConfirm}
      />
    </>
  );
}
