import process from 'process';

try {
  process.loadEnvFile();
} catch (e) {
  // Ignore if .env doesn't exist
}

import app from './app';
import { env } from './config/environment';


const startServer = () => {
  try {
    const port = env.APP_PORT;
    
    app.listen(port, () => {
      console.log(`🚀 Server is running on port ${port} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

startServer();
