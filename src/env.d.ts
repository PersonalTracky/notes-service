declare namespace NodeJS {
  interface ProcessEnv {
    DB_URL: string;
    PORT: string;
    REDIS_URL: string;
    CORS_ORIGIN: string;
    REDIS_PREFIX: string;
    CORS_ORIGIN_USER_SERVICE: string;
  }
}