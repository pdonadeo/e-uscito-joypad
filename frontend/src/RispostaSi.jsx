import React from 'react';

function RispostaSi({ dati }) {
  return (
    <h1>
      Sì! È uscito <span title={dati.data_italiano}>{dati.giorni_fa}</span> <u>l'episodio</u> numero
      {dati.ep_num} di Joypad, dal titolo <em>«{dati.titolo}»</em>
    </h1>
  );
}

export default RispostaSi;
