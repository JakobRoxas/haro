import { Html } from "@elysiajs/html";

export type CommentRow = {
  id: number;
  site: string;
  post: string;
  name: string;
  text: string;
  parent_id: number | null;
  created_at: string;
};

export type CommentNode = CommentRow & {
  children: CommentNode[];
};

// Build a tree from comments table
export function buildCommentTree(rows: CommentRow[]): CommentNode[] {
  const map = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];

  for (const row of rows) {
    const node: CommentNode = { ...row, children: [] };
    map.set(row.id, node);

    if (row.parent_id === null) {
      roots.push(node);
    } else {
      map.get(row.parent_id)?.children.push(node);
    }
  }

  return roots;
}

// THIS IS EACH COMMENT ITEM, INCLUDING REPLIES
export const CommentItem = ({
  node,
  isReply = false,
}: {
  node: CommentNode;
  isReply?: boolean;
}) => {
  const replyCount = node.children.length;
  const dateLabel = node.created_at
    ? new Date(node.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div class={isReply ? "reply-item" : "comment-thread-card"}>
      <div class="comment-main">
        <div class="comment-header">
          <strong class="comment-author">{node.name}</strong>
          {dateLabel && <span class="comment-date">{dateLabel}</span>}
        </div>

        <div role="tooltip" class="comment-tooltip">
          {node.text}
        </div>

        <div class="comment-footer">
          {replyCount > 0 && (
            <button
              type="button"
              id={`replies-btn-${node.id}`}
              class="replies-toggle-btn"
              onclick={`
                const fold = document.getElementById('replies-fold-${node.id}');
                if (fold) fold.open = !fold.open;
              `}
            >
              {replyCount} {replyCount === 1 ? "reply" : "replies"}
            </button>
          )}

          <button
            type="button"
            class="action-btn"
            onclick={`
              const box = document.getElementById('reply-box-${node.id}');
              if (box) box.hidden = !box.hidden;
            `}
          >
            Reply
          </button>
        </div>

        {/* Hidden inline reply box */}
        <div id={`reply-box-${node.id}`} class="reply-form-box" hidden>
          <form
            hx-post={`/api/comments?site=${node.site}&post=${node.post}`}
            hx-target={`#replies-${node.id}`}
            hx-swap="beforeend"
            hx-on--after-request={`
              this.reset();
              document.getElementById('reply-box-${node.id}').hidden = true;
              const fold = document.getElementById('replies-fold-${node.id}');
              const list = document.getElementById('replies-${node.id}');
              let btn = document.getElementById('replies-btn-${node.id}');
              if (fold) { fold.hidden = false; fold.open = true; }
              if (list) {
                const count = list.children.length;
                if (!btn) {
                  btn = document.createElement('button');
                  btn.type = 'button';
                  btn.id = 'replies-btn-${node.id}';
                  btn.className = 'replies-toggle-btn';
                  btn.onclick = () => {
                    fold.open = !fold.open;
                  };
                  this.closest('.comment-main').querySelector('.comment-footer').prepend(btn);
                }
                btn.textContent = count + (count === 1 ? ' reply' : ' replies');
              }
            `}
          >
            <input type="hidden" name="parent_id" value={String(node.id)} />
            <div class="field-row-stacked">
              <label for={`name-${node.id}`}>Name</label>
              <input
                id={`name-${node.id}`}
                type="text"
                name="name"
                maxlength="50"
                required
              />
            </div>
            <div class="field-row-stacked">
              <label for={`text-${node.id}`}>Reply</label>
              <textarea
                id={`text-${node.id}`}
                name="text"
                rows="2"
                maxlength="2000"
                required
              ></textarea>
            </div>
            <div class="form-actions">
              <button
                type="button"
                onclick={`document.getElementById('reply-box-${node.id}').hidden = true;`}
              >
                Cancel
              </button>
              <button type="submit">
                Post Reply
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Folded replies drawer with vertical guide line */}
      <details
        id={`replies-fold-${node.id}`}
        class="replies-fold"
        hidden={replyCount === 0}
      >
        <summary style="display: none;"></summary>
        <div id={`replies-${node.id}`} class="replies-section">
          {node.children.map((child) => (
            <CommentItem node={child} isReply={true} />
          ))}
        </div>
      </details>
    </div>
  );
};

// The entire comment section, including the list of comments and the composer box
export const CommentSection = ({
  site,
  post,
  comments,
}: {
  site: string;
  post: string;
  comments: CommentNode[];
}) => {
  const commentCount = comments.length;

  return (
    <html>
      <head>
        <link rel="stylesheet" href="https://unpkg.com/7.css" />
        <link rel="stylesheet" href="/css/comments.css" />
        <script src="https://unpkg.com/htmx.org@2.0.4" defer></script>
      </head>
      <body>
        <div class="stats-bar">
          <strong id="total-comments-count" data-count={String(commentCount)}>
            {commentCount} {commentCount === 1 ? "comment" : "comments"}
          </strong>
        </div>

        {/* Comments list */}
        <div id="comment-list" class="comments-list">
          {commentCount === 0 ? (
            <div id="empty-comments" class="empty-state">
              No comments yet. Leave one below!
            </div>
          ) : (
            comments.map((node) => <CommentItem node={node} />)
          )}
        </div>

        {/* Bottom composer box */}
        <form
          class="composer-box"
          hx-post={`/api/comments?site=${site}&post=${post}`}
          hx-target="#comment-list"
          hx-swap="beforeend"
          hx-on--after-request={`
            this.reset();
            const empty = document.getElementById('empty-comments');
            if (empty) empty.remove();
            const totalCommentsEl = document.getElementById('total-comments-count');
            if (totalCommentsEl) {
              const next = Number(totalCommentsEl.dataset.count || 0) + 1;
              totalCommentsEl.dataset.count = String(next);
              totalCommentsEl.textContent = next + (next === 1 ? ' comment' : ' comments');
            }
          `}
        >
          <div class="composer-header">
            <span class="composer-tab">Leave a Comment !!</span>
          </div>

          <div class="composer-body">
            <div class="field-row-stacked">
              <label for="commenter-name">Name</label>
              <input
                id="commenter-name"
                type="text"
                name="name"
                placeholder="Your name"
                maxlength="50"
                required
              />
            </div>

            <div class="field-row-stacked" style="margin-top: 8px;">
              <label for="commenter-text">Comment</label>
              <textarea
                id="commenter-text"
                name="text"
                rows="3"
                placeholder="Write a comment..."
                maxlength="2000"
                required
              ></textarea>
            </div>

            <div class="form-actions">
              <button type="submit">
                Post Comment
              </button>
            </div>
          </div>
        </form>

        <script>{`
          const notifyHeight = () => {
            window.parent.postMessage(
              { type: "haro-resize", height: document.body.offsetHeight + 12 },
              "*"
            );
          };
          window.addEventListener("load", notifyHeight);
          new ResizeObserver(notifyHeight).observe(document.body);
        `}</script>
      </body>
    </html>
  );
};