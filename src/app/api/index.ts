import { Hono } from "hono";
import contactsAPI from "./contacts/route"; // ✅ Import contacts API
import dbAPI from "./db/route"; // ✅ Import DB initialization
import uploadAPI from "./upload/route"; // ✅ Import File Upload API

const app = new Hono();

app.route("/contacts", contactsAPI); // ✅ Attach `/api/contacts`
app.route("/db", dbAPI); // ✅ Attach `/api/db`
app.route("/upload", uploadAPI); // ✅ Attach `/api/upload`

export default app;
