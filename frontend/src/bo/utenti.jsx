import {
  BooleanField,
  BooleanInput,
  Create,
  Datagrid,
  DateField,
  Edit,
  List,
  PasswordInput,
  SearchInput,
  SimpleForm,
  TextField,
  TextInput,
  email,
  minLength,
  required,
} from "react-admin";

export const UtenteList = () => (
  <List filters={[<SearchInput key="q" source="q" alwaysOn placeholder="Cerca" />]} sort={{ field: "username", order: "ASC" }}>
    <Datagrid rowClick="edit">
      <TextField source="username" label="Username" />
      <TextField source="first_name" label="Nome" />
      <TextField source="last_name" label="Cognome" />
      <TextField source="email" label="Email" />
      <BooleanField source="is_staff" label="Staff" />
      <BooleanField source="is_active" label="Attivo" />
      <BooleanField source="is_superuser" label="Superuser" />
      <DateField source="last_login" label="Ultimo accesso" showTime />
    </Datagrid>
  </List>
);

const passwordRules = (isNew) => (isNew ? [required(), minLength(8)] : [minLength(8)]);

const utenteForm = (isNew) => (
  <SimpleForm>
    <TextInput source="username" label="Username" validate={required()} helperText="Lettere, cifre e @ . + - _" />
    <PasswordInput
      source="password"
      label={isNew ? "Password" : "Nuova password"}
      validate={passwordRules(isNew)}
      helperText={isNew ? "Almeno 8 caratteri" : "Lascia vuoto per non cambiarla"}
      autoComplete="new-password"
    />
    <TextInput source="first_name" label="Nome" />
    <TextInput source="last_name" label="Cognome" />
    <TextInput source="email" label="Email" validate={email()} type="email" />
    <BooleanInput source="is_staff" label="Staff (può accedere all'admin)" />
    <BooleanInput source="is_active" label="Attivo" />
    <BooleanInput source="is_superuser" label="Superuser (può gestire gli utenti)" />
  </SimpleForm>
);

export const UtenteEdit = () => (
  <Edit mutationMode="pessimistic">
    {utenteForm(false)}
  </Edit>
);

export const UtenteCreate = () => (
  <Create record={{ is_staff: true, is_active: true, is_superuser: false }}>
    {utenteForm(true)}
  </Create>
);
