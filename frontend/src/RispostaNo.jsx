import React from 'react';

function RispostaNo({dati}) {
  return (
    <h1>No. L'ultimo episodio è uscito {dati.giorni_fa}, {dati.data_italiano}.</h1>
  );
}

export default RispostaNo;
