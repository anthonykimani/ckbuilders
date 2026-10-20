import React from 'react';
import { createRoot } from 'react-dom/client';
import { ccc } from '@ckb-ccc/connector-react';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import App from './App.jsx';
import './public.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ccc.Provider name="Living Passport" icon={`${location.origin}${location.pathname.replace(/[^/]*$/, '')}icon.svg`} defaultClient={new ccc.ClientPublicTestnet()} signerFilter={async (signerInfo) => signerInfo.signer.type === ccc.SignerType.CKB}>
      <App />
    </ccc.Provider>
  </React.StrictMode>,
);
