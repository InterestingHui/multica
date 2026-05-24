"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Cpu, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import { Label } from "@multica/ui/components/ui/label";
import { Card, CardContent } from "@multica/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@multica/ui/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@multica/ui/components/ui/alert-dialog";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { toast } from "sonner";
import { api } from "@multica/core/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@multica/core/auth";
import { providerProfilesOptions, providerProfileKeys } from "@multica/core/provider-profiles";
import type { ProviderProfile } from "@multica/core/types";

function emptyProfile(): ProviderProfile {
  return {
    id: crypto.randomUUID(),
    name: "",
    api_key: "",
    base_url: "",
    default_model: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function ProviderProfilesTab() {
  const { data: profiles, isLoading } = useQuery(providerProfilesOptions());
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ProviderProfile | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (updated: ProviderProfile[]) => api.updateProviderProfiles(updated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providerProfileKeys.all() });
      toast.success("Provider profiles saved");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to save provider profiles");
    },
  });

  const activeId = user?.active_provider_profile_id;

  const handleSave = async () => {
    if (!editingProfile) return;
    if (!editingProfile.name.trim()) {
      toast.error("Profile name is required");
      return;
    }
    setSaving(true);
    const list = profiles ?? [];
    const idx = list.findIndex((p) => p.id === editingProfile.id);
    const updated = idx >= 0
      ? list.map((p) => (p.id === editingProfile.id ? editingProfile : p))
      : [...list, editingProfile];
    await saveMutation.mutateAsync(updated);
    setSaving(false);
    setDialogOpen(false);
    setEditingProfile(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    const list = (profiles ?? []).filter((p) => p.id !== deleteConfirmId);
    if (activeId === deleteConfirmId) {
      try { await api.updateMe({ active_provider_profile_id: null }); } catch {}
    }
    await saveMutation.mutateAsync(list);
    setDeleteConfirmId(null);
  };

  const handleSetActive = async (id: string) => {
    try {
      const updated = await api.updateMe({ active_provider_profile_id: id });
      useAuthStore.setState({ user: updated });
      queryClient.invalidateQueries({ queryKey: providerProfileKeys.all() });
    } catch {
      toast.error("Failed to set active profile");
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Provider Profiles</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setEditingProfile(emptyProfile()); setDialogOpen(true); }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="ml-1.5">Add Profile</span>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Configure API provider profiles. The active profile's credentials are injected when agents run. Agent-level custom env vars take precedence.
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : profiles && profiles.length > 0 ? (
          <div className="space-y-2">
            {profiles.map((profile) => (
              <Card key={profile.id} className={activeId === profile.id ? "border-primary/50" : ""}>
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{profile.name}</span>
                      {activeId === profile.id && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {profile.base_url && <span>{profile.base_url}</span>}
                      {profile.default_model && <span> · {profile.default_model}</span>}
                    </div>
                  </div>
                  {activeId !== profile.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetActive(profile.id)}
                    >
                      Set active
                    </Button>
                  )}
                  {activeId === profile.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => { setEditingProfile({ ...profile }); setDialogOpen(true); }}
                  >
                    <span className="sr-only">Edit</span>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteConfirmId(profile.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
              <Cpu className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">No provider profiles</p>
              <p className="text-xs text-muted-foreground">
                Create a profile to configure API access for your agents.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setDialogOpen(false); setEditingProfile(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProfile?.name ? "Edit Profile" : "Add Profile"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pf-name">Profile name</Label>
              <Input
                id="pf-name"
                value={editingProfile?.name ?? ""}
                onChange={(e) => setEditingProfile((p) => p ? { ...p, name: e.target.value } : p)}
                placeholder="e.g. My Work Account"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-key">API Key</Label>
              <Input
                id="pf-key"
                type="password"
                value={editingProfile?.api_key ?? ""}
                onChange={(e) => setEditingProfile((p) => p ? { ...p, api_key: e.target.value } : p)}
                placeholder="sk-ant-..."
              />
              {editingProfile?.api_key && editingProfile.api_key.includes("...") && (
                <p className="text-xs text-muted-foreground">Leave blank to keep the existing key.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-url">Base URL</Label>
              <Input
                id="pf-url"
                value={editingProfile?.base_url ?? ""}
                onChange={(e) => setEditingProfile((p) => p ? { ...p, base_url: e.target.value } : p)}
                placeholder="https://api.anthropic.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-model">Default model</Label>
              <Input
                id="pf-model"
                value={editingProfile?.default_model ?? ""}
                onChange={(e) => setEditingProfile((p) => p ? { ...p, default_model: e.target.value } : p)}
                placeholder="claude-opus-4-5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingProfile(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(v) => { if (!v) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete profile</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{profiles?.find((p) => p.id === deleteConfirmId)?.name ?? ""}"? Agents using this profile will fall back to their own configured credentials.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
