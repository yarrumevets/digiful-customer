import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Shared env file
const sharedPath = path.resolve(__dirname, "../.env");
// App-specific env file
const appPath = path.resolve(__dirname, ".env");
dotenv.config({ path: sharedPath });
dotenv.config({ path: appPath });
