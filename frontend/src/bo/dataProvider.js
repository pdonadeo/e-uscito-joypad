// dataProvider: ra-data-simple-rest su /api/bo, più l'upload della cover degli
// episodi, che passa da un endpoint multipart dedicato e non dal JSON.
import { fetchUtils } from "react-admin";
import simpleRestProvider from "ra-data-simple-rest";

const API = "/api/bo";

const httpClient = (url, options = {}) => fetchUtils.fetchJson(url, { credentials: "same-origin", ...options });

const base = simpleRestProvider(API, httpClient);

// La cover in lettura diventa il valore di ImageInput ({src, title}); in
// scrittura i campi della cover non vanno nel JSON dell'episodio.
const coverInput = (record) => ({
  ...record,
  cover_input: record.cover_url ? { src: record.cover_url, title: record.cover } : null,
});

const withoutCover = (data) => {
  const rest = { ...data };
  delete rest.cover_input;
  delete rest.cover;
  delete rest.cover_url;
  return rest;
};

async function uploadCover(id, file) {
  const body = new FormData();
  body.append("file", file);
  // niente Content-Type: lo imposta il browser con il boundary del multipart
  const { json } = await httpClient(`${API}/episodi/${id}/cover`, { method: "POST", body });
  return json;
}

async function deleteCover(id) {
  const { json } = await httpClient(`${API}/episodi/${id}/cover`, { method: "DELETE" });
  return json;
}

// Dopo il salvataggio del JSON: carica la nuova cover o cancella quella vecchia.
async function syncCover(record, cover, hadCover) {
  if (cover?.rawFile instanceof File) return uploadCover(record.id, cover.rawFile);
  if (!cover && hadCover) return deleteCover(record.id);
  return record;
}

const dataProvider = {
  ...base,

  async getOne(resource, params) {
    const res = await base.getOne(resource, params);
    return resource === "episodi" ? { data: coverInput(res.data) } : res;
  },

  async create(resource, params) {
    if (resource !== "episodi") return base.create(resource, params);
    const res = await base.create(resource, { ...params, data: withoutCover(params.data) });
    try {
      const saved = await syncCover(res.data, params.data.cover_input, false);
      return { data: coverInput(saved) };
    } catch (err) {
      // Create + cover devono essere atomici: se l'upload fallisce (PNG non
      // valido, troppo grande) l'utente resta sul form e ripremerebbe Salva,
      // creando un duplicato, magari già pubblicato. Si annulla il create.
      await base.delete(resource, { id: res.data.id, previousData: res.data }).catch(() => {});
      throw err;
    }
  },

  async update(resource, params) {
    if (resource === "videogame") {
      // rawg_json è in sola lettura: il server conserva quello salvato
      const data = { ...params.data };
      delete data.rawg_json;
      return base.update(resource, { ...params, data });
    }
    if (resource !== "episodi") return base.update(resource, params);
    const res = await base.update(resource, { ...params, data: withoutCover(params.data) });
    const saved = await syncCover(res.data, params.data.cover_input, Boolean(params.previousData?.cover));
    return { data: coverInput(saved) };
  },
};

export default dataProvider;
