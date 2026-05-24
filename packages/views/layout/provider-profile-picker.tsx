"use client";

import React from "react";
import { Cpu, ChevronDown, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@multica/core/auth";
import { api } from "@multica/core/api";
import { providerProfilesOptions, providerProfileKeys } from "@multica/core/provider-profiles";
import { paths, useCurrentWorkspace } from "@multica/core/paths";
import { useNavigation } from "../navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@multica/ui/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@multica/ui/components/ui/sidebar";

export function ProviderProfilePicker() {
  const { data: profiles } = useQuery(providerProfilesOptions());
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { push } = useNavigation();
  const workspace = useCurrentWorkspace();

  const handleManageProfiles = () => {
    if (workspace?.slug) {
      push(paths.workspace(workspace.slug).settings() + "?tab=provider-profiles");
    }
  };

  const setActiveMutation = useMutation({
    mutationFn: (profileId: string | null) => api.updateMe({ active_provider_profile_id: profileId }),
    onSuccess: (updatedUser) => {
      useAuthStore.setState({ user: updatedUser });
      queryClient.invalidateQueries({ queryKey: providerProfileKeys.all() });
    },
  });

  const activeProfile = profiles?.find((p) => p.id === user?.active_provider_profile_id);
  const label = activeProfile?.name ?? "Default";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="w-full"
            render={
              <SidebarMenuButton className="text-muted-foreground">
                <Cpu className="h-4 w-4" />
                <span className="truncate">{label}</span>
                <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-50" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Provider Profiles</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setActiveMutation.mutate(null)}
              className={!activeProfile ? "font-medium" : ""}
            >
              <Cpu className="h-4 w-4" />
              <span>Default</span>
              {!activeProfile && <span className="ml-auto text-xs text-muted-foreground">Active</span>}
            </DropdownMenuItem>
            {profiles?.map((profile) => (
              <DropdownMenuItem
                key={profile.id}
                onClick={() => setActiveMutation.mutate(profile.id)}
                className={activeProfile?.id === profile.id ? "font-medium" : ""}
              >
                <Cpu className="h-4 w-4" />
                <div className="flex flex-col">
                  <span>{profile.name}</span>
                  {profile.default_model && (
                    <span className="text-xs text-muted-foreground">{profile.default_model}</span>
                  )}
                </div>
                {activeProfile?.id === profile.id && (
                  <span className="ml-auto text-xs text-muted-foreground">Active</span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleManageProfiles}
            >
              <Settings className="h-4 w-4" />
              <span>Manage profiles...</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
