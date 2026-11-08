import {
  ArrayInput,
  AutocompleteInput,
  BooleanField,
  BooleanInput,
  Create,
  Datagrid,
  DateField,
  DateInput,
  Edit,
  FunctionField,
  ImageField,
  ImageInput,
  List,
  NullableBooleanInput,
  ReferenceInput,
  SearchInput,
  SelectInput,
  SimpleForm,
  SimpleFormIterator,
  TextField,
  TextInput,
  required,
  regex,
} from "react-admin";
import { SPEAKER_CHOICES, TIPOLOGIA_CHOICES, detailOptions } from "./choices";

// Stesso formato accettato dall'API: H:MM:SS (ore fino a 4 cifre)
const durationFormat = regex(/^\d{1,4}:[0-5]\d:[0-5]\d$/, "Formato H:MM:SS, es. 1:23:45");

const filters = [
  <SearchInput key="q" source="q" alwaysOn placeholder="Cerca per numero o titolo" />,
  <NullableBooleanInput key="pubblicato" source="pubblicato" label="Pubblicato" />,
];

const present = (source, label) => (
  <FunctionField
    label={label}
    sortable={false}
    render={(r) => <BooleanField record={{ v: Boolean(r[source]) }} source="v" />}
  />
);

export const EpisodioList = () => (
  <List filters={filters} perPage={20} sort={{ field: "data_uscita", order: "DESC" }}>
    <Datagrid rowClick="edit">
      <TextField source="episodio_numero" label="Numero" />
      <TextField source="titolo" label="Titolo" />
      <DateField source="data_uscita" label="Data uscita" />
      <TextField source="durata" label="Durata" />
      {present("cover", "Cover")}
      {present("url", "URL audio")}
      {present("url_post", "URL post")}
      {present("url_video", "URL video")}
      <BooleanField source="pubblicato" label="Pubblicato" />
    </Datagrid>
  </List>
);

const videogameFilter = (q) => ({ q });

const EpisodioForm = () => (
  <SimpleForm>
    <TextInput source="titolo" label="Titolo" validate={required()} fullWidth />
    <TextInput source="episodio_numero" label="Numero" />
    <DateInput source="data_uscita" label="Data uscita" validate={required()} />
    <TextInput source="durata" label="Durata" validate={[required(), durationFormat]} helperText="H:MM:SS" />
    <BooleanInput source="pubblicato" label="Pubblicato" />
    <ImageInput
      source="cover_input"
      label="Cover"
      accept={{ "image/png": [".png"] }}
      maxSize={10 * 1024 * 1024}
      placeholder={<p>Trascina qui un&apos;immagine PNG o fai clic per sceglierla</p>}
    >
      <ImageField source="src" title="title" />
    </ImageInput>
    <TextInput source="url" label="URL dell'episodio in formato audio" type="url" fullWidth />
    <TextInput source="url_post" label="URL del post che annuncia l'episodio" type="url" fullWidth />
    <TextInput source="url_video" label="URL video" type="url" fullWidth />
    <TextInput source="descrizione_html" label="Descrizione (HTML)" multiline fullWidth />
    <TextInput source="descrizione_txt" label="Descrizione (TXT)" multiline fullWidth />
    <TextInput source="note" label="Note libere" multiline fullWidth />
    <ArrayInput source="associazioni" label="Videogiochi citati">
      <SimpleFormIterator inline>
        <ReferenceInput source="videogame_id" reference="videogame" sort={{ field: "titolo", order: "ASC" }}>
          <AutocompleteInput
            label="Videogame"
            optionText="titolo"
            filterToQuery={videogameFilter}
            validate={required()}
            sx={{ minWidth: 320 }}
          />
        </ReferenceInput>
        <TextInput source="istante" label="Istante" defaultValue="0:00:00" validate={durationFormat} />
        <SelectInput source="speaker" label="Speaker" choices={SPEAKER_CHOICES} defaultValue="TUTT" />
        <SelectInput source="tipologia" label="Tipologia" choices={TIPOLOGIA_CHOICES} defaultValue="FREE" />
      </SimpleFormIterator>
    </ArrayInput>
  </SimpleForm>
);

export const EpisodioEdit = () => (
  <Edit mutationMode="pessimistic" {...detailOptions}>
    <EpisodioForm />
  </Edit>
);

export const EpisodioCreate = () => (
  <Create redirect="edit" record={{ durata: "0:30:00", pubblicato: false, associazioni: [] }}>
    <EpisodioForm />
  </Create>
);
