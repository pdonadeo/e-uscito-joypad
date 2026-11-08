// authProvider di react-admin sulle sessioni Dream (/api/bo/login, logout, me).
// Il cookie di sessione è HttpOnly e same-origin: fetch lo invia da sola.

const API = "/api/bo";

let identity = null; // promise di /api/bo/me, azzerata a login e logout

async function request(path, options = {}) {
  const res = await fetch(API + path, {
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    ...options,
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

// Le richieste concorrenti a /me (checkAuth, getIdentity, getPermissions)
// condividono la stessa promise.
function me() {
  if (!identity) {
    const pending = request("/me").then(({ status, body }) => {
      if (status === 200) return body;
      if (identity === pending) identity = null;
      // message: false → react-admin va al login senza notifica d'errore
      throw { message: false, status };
    });
    // anche un errore di rete non deve restare in cache
    pending.catch(() => {
      if (identity === pending) identity = null;
    });
    identity = pending;
  }
  return identity;
}

const authProvider = {
  async login({ username, password }) {
    identity = null;
    const { status, body } = await request("/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (status !== 200) {
      // 401 credenziali, 429 troppi login in corso: il messaggio arriva dal server
      throw new Error(body?.message || `Errore ${status}`);
    }
    identity = Promise.resolve(body);
  },

  async logout() {
    identity = null;
    await request("/logout", { method: "POST" }).catch(() => {});
  },

  async checkAuth() {
    await me();
  },

  // 401: sessione assente o scaduta → login. 403 (es. staff su Utenti) non
  // deve chiudere la sessione: l'errore compare come notifica.
  async checkError(error) {
    if (error?.status === 401) {
      identity = null;
      throw error;
    }
  },

  async getIdentity() {
    const u = await me();
    return { id: u.id, fullName: u.fullName };
  },

  // Senza sessione non rifiuta: react-query ritenterebbe più volte con backoff
  // tenendo la pagina su «Caricamento». Dopo il login react-admin la rilegge.
  async getPermissions() {
    try {
      const u = await me();
      return { is_superuser: u.is_superuser === true };
    } catch {
      return { is_superuser: false };
    }
  },
};

export default authProvider;
