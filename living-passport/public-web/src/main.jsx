import React from 'react';
import { createRoot } from 'react-dom/client';
import { ccc } from '@ckb-ccc/connector-react';
import App from './App.jsx';
import '../../web/style.css';
import './public.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ccc.Provider name="Living Passport" icon="https://fav.farm/🔧" defaultClient={new ccc.ClientPublicTestnet()} signerFilter={async (signerInfo) => signerInfo.signer.type === ccc.SignerType.CKB}>
      <App />
    </ccc.Provider>
  </React.StrictMode>,
);
