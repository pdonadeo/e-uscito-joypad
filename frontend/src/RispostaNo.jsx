import React from 'react';

function RispostaNo({dati}) {
  return (
    <div>
    <h1>No. L'ultimo episodio è uscito {dati.giorni_fa}, {dati.data_italiano}.</h1>
    { dati.rompi_le_palle ?
      <h2><em>Mi duole ammetterlo ma è giunto il momento di protestare!</em></h2> :
      <h2><em>Però adesso non torturare Zampa, aspetta ancora qualche giorno…</em></h2>
    }
    </div>
  );
}

export default RispostaNo;
