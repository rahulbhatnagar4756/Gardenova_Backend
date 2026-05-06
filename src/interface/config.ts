//Project Config types
export interface Config {
  NODE_ENV: string;
  PORT: number;
  JWT_SECRET: string;
  JWT_EXPIRE: string;
  APPDEV_URL: string;
  AWS_A_K_ID: string;
  AWS_S_A_KEY: string;
  AWS_REGION: string;
  AWS_S3_BUCKET: string;
  EMAIL_USER: string;
  EMAIL_PASS: string;
  EMAIL_FROM: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  POSTGRE_HOST: string;
  POSTGRE_PORT: string;
  POSTGRE_DATABASE: string;
  POSTGRE_USER: string;
  POSTGRE_PASSWORD: string;
  CSC_API_BASE_URL: string;
  CSC_API_KEY: string;
  ADMIN_EMAIL: string;
  KASAGARDEM_PLANTAPI_KEY: string;
  KASAGARDEM_PLANTAPI_URL: string;
  KASAGARDEM_PLANTAPI_KEY_NAME: string;
  FB_APP_ID: string;
  FB_APP_SECRET: string;
}
