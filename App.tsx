import React from 'react';
import Layout from './components/Layout';
import LiveSession from './components/LiveSession';

const App: React.FC = () => {
  return (
    <Layout>
      <LiveSession />
    </Layout>
  );
};

export default App;