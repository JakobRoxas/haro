import { Elysia, t } from "elysia";
import { Html } from "@elysiajs/html";
import { supabase } from "../supabase";
import {
  buildCommentTree,
  CommentItem,
  CommentRow,
  CommentSection,
} from "./commentSection";

const htmlCache = new Map<string, string>();
const rateLimits = new Map<string, number>();
const MAX_CACHE_ENTRIES = 500;
const COOLDOWN_MS = 5000;

function setCache(key: string, value: string) {
  if (htmlCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = htmlCache.keys().next().value;
    if (oldest) htmlCache.delete(oldest);
  }
  htmlCache.set(key, value);
}

export const commentsWidget = new Elysia()
  .get(
    "/comments",
    async ({ query, set }) => {
      const { site, post } = query;
      const cacheKey = `${site}:${post}`;

      set.headers["content-type"] = "text/html; charset=utf-8";

      const cached = htmlCache.get(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase
        .from("comments")
        .select("id, site, post, name, text, parent_id, created_at")
        .eq("site", site)
        .eq("post", post)
        .order("id", { ascending: true });

      if (error) return <p>Error loading comments: {error.message}</p>;

      const tree = buildCommentTree((data as CommentRow[]) || []);
      const rendered = (
        <CommentSection site={site} post={post} comments={tree} />
      ).toString();

      setCache(cacheKey, rendered);
      return rendered;
    },
    {
      query: t.Object({
        site: t.String({ minLength: 1, maxLength: 64 }),
        post: t.String({ minLength: 1, maxLength: 256 }),
      }),
    }
  )

  .post(
    "/comments",
    async ({ query, body, request, server, set }) => {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        server?.requestIP(request)?.address ||
        "unknown";

      const now = Date.now();
      const lastPost = rateLimits.get(ip) || 0;
      if (now - lastPost < COOLDOWN_MS) {
        set.status = 429;
        return <p style="color: red;">Please wait a few seconds before posting again.</p>;
      }
      rateLimits.set(ip, now);

      const { site, post } = query;
      const parentId = body.parent_id ? Number(body.parent_id) : null;

      const { data, error } = await supabase
        .from("comments")
        .insert({
          site,
          post,
          name: body.name.trim(),
          text: body.text.trim(),
          parent_id: parentId,
        })
        .select("id, site, post, name, text, parent_id, created_at")
        .single();

      if (error) return <p>Failed to post comment: {error.message}</p>;

      htmlCache.delete(`${site}:${post}`);

      return (
        <CommentItem
          node={{ ...(data as CommentRow), children: [] }}
          isReply={parentId !== null}
        />
      );
    },
    {
      query: t.Object({
        site: t.String({ minLength: 1, maxLength: 64 }),
        post: t.String({ minLength: 1, maxLength: 256 }),
      }),
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 50 }),
        text: t.String({ minLength: 1, maxLength: 2000 }),
        parent_id: t.Optional(t.String()),
      }),
    }
  );