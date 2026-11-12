import { useId, useState, type FormEvent } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  canComment,
  canDeleteComment,
  canEditComment,
  commentBodySchema,
  type Comment,
  type Project,
} from "@nexora/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { toApiError } from "@/lib/api-error";
import { formatDateTime } from "@/features/organizations/labels";
import { useOrg } from "@/features/organizations/org-gate";
import { useAddComment, useComments, useDeleteComment, useEditComment } from "../projects-api";

function CommentItem({
  comment,
  project,
  taskId,
}: {
  comment: Comment;
  project: Project;
  taskId: string;
}) {
  const { organization, actor } = useOrg();
  const edit = useEditComment(organization.id, taskId);
  const remove = useDeleteComment(organization.id, taskId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const authorId = comment.author?.id ?? "";
  const facts = {
    managerId: project.manager?.id ?? null,
    memberIds: project.members.map((m) => m.id),
  };
  const archived = project.status === "archived";

  return (
    <li className="flex gap-2.5">
      <UserAvatar name={comment.author?.name ?? "?"} url={comment.author?.avatarUrl} size="sm" />
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium">{comment.author?.name ?? "Former member"}</span>
          <time dateTime={comment.createdAt} className="text-xs text-muted-foreground">
            {formatDateTime(comment.createdAt)}
          </time>
          {comment.editedAt && <span className="text-xs text-muted-foreground">(edited)</span>}
        </p>
        {editing ? (
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = commentBodySchema.safeParse({ body: draft });
              if (!parsed.success) return toast.error(parsed.error.issues[0]?.message);
              edit.mutate(
                { id: comment.id, body: parsed.data.body },
                {
                  onSuccess: () => setEditing(false),
                  onError: (err) => toast.error(toApiError(err).message),
                },
              );
            }}
          >
            <Textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Edit comment"
              autoFocus
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={edit.isPending}>
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          // NFR-SEC-06: rendered as text — React escapes it, never dangerouslySetInnerHTML.
          <p className="text-sm break-words whitespace-pre-wrap">{comment.body}</p>
        )}
        {!editing && !archived && (
          <div className="flex gap-1">
            {canEditComment(actor, authorId) && (
              <Button size="xs" variant="ghost" onClick={() => setEditing(true)}>
                <PencilIcon aria-hidden /> Edit
              </Button>
            )}
            {canDeleteComment(actor, facts, authorId) && (
              <Button
                size="xs"
                variant="ghost"
                className="text-destructive"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(comment.id, {
                    onSuccess: () => toast.success("Comment deleted."),
                    onError: (err) => toast.error(toApiError(err).message),
                  })
                }
              >
                <Trash2Icon aria-hidden /> Delete
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

// US-28 / FR-COM-01 – 04
export function TaskComments({ taskId, project }: { taskId: string; project: Project }) {
  const { organization, actor } = useOrg();
  const comments = useComments(organization.id, taskId);
  const add = useAddComment(organization.id, taskId);
  const [body, setBody] = useState("");
  const id = useId();
  const facts = {
    managerId: project.manager?.id ?? null,
    memberIds: project.members.map((m) => m.id),
  };
  const canWrite = canComment(actor, facts) && project.status !== "archived";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = commentBodySchema.safeParse({ body });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message);
    add.mutate(parsed.data.body, {
      onSuccess: () => setBody(""),
      onError: (err) => toast.error(toApiError(err).message),
    });
  };

  return (
    <section aria-labelledby="comments-heading" className="grid gap-3 border-t pt-4">
      <h3 id="comments-heading" className="text-sm font-medium">
        Comments{" "}
        {comments.data && (
          <span className="text-muted-foreground">{comments.data.data.length}</span>
        )}
      </h3>
      {comments.isPending ? (
        <Skeleton className="h-16" />
      ) : (
        <ul className="grid gap-4">
          {comments.data?.data.map((c) => (
            <CommentItem key={c.id} comment={c} project={project} taskId={taskId} />
          ))}
        </ul>
      )}
      {canWrite && (
        <form onSubmit={submit} className="grid gap-2">
          <Label htmlFor={id} className="sr-only">
            Add a comment
          </Label>
          <Textarea
            id={id}
            rows={2}
            placeholder="Add a comment"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div>
            <Button type="submit" size="sm" disabled={add.isPending || body.trim() === ""}>
              Comment
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
