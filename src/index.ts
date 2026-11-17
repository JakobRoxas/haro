import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { html } from "@elysiajs/html";
import { commentsWidget } from "./widgets/comments";

const app = new Elysia()
  .use(cors())
  .use(html())
  .get("/css/comments.css", () => Bun.file("src/css/comments.css"))
  .get("/assets/fonts/DigitalDisco.ttf", () =>
    Bun.file("src/assets/fonts/DigitalDisco.ttf")
  )
  .group("/api", (app) => app.use(commentsWidget))
  .listen(3000);

console.log(`Haro running at http://localhost:${app.server?.port}`);
