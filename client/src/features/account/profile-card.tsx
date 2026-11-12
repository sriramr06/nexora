import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImageUpIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES, nameSchema, type AuthUser } from "@nexora/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import { api } from "@/lib/api";
import { toApiError } from "@/lib/api-error";
import { useAuthStore, useCurrentUser } from "@/lib/auth-store";

type UserResponse = { data: { user: AuthUser } };
const setUser = (user: AuthUser) => useAuthStore.getState().setUser(user);

// US-31 / US-32: name and avatar (FR-PROF-01 – 04).
export function ProfileCard() {
  const user = useCurrentUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [nameError, setNameError] = useState<string>();
  const nameId = useId();

  const saveName = useMutation({
    mutationFn: async (value: string) =>
      (await api.patch<UserResponse>("/me", { name: value })).data.data.user,
    onSuccess: (u) => {
      setUser(u);
      toast.success("Name updated.");
    },
    onError: (e) => setNameError(toApiError(e).message),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("avatar", file);
      return (await api.post<UserResponse>("/me/avatar", form)).data.data.user;
    },
    onSuccess: (u) => {
      setUser(u);
      toast.success("Photo updated.");
    },
    onError: (e) => toast.error(toApiError(e).message),
  });

  const remove = useMutation({
    mutationFn: async () => (await api.delete<UserResponse>("/me/avatar")).data.data.user,
    onSuccess: (u) => {
      setUser(u);
      toast.success("Photo removed.");
    },
    onError: (e) => toast.error(toApiError(e).message),
  });

  // Quick checks for a friendly message; the server checks the real bytes (INT-4).
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
      return toast.error("Choose a JPEG, PNG or WebP image.");
    }
    if (file.size > AVATAR_MAX_BYTES) return toast.error("Image must be 2 MB or smaller.");
    upload.mutate(file);
  };

  const onSaveName = (e: FormEvent) => {
    e.preventDefault();
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) return setNameError(parsed.error.issues[0]?.message);
    saveName.mutate(parsed.data);
  };

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>
          <h2>Profile</h2>
        </CardTitle>
        <CardDescription>How your team sees you.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar name={user.name} url={user.avatar?.url} size="lg" />
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={upload.isPending}
                onClick={() => fileRef.current?.click()}
              >
                <ImageUpIcon aria-hidden /> {user.avatar ? "Change photo" : "Upload photo"}
              </Button>
              {user.avatar && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  <Trash2Icon aria-hidden /> Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 2 MB.</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={AVATAR_MIME_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={onFile}
          />
        </div>

        <form onSubmit={onSaveName} className="grid gap-1.5" noValidate>
          <Label htmlFor={nameId}>Name</Label>
          <div className="flex gap-2">
            <Input
              id={nameId}
              value={name}
              autoComplete="name"
              aria-invalid={nameError ? true : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(undefined);
              }}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={saveName.isPending || name.trim() === user.name}
            >
              Save
            </Button>
          </div>
          {nameError && <p className="text-sm text-destructive">{nameError}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
