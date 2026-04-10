"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogButton,
  DialogSeparator,
} from "@/components/ui/dialog";
import { useToast } from "@/components/Toast";
import { ApiKeyManager } from "./ApiKeyManager";

interface UserProfileData {
  userId: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  createdAt: string;
  lastLoginAt?: string;
}

interface UserProfileProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfile({ open, onOpenChange }: UserProfileProps) {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { show: showToast } = useToast.getState();

  // Fetch profile when dialog opens
  useEffect(() => {
    if (open) {
      fetchProfile();
    }
  }, [open]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setEditDisplayName(data.displayName || "");
      } else {
        showToast("Failed to load profile", "error");
      }
    } catch (error) {
      showToast("Error loading profile", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editDisplayName.trim()) {
      showToast("Display name cannot be empty", "error");
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: editDisplayName }),
      });

      if (res.ok) {
        showToast("Profile updated successfully", "success");
        await fetchProfile();
      } else {
        const errorData = await res.json();
        showToast(errorData.error || "Failed to update profile", "error");
      }
    } catch (error) {
      showToast("Error updating profile", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      showToast("Current password is required", "error");
      return;
    }
    if (!newPassword.trim()) {
      showToast("New password is required", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (res.ok) {
        showToast("Password changed successfully", "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const errorData = await res.json();
        showToast(errorData.error || "Failed to change password", "error");
      }
    } catch (error) {
      showToast("Error changing password", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>

        {loading ? (
          <DialogBody>
            <div className="flex items-center justify-center py-8 text-[var(--text-muted)]">
              Loading profile...
            </div>
          </DialogBody>
        ) : (
          <>
            <DialogBody>
              {/* Profile Info Section */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-2">
                    Username
                  </label>
                  <div className="px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text-muted)]">
                    {profile?.username || "-"}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Read-only (changes require admin)
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder="Enter display name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-2">
                    Role
                  </label>
                  <div className="px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text-primary)]">
                    <span className="capitalize">{profile?.role || "user"}</span>
                  </div>
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving || editDisplayName === profile?.displayName}
                  className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--btn-primary-text)] hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Profile"}
                </button>
              </div>

              <DialogSeparator className="my-6" />

              {/* Change Password Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Change Password
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder="Enter new password"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder="Confirm new password"
                  />
                </div>

                <button
                  onClick={handleChangePassword}
                  disabled={
                    isSaving ||
                    !currentPassword.trim() ||
                    !newPassword.trim() ||
                    !confirmPassword.trim()
                  }
                  className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--btn-primary-text)] hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Changing..." : "Change Password"}
                </button>
              </div>

              <DialogSeparator className="my-6" />

              {/* API Keys Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  API Keys
                </h3>
                <ApiKeyManager />
              </div>
            </DialogBody>

            <DialogFooter>
              <DialogButton variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </DialogButton>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
