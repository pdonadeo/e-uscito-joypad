import {
  Create,
  Datagrid,
  DateField,
  Edit,
  FunctionField,
  ImageField,
  Labeled,
  List,
  Pagination,
  ReferenceManyField,
  SearchInput,
  SimpleForm,
  TextField,
  TextInput,
  required,
  regex,
  useRecordContext,
} from "react-admin";
import { TIPOLOGIA_CHOICES, detailOptions } from "./choices";

const slugFormat = regex(/^[A-Za-z0-9_-]+$/, "Solo lettere, cifre, «-» e «_»");
const autoFill = "NON COMPILARE MANUALMENTE: viene preso da RAWG";

export const VideogameList = () => (
  <List filters={[<SearchInput key="q" source="q" alwaysOn placeholder="Cerca" />]} sort={{ field: "titolo", order: "ASC" }}>
    <Datagrid rowClick="edit">
      <ImageField source="cover" label="Cover" sortable={false} sx={{ "& img": { maxWidth: 60, maxHeight: 40 } }} />
      <TextField source="titolo" label="Titolo" />
      <TextField source="rawg_slug" label="RAWG slug" />
    </Datagrid>
  </List>
);

// rawg_json in sola lettura, come il JSONEditorWidget in modalità "view" di Django
const RawgJson = () => {
  const record = useRecordContext();
  if (!record?.rawg_json) return null;
  return (
    <Labeled label="RAWG JSON data" fullWidth>
      <pre
        style={{ maxHeight: 400, overflow: "auto", fontSize: 12, background: "rgba(0,0,0,0.04)", padding: 8 }}
        data-testid="rawg-json"
      >
        {JSON.stringify(record.rawg_json, null, 2)}
      </pre>
    </Labeled>
  );
};

const tipologia = Object.fromEntries(TIPOLOGIA_CHOICES.map((c) => [c.id, c.name]));

// Episodi in cui il gioco è citato: le associazioni si modificano dall'episodio.
const Citazioni = () => (
  <Labeled label="Citato negli episodi" fullWidth>
    <ReferenceManyField
      reference="associazioni"
      target="videogame_id"
      sort={{ field: "data_uscita", order: "DESC" }}
      pagination={<Pagination />}
    >
      <Datagrid bulkActionButtons={false} rowClick={(_id, _res, r) => `/episodi/${r.episodio_id}`}>
        <TextField source="episodio_numero" label="Numero" />
        <TextField source="episodio_titolo" label="Episodio" />
        <DateField source="data_uscita" label="Data uscita" />
        <TextField source="istante" label="Istante" />
        <FunctionField label="Tipologia" render={(r) => tipologia[r.tipologia] ?? r.tipologia} />
      </Datagrid>
    </ReferenceManyField>
  </Labeled>
);

const fields = (
  <>
    <TextInput source="rawg_slug" label="RAWG slug" validate={[required(), slugFormat]} fullWidth />
    <TextInput source="titolo" label="Titolo" helperText={autoFill} fullWidth />
    <TextInput source="descrizione_raw" label="Descrizione (TXT)" helperText={autoFill} multiline fullWidth />
    <TextInput source="descrizione_html" label="Descrizione (HTML)" helperText={autoFill} multiline fullWidth />
    <TextInput source="cover" label="Cover" helperText={autoFill} type="url" fullWidth />
  </>
);

export const VideogameEdit = () => (
  <Edit mutationMode="pessimistic" {...detailOptions}>
    <SimpleForm>
      {fields}
      <RawgJson />
      <Citazioni />
    </SimpleForm>
  </Edit>
);

export const VideogameCreate = () => (
  <Create redirect="edit">
    <SimpleForm>{fields}</SimpleForm>
  </Create>
);
