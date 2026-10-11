// Runs before any test module import. Must set env before config/env.ts is loaded.
process.env.NODE_ENV = "test";
process.env.USE_MEMORY_DB = "true";
process.env.JWT_SECRET = "test_secret_do_not_use_in_production_0000000000";
process.env.AI_PROVIDER = "heuristic";
process.env.RATE_LIMIT_MAX = "100000";
process.env.AUTH_RATE_LIMIT_MAX = "100000";
process.env.AI_RATE_LIMIT_MAX = "100000";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
