
import React, { useState } from 'react';
import Layout from './components/Layout';
import LiveSession from './components/LiveSession';
import { ModelID } from './types';

const App: React.FC = () => {
  const [activeModel, setActiveModel] = useState<ModelID>('gemini-2.5-flash');

  return (
    <Layout activeModel={activeModel} onModelChange={setActiveModel}>
      <LiveSession activeModelId={activeModel} />
    </Layout>
  );
};

export default App;
