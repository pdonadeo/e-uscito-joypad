import { Admin, Resource } from "react-admin";
import { QueryClient } from "@tanstack/react-query";
import authProvider from "./authProvider";
import dataProvider from "./dataProvider";
import i18nProvider from "./i18n";
import { EpisodioCreate, EpisodioEdit, EpisodioList } from "./episodi";
import { VideogameCreate, VideogameEdit, VideogameList } from "./videogame";
import { UtenteCreate, UtenteEdit, UtenteList } from "./utenti";

const TITLE = "Retrobottega di «È uscito Joypad?»";

// Gli errori 4xx (sessione scaduta, permessi, validazione) non si risolvono
// ritentando: senza questo react-query riprova 3 volte con backoff e l'utente
// aspetta ~7 s prima di vedere l'errore o tornare al login.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failures, error) => !(error?.status >= 400 && error?.status < 500) && failures < 3,
    },
  },
});

// react-admin usa di default l'HashRouter (/bo#/episodi): Dream serve solo /bo,
// senza fallback SPA.
const App = () => (
  <Admin
    title={TITLE}
    queryClient={queryClient}
    dataProvider={dataProvider}
    authProvider={authProvider}
    i18nProvider={i18nProvider}
    requireAuth
    disableTelemetry
  >
    {(permissions) => [
      <Resource
        key="episodi"
        name="episodi"
        list={EpisodioList}
        edit={EpisodioEdit}
        create={EpisodioCreate}
        recordRepresentation="titolo"
      />,
      <Resource
        key="videogame"
        name="videogame"
        list={VideogameList}
        edit={VideogameEdit}
        create={VideogameCreate}
        recordRepresentation="titolo"
      />,
      // letta da ReferenceManyField nel dettaglio dei videogame
      <Resource key="associazioni" name="associazioni" />,
      permissions?.is_superuser ? (
        <Resource
          key="utenti"
          name="utenti"
          list={UtenteList}
          edit={UtenteEdit}
          create={UtenteCreate}
          recordRepresentation="username"
        />
      ) : null,
    ]}
  </Admin>
);

export default App;
