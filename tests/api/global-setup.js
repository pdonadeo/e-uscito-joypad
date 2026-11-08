// Crea gli utenti di test con Django (così gli hash sono quelli veri di Django)
// e prepara una MEDIA_ROOT vuota.
const fs = require('fs');
const { MEDIA_ROOT, USERS, django } = require('./env');
const cleanup = require('./global-teardown');

const py = (b) => (b ? 'True' : 'False');

module.exports = async () => {
  await cleanup();
  fs.rmSync(MEDIA_ROOT, { recursive: true, force: true });
  fs.mkdirSync(MEDIA_ROOT, { recursive: true });
  const spec = [
    // utente, is_active, is_staff, is_superuser
    [USERS.staff, true, true, false],
    [USERS.superuser, true, true, true],
    [USERS.inactive, false, true, false],
    [USERS.nonstaff, true, false, false],
  ];
  const code = spec
    .map(
      ([u, active, staff, superuser]) => `
u, _ = User.objects.get_or_create(username=${JSON.stringify(u.username)})
u.set_password(${JSON.stringify(u.password)})
u.is_active = ${py(active)}
u.is_staff = ${py(staff)}
u.is_superuser = ${py(superuser)}
u.save()`,
    )
    .join('\n');
  django(`from django.contrib.auth.models import User\n${code}\n`);
};
