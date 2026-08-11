"use client"

import { useState, useEffect } from "react"
import type React from "react"
import type { User as ApiUser } from "../lib/api/types"
import { useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Checkbox } from "../components/ui/checkbox"
import Select from "../components/ui/Select"
import {
  Bell,
  Check,
  GraduationCap,
  KeyRound,
  Lock,
  Palette,
  ShieldCheck,
  User,
} from "lucide-react"
import { majorOptions, getMajorDisplayName } from "../utils/majorUtils"
import { useToast, ToastContainer } from "../hooks/useToast"
import { settingsApi } from "../lib/api/endpoints/settings"
import { DEFAULT_SETTINGS, fromApi, toApi, type SettingsGroups } from "../features/settings/settingsMapping"
import PrivacyTab from "../features/settings/PrivacyTab"
import AppearanceTab from "../features/settings/AppearanceTab"
import { api } from "../lib/api/client"
import { errorMessage } from "../lib/api/errors"
import { Helmet } from "react-helmet"
import Radio from "../components/ui/Radio"
import { useAppShell } from "../components/layout/appShellContext"


const Settings = () => {
  const navigate = useNavigate()
  const { notifications, toast, removeNotification } = useToast()
  const { isSidebarOpen, setIsSidebarOpen } = useAppShell()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Profile Settings State
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    major: "",
    year: "" as string | number,
    phone: "",
    bio: "",
    avatar: null as string | null,
    avatar_url: null as string | null,
    gpa: "0.00" as string | number,
    completed_credits: 0,
    followers_count: 0,
  })

  // Preferences, loaded from and saved to the server. These used to live in
  // localStorage, so they were per-browser: a phone, or a cleared cache, meant
  // starting over.
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  // Password Setup State (for Google OAuth users)
  const [hasPassword, setHasPassword] = useState(true)
  const [passwordData, setPasswordData] = useState({
    password: "",
    password_confirm: "",
  })
  const [settingPassword, setSettingPassword] = useState(false)

  // Active Tab State
  const [activeTab, setActiveTab] = useState("profile")

  // API Integration Functions
  const fetchUserProfile = async () => {
    try {
      const access = localStorage.getItem("access");
      if (!access) {
        navigate("/auth");
        return;
      }

      const data = await api.get<ApiUser>("/auth/user/");
      setProfileData({
        firstName: data.first_name || "",
        lastName: data.last_name || "",
        email: data.email || "",
        username: data.username || "",
        major: data.major || "UD", // Store the backend code directly
        year: data.year || "",
        phone: data.phone || "",
        bio: data.bio || "",
        avatar: data.avatar ?? null,
        avatar_url: data.avatar_url ?? null,
        gpa: data.gpa || "0.00",
        completed_credits: data.completed_credits || 0,
        followers_count: data.followers_count || 0,
      });
      
      // Check if user has a password set
      setHasPassword(data.has_password !== false);
    } catch (error) {
      // ApiError carries the status directly; there is no axios envelope. The
      // client has already tried to refresh by the time a 401 reaches here.
      if ((error as { status?: number })?.status === 401) {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        navigate("/auth");
        return;
      }
      toast.error(errorMessage(error, "Error loading profile data."));
    }
  };

  // Handle Profile Data Change
  const handleProfileChange = (field: string, value: unknown) => {
    setProfileData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const changeSetting =
    <G extends keyof SettingsGroups>(group: G) =>
    (field: keyof SettingsGroups[G], value: SettingsGroups[G][keyof SettingsGroups[G]]) => {
      setSettings((prev) => ({ ...prev, [group]: { ...prev[group], [field]: value } }))
    }

  const handleAcademicChange = changeSetting("academic")
  const handleNotificationChange = changeSetting("notifications")
  const handlePrivacyChange = changeSetting("privacy")
  const handleAppearanceChange = changeSetting("appearance")

  // Handle Password Setup (for Google OAuth users)
  const handlePasswordChange = (field: string, value: unknown) => {
    setPasswordData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Set Password for OAuth users
  const handleSetPassword = async () => {
    if (!passwordData.password || !passwordData.password_confirm) {
      toast.error("Please fill in all password fields.");
      return;
    }

    if (passwordData.password !== passwordData.password_confirm) {
      toast.error("Passwords do not match.");
      return;
    }

    if (passwordData.password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    setSettingPassword(true);
    try {
      const access = localStorage.getItem("access");
      if (!access) {
        navigate("/auth");
        return;
      }

      const response = await api.post(
        "/auth/set-password/",
        {
          password: passwordData.password,
          password_confirm: passwordData.password_confirm,
        },
      );

      toast.success((response as { message?: string })?.message || "Password set successfully!");
      setHasPassword(true);
      setPasswordData({ password: "", password_confirm: "" });
    } catch (error) {
      console.error("Error setting password:", error);
      toast.error(errorMessage(error, "Error setting password. Please try again."));
    } finally {
      setSettingPassword(false);
    }
  }

  // Save Settings
  const saveSettings = async () => {
    setSaving(true);
    try {
      const access = localStorage.getItem("access");
      if (!access) {
        navigate("/auth");
        return;
      }

      // Prepare update data
      const updateData = {
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        email: profileData.email,
        major: profileData.major, // Send the code directly (CS, CH, CE, OGE, GE, UD)
        year: profileData.year,
        phone: profileData.phone,
        bio: profileData.bio,
      };

      await api.patch("/auth/user/", updateData);

      await settingsApi.update(toApi(settings));

      toast.success("Settings saved.");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Error saving settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Load Settings on Mount
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        // Fetch user profile from API
        await fetchUserProfile();

        setSettings(fromApi(await settingsApi.get()));
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [navigate]);

  // Handle Avatar Upload
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (file) {
      try {
        const access = localStorage.getItem("access");
        if (!access) {
          navigate("/auth");
          return;
        }


        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error("File size must be less than 5MB.");
          return;
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
          toast.error("Please upload a valid image file (JPEG, PNG, or GIF).");
          return;
        }


        // Create FormData for file upload
        const formData = new FormData();
        formData.append("avatar", file);


        // The client leaves FormData alone so the browser can set the
        // multipart boundary itself.
        const updated = await api.patch<ApiUser>("/auth/user/", formData);


        // Update profile data with new avatar
        setProfileData(prev => ({
          ...prev,
          avatar: (updated as { avatar?: string | null })?.avatar ?? null,
          avatar_url: (updated as { avatar_url?: string | null })?.avatar_url ?? null,
        }));

        toast.success("Avatar uploaded successfully!");
      } catch (error) {
        toast.error(errorMessage(error, "Could not upload that avatar."));
      }
    }
  };

  // Tab Navigation
  const tabs = [
    { id: "profile", name: "Profile", Icon: User },
    { id: "academic", name: "Academic", Icon: GraduationCap },
    { id: "notifications", name: "Notifications", Icon: Bell },
    { id: "privacy", name: "Privacy", Icon: Lock },
    { id: "appearance", name: "Appearance", Icon: Palette },
    { id: "security", name: "Security", Icon: ShieldCheck },
  ]

  // Add loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <Helmet>
      <title>Ufazien | Settings</title>
      <meta name="description" content="User settings for managing account preferences." />
    </Helmet>
    <div className="flex-1 flex flex-col min-w-0">
      {/* Sidebar */}
      

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsSidebarOpen(true)} 
                  className="lg:hidden p-2 rounded-md hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                  <p className="text-sm text-gray-500">Manage your UFAZ account preferences</p>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-8 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <tab.Icon className="w-4 h-4" aria-hidden="true" />
                  <span>{tab.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              
              {/* Profile Settings */}
              {activeTab === "profile" && (
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Profile Information</h2>
                      <p className="text-gray-600">Manage your personal details and academic information</p>
                    </div>
                  </div>

                  {/* Avatar Section */}
                  <div className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
                    <Label className="block text-sm font-semibold text-gray-700 mb-4">Profile Picture</Label>
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                        {profileData.avatar_url ? (
                          <img
                            src={profileData.avatar_url}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-8 h-8 text-gray-400" aria-hidden="true" />
                        )}
                      </div>
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                          id="avatar-upload"
                        />
                        <label 
                          htmlFor="avatar-upload" 
                          className="inline-block cursor-pointer mb-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
                        >
                          Upload Photo
                        </label>
                        <p className="text-sm text-gray-500">JPG, PNG or GIF (max 5MB)</p>
                      </div>
                    </div>
                  </div>

                  {/* Personal Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-semibold text-gray-700">
                        First Name
                      </Label>
                      <Input
                        id="firstName"
                        value={profileData.firstName}
                        onChange={(e) => handleProfileChange("firstName", e.target.value)}
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-semibold text-gray-700">
                        Last Name
                      </Label>
                      <Input
                        id="lastName"
                        value={profileData.lastName}
                        onChange={(e) => handleProfileChange("lastName", e.target.value)}
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email}
                        onChange={(e) => handleProfileChange("email", e.target.value)}
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-sm font-semibold text-gray-700">
                        Username
                      </Label>
                      <Input
                        id="username"
                        value={profileData.username}
                        disabled
                        className="bg-gray-50 border-gray-200 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="major" className="text-sm font-semibold text-gray-700">
                        Major
                      </Label>
                      <Select
                        id="major"
                        value={profileData.major}
                        onChange={(value) => handleProfileChange("major", value)}
                        options={majorOptions.map((major) => ({
                          value: String(major.code),
                          label: major.display,
                        }))}
                        placeholder="Choose a major"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year" className="text-sm font-semibold text-gray-700">
                        Academic Year
                      </Label>
                      <Select
                        id="year"
                        value={String(profileData.year ?? "")}
                        onChange={(value) => handleProfileChange("year", value)}
                        options={[
                          { value: "1", label: "1st Year" },
                          { value: "2", label: "2nd Year" },
                          { value: "3", label: "3rd Year" },
                          { value: "4", label: "4th Year" },
                          { value: "5", label: "Graduate" },
                        ]}
                        placeholder="Choose a year"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="phone" className="text-sm font-semibold text-gray-700">
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        value={profileData.phone}
                        onChange={(e) => handleProfileChange("phone", e.target.value)}
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="bio" className="text-sm font-semibold text-gray-700">
                        Bio
                      </Label>
                      <textarea
                        id="bio"
                        value={profileData.bio}
                        onChange={(e) => handleProfileChange("bio", e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Tell us about yourself..."
                      />
                    </div>
                  </div>

                  {/* Academic Info Display */}
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <h3 className="text-sm font-semibold text-blue-800 mb-1">Current GPA</h3>
                      <p className="text-2xl font-bold text-blue-900">{parseFloat(String(profileData.gpa)).toFixed(2)}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                      <h3 className="text-sm font-semibold text-green-800 mb-1">Credits Completed</h3>
                      <p className="text-2xl font-bold text-green-900">{profileData.completed_credits}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <h3 className="text-sm font-medium text-gray-600 mb-1">Followers</h3>
                      <p className="text-2xl font-semibold text-gray-900">{profileData.followers_count}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Academic Settings */}
              {activeTab === "academic" && (
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-gray-700" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Academic Preferences</h2>
                      <p className="text-gray-600">Configure your academic settings and goals</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {/* Grade System */}
                    <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                      <Label className="block text-sm font-semibold text-gray-700 mb-4">Grade System</Label>
                      <div className="space-y-3">
                        <label className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-white cursor-pointer transition-colors">
                          <Radio
                            name="gradeSystem"
                            value="ufaz"
                            checked={settings.academic.gradeSystem === "ufaz"}
                            onSelect={(value) => handleAcademicChange("gradeSystem", value)}
                            className="mr-3"
                          />
                          <span className="font-medium">UFAZ 20-point system</span>
                        </label>
                        <label className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-white cursor-pointer transition-colors">
                          <Radio
                            name="gradeSystem"
                            value="standard"
                            checked={settings.academic.gradeSystem === "standard"}
                            onSelect={(value) => handleAcademicChange("gradeSystem", value)}
                            className="mr-3"
                          />
                          <span className="font-medium">Standard 100-point system</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="defaultCredits" className="text-sm font-semibold text-gray-700">
                          Default Course Credits
                        </Label>
                        <Input
                          id="defaultCredits"
                          type="number"
                          min="1"
                          max="6"
                          value={settings.academic.defaultCredits}
                          onChange={(e) => handleAcademicChange("defaultCredits", parseInt(e.target.value))}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="semesterGoal" className="text-sm font-semibold text-gray-700">
                          Semester GPA Goal
                        </Label>
                        <Input
                          id="semesterGoal"
                          type="number"
                          min="0"
                          max="100"
                          value={settings.academic.semesterGoal}
                          onChange={(e) => handleAcademicChange("semesterGoal", parseInt(e.target.value))}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="studyGoalHours" className="text-sm font-semibold text-gray-700">
                          Weekly Study Goal (hours)
                        </Label>
                        <Input
                          id="studyGoalHours"
                          type="number"
                          min="1"
                          max="100"
                          value={settings.academic.studyGoalHours}
                          onChange={(e) => handleAcademicChange("studyGoalHours", parseInt(e.target.value))}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                        />
                      </div>

                      {/* A "Class Reminder (minutes before)" select used to sit
                          here, bound to settings.academic.reminderTime. That
                          field does not exist on UserSettings, so it read
                          undefined and saving it stored nothing. Reminders
                          also need something that can run at a future time,
                          which Celery is not configured to do. */}
                    </div>

                    {/* Academic Toggles */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
                        <div>
                          <Label className="font-semibold text-gray-900">Show GPA on Dashboard</Label>
                          <p className="text-sm text-gray-500">Display your current GPA prominently</p>
                        </div>
                        <Checkbox
                          checked={settings.academic.showGPA}
                          onCheckedChange={(checked) => handleAcademicChange("showGPA", checked)}
                          className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                      </div>
                      {/* A "Track Attendance — Monitor class attendance
                          automatically" toggle used to sit here. Nothing in
                          the platform tracks attendance, and UserSettings has
                          no field for it, so the switch stored nothing and
                          promised something that does not exist. */}
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Settings */}
              {activeTab === "notifications" && (
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Bell className="w-5 h-5 text-gray-700" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Notification Preferences</h2>
                      <p className="text-gray-600">Control how and when you receive notifications</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {/* General Notifications */}
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4 text-lg">General</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
                          <div>
                            <Label className="font-semibold text-gray-900">Email Notifications</Label>
                            <p className="text-sm text-gray-500">Receive notifications via email</p>
                          </div>
                          <Checkbox
                            checked={settings.notifications.emailNotifications}
                            onCheckedChange={(checked) => handleNotificationChange("emailNotifications", checked)}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                        </div>
                        {/* Push notifications are real, but they are managed
                            on the Notifications page, which actually
                            subscribes through pushNotificationService. This
                            copy was bound to a field UserSettings does not
                            have, so switching it did nothing at all. */}
                      </div>
                    </div>

                    {/* Academic Notifications */}
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4 text-lg">Academic</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
                          <div>
                            <Label className="font-semibold text-gray-900">Assignment Reminders</Label>
                            <p className="text-sm text-gray-500">Get reminded about upcoming assignments</p>
                          </div>
                          <Checkbox
                            checked={settings.notifications.assignmentReminders}
                            onCheckedChange={(checked) => handleNotificationChange("assignmentReminders", checked)}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
                          <div>
                            <Label className="font-semibold text-gray-900">Grade Updates</Label>
                            <p className="text-sm text-gray-500">Notifications when grades are posted</p>
                          </div>
                          <Checkbox
                            checked={settings.notifications.gradeUpdates}
                            onCheckedChange={(checked) => handleNotificationChange("gradeUpdates", checked)}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
                          <div>
                            <Label className="font-semibold text-gray-900">Event Reminders</Label>
                            <p className="text-sm text-gray-500">Calendar events and class schedules</p>
                          </div>
                          <Checkbox
                            checked={settings.notifications.eventReminders}
                            onCheckedChange={(checked) => handleNotificationChange("eventReminders", checked)}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Community Notifications */}
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4 text-lg">Community</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
                          <div>
                            <Label className="font-semibold text-gray-900">Community Messages</Label>
                            <p className="text-sm text-gray-500">New messages in study groups and forums</p>
                          </div>
                          <Checkbox
                            checked={settings.notifications.communityMessages}
                            onCheckedChange={(checked) => handleNotificationChange("communityMessages", checked)}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
                          <div>
                            <Label className="font-semibold text-gray-900">Weekly Reports</Label>
                            <p className="text-sm text-gray-500">Weekly summary of your activity</p>
                          </div>
                          <Checkbox
                            checked={settings.notifications.weeklyReports}
                            onCheckedChange={(checked) => handleNotificationChange("weeklyReports", checked)}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Settings */}
              {activeTab === "security" && (
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-gray-700" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Security Settings</h2>
                      <p className="text-gray-600">Manage your account security and authentication</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {/* Password Setup for OAuth Users */}
                    {!hasPassword && (
                      <div className="p-6 bg-amber-50 rounded-xl border border-amber-200">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <KeyRound className="w-5 h-5 text-amber-700" aria-hidden="true" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                              Set Up Password for CLI Access
                            </h3>
                            <p className="text-sm text-gray-700 mb-4">
                              You signed up with Google OAuth and don't have a password set. 
                              Set a password to use the CLI tool for hosting services.
                            </p>
                            
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                                  New Password
                                </Label>
                                <Input
                                  id="password"
                                  type="password"
                                  value={passwordData.password}
                                  onChange={(e) => handlePasswordChange("password", e.target.value)}
                                  placeholder="Enter your password (min 8 characters)"
                                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="password_confirm" className="text-sm font-semibold text-gray-700">
                                  Confirm Password
                                </Label>
                                <Input
                                  id="password_confirm"
                                  type="password"
                                  value={passwordData.password_confirm}
                                  onChange={(e) => handlePasswordChange("password_confirm", e.target.value)}
                                  placeholder="Confirm your password"
                                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                                />
                              </div>
                              <Button
                                onClick={handleSetPassword}
                                disabled={settingPassword || !passwordData.password || !passwordData.password_confirm}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0"
                              >
                                {settingPassword ? "Setting Password..." : "Set Password"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Password Status */}
                    {hasPassword && (
                      <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <Check className="w-5 h-5 text-emerald-700" aria-hidden="true" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">
                              Password Set
                            </h3>
                            <p className="text-sm text-gray-700">
                              You have a password set and can use email/password authentication for CLI tools.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Login alerts, two-factor and session timeout used to sit
                        here as controls over state that reached nothing: there
                        is no two-factor flow to switch on, no alert to send,
                        and the token lifetime is set by the server. Offering
                        the switches implied protection that was not there.
                        Password setup above is the part that is real. */}
                  </div>
                </div>
              )}

              {activeTab === "privacy" && (
                <PrivacyTab settings={settings.privacy} onChange={handlePrivacyChange} />
              )}

              {activeTab === "appearance" && (
                <AppearanceTab settings={settings.appearance} onChange={handleAppearanceChange} />
              )}

              {/* Save Button */}
              <div className="border-t bg-gray-50 px-8 py-6">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Changes are saved automatically to your profile</p>
                  <Button
                    onClick={saveSettings}
                    disabled={saving}
                    className="min-w-[140px] bg-blue-600 hover:bg-blue-700 text-white border-0"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <ToastContainer 
      notifications={notifications} 
      removeNotification={removeNotification} 
    />
  </>
  )
}

export default Settings
