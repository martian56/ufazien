"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Checkbox } from "../components/ui/checkbox"
import SideBar from "../components/ui/SideBar"
import { majorOptions, getMajorDisplayName } from "../utils/majorUtils"
import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL

const Settings = () => {
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Profile Settings State
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    major: "",
    year: "",
    phone: "",
    bio: "",
    avatar: null,
    avatar_url: null,
    gpa: "0.00",
    completed_credits: 0,
    followers_count: 0,
  })

  // Academic Settings State
  const [academicSettings, setAcademicSettings] = useState({
    gradeSystem: "ufaz",
    defaultCredits: 3,
    semesterGoal: 85,
    showGPA: true,
    trackAttendance: true,
    reminderTime: "30",
    studyGoalHours: 25,
  })

  // Notification Settings State
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    assignmentReminders: true,
    gradeUpdates: true,
    communityMessages: true,
    eventReminders: true,
    weeklyReports: false,
    marketingEmails: false,
  })

  // Privacy Settings State
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: "friends",
    showGrades: false,
    showSchedule: true,
    allowMessages: true,
    showOnlineStatus: true,
    dataSharing: false,
  })

  // App Settings State
  const [appSettings, setAppSettings] = useState({
    theme: "light",
    language: "en",
    timezone: "Asia/Baku",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24h",
    autoSave: true,
    offlineMode: false,
  })

  // Security Settings State
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    loginAlerts: true,
    sessionTimeout: "30",
    passwordLastChanged: "2024-01-15",
    activeDevices: 3,
  })

  // Active Tab State
  const [activeTab, setActiveTab] = useState("profile")
  const [saveMessage, setSaveMessage] = useState("")

  // API Integration Functions
  const fetchUserProfile = async () => {
    try {
      const access = localStorage.getItem("access");
      if (!access) {
        navigate("/auth");
        return;
      }

      const response = await axios.get(`${API_URL}/api/auth/user/`, {
        headers: { Authorization: `Bearer ${access}` }
      });

      const data = response.data;
      setProfileData({
        firstName: data.first_name || "",
        lastName: data.last_name || "",
        email: data.email || "",
        username: data.username || "",
        major: data.major || "UD", // Store the backend code directly
        year: data.year || "",
        phone: data.phone || "",
        bio: data.bio || "",
        avatar: data.avatar,
        avatar_url: data.avatar_url,
        gpa: data.gpa || "0.00",
        completed_credits: data.completed_credits || 0,
        followers_count: data.followers_count || 0,
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      if (error.response?.status === 401) {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        navigate("/auth");
      }
      setSaveMessage("Error loading profile data.");
    }
  };

  // Handle Profile Data Change
  const handleProfileChange = (field, value) => {
    setProfileData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Handle Academic Settings Change
  const handleAcademicChange = (field, value) => {
    setAcademicSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Handle Notification Settings Change
  const handleNotificationChange = (field, value) => {
    setNotificationSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Handle Privacy Settings Change
  const handlePrivacyChange = (field, value) => {
    setPrivacySettings((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Handle App Settings Change
  const handleAppChange = (field, value) => {
    setAppSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Handle Security Settings Change
  const handleSecurityChange = (field, value) => {
    setSecuritySettings((prev) => ({
      ...prev,
      [field]: value,
    }))
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

      const response = await axios.patch(`${API_URL}/api/auth/user/`, updateData, {
        headers: { Authorization: `Bearer ${access}` }
      });

      // Save other settings to localStorage (until backend endpoints are available)
      localStorage.setItem("ufaz_academic_settings", JSON.stringify(academicSettings));
      localStorage.setItem("ufaz_notification_settings", JSON.stringify(notificationSettings));
      localStorage.setItem("ufaz_privacy_settings", JSON.stringify(privacySettings));
      localStorage.setItem("ufaz_app_settings", JSON.stringify(appSettings));
      localStorage.setItem("ufaz_security_settings", JSON.stringify(securitySettings));

      setSaveMessage("Settings saved successfully!");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      setSaveMessage("Error saving settings. Please try again.");
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

        // Load other settings from localStorage
        const savedAcademic = localStorage.getItem("ufaz_academic_settings");
        const savedNotifications = localStorage.getItem("ufaz_notification_settings");
        const savedPrivacy = localStorage.getItem("ufaz_privacy_settings");
        const savedApp = localStorage.getItem("ufaz_app_settings");
        const savedSecurity = localStorage.getItem("ufaz_security_settings");

        if (savedAcademic) setAcademicSettings(JSON.parse(savedAcademic));
        if (savedNotifications) setNotificationSettings(JSON.parse(savedNotifications));
        if (savedPrivacy) setPrivacySettings(JSON.parse(savedPrivacy));
        if (savedApp) setAppSettings(JSON.parse(savedApp));
        if (savedSecurity) setSecuritySettings(JSON.parse(savedSecurity));
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [navigate]);

  // Handle Avatar Upload
  const handleAvatarUpload = async (event) => {
    const file = event.target.files[0];
    console.log("File selected:", file);
    
    if (file) {
      try {
        const access = localStorage.getItem("access");
        if (!access) {
          navigate("/auth");
          return;
        }

        console.log("Starting avatar upload...");

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          setSaveMessage("File size must be less than 5MB.");
          setTimeout(() => setSaveMessage(""), 3000);
          return;
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
          setSaveMessage("Please upload a valid image file (JPEG, PNG, or GIF).");
          setTimeout(() => setSaveMessage(""), 3000);
          return;
        }

        console.log("File validation passed, uploading...");

        // Create FormData for file upload
        const formData = new FormData();
        formData.append("avatar", file);

        console.log("FormData created:", formData.get("avatar"));

        const response = await axios.patch(`${API_URL}/api/auth/user/`, formData, {
          headers: {
            Authorization: `Bearer ${access}`,
            // Don't set Content-Type manually - let browser set it with boundary
          },
        });

        console.log("Upload response:", response.data);

        // Update profile data with new avatar
        setProfileData(prev => ({
          ...prev,
          avatar: response.data.avatar,
          avatar_url: response.data.avatar_url,
        }));

        setSaveMessage("Avatar uploaded successfully!");
        setTimeout(() => setSaveMessage(""), 3000);
      } catch (error) {
        console.error("Error uploading avatar:", error);
        if (error.response?.data) {
          console.error("Error details:", error.response.data);
          setSaveMessage(`Error: ${error.response.data.detail || error.response.data.avatar?.[0] || "Failed to upload avatar"}`);
        } else {
          setSaveMessage("Error uploading avatar. Please try again.");
        }
        setTimeout(() => setSaveMessage(""), 5000);
      }
    }
  };

  // Tab Navigation
  const tabs = [
    { id: "profile", name: "Profile", icon: "👤" },
    { id: "academic", name: "Academic", icon: "🎓" },
    { id: "notifications", name: "Notifications", icon: "🔔" },
    { id: "privacy", name: "Privacy", icon: "🔒" },
    { id: "appearance", name: "Appearance", icon: "🎨" },
    { id: "security", name: "Security", icon: "🛡️" },
  ]

  // Add loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <SideBar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        pageTitle="Settings"
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
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

              {/* Save Message */}
              {saveMessage && (
                <div className={`px-4 py-2 rounded-lg text-sm ${
                  saveMessage.includes("Error")
                    ? "bg-red-100 text-red-700 border border-red-200"
                    : "bg-green-100 text-green-700 border border-green-200"
                }`}>
                  {saveMessage}
                </div>
              )}
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
                  <span className="text-lg">{tab.icon}</span>
                  <span>{tab.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              
              {/* Profile Settings */}
              {activeTab === "profile" && (
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <span className="text-white text-xl">👤</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Profile Information</h2>
                      <p className="text-gray-600">Manage your personal details and academic information</p>
                    </div>
                  </div>

                  {/* Avatar Section */}
                  <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                    <Label className="block text-sm font-semibold text-gray-700 mb-4">Profile Picture</Label>
                    <div className="flex items-center gap-6">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center overflow-hidden shadow-lg">
                        {profileData.avatar_url ? (
                          <img
                            src={profileData.avatar_url}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-3xl text-white">👤</span>
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
                          className="inline-block cursor-pointer mb-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
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
                      <select
                        id="major"
                        value={profileData.major}
                        onChange={(e) => handleProfileChange("major", e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {majorOptions.map((major) => (
                          <option key={major.code} value={major.code}>
                            {major.display}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year" className="text-sm font-semibold text-gray-700">
                        Academic Year
                      </Label>
                      <select
                        id="year"
                        value={profileData.year}
                        onChange={(e) => handleProfileChange("year", e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                        <option value="Graduate">Graduate</option>
                      </select>
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
                      <p className="text-2xl font-bold text-blue-900">{parseFloat(profileData.gpa).toFixed(2)}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                      <h3 className="text-sm font-semibold text-green-800 mb-1">Credits Completed</h3>
                      <p className="text-2xl font-bold text-green-900">{profileData.completed_credits}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                      <h3 className="text-sm font-semibold text-purple-800 mb-1">Followers</h3>
                      <p className="text-2xl font-bold text-purple-900">{profileData.followers_count}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Academic Settings */}
              {activeTab === "academic" && (
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <span className="text-white text-xl">🎓</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Academic Preferences</h2>
                      <p className="text-gray-600">Configure your academic settings and goals</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {/* Grade System */}
                    <div className="p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-100">
                      <Label className="block text-sm font-semibold text-gray-700 mb-4">Grade System</Label>
                      <div className="space-y-3">
                        <label className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-white cursor-pointer transition-colors">
                          <input
                            type="radio"
                            name="gradeSystem"
                            value="ufaz"
                            checked={academicSettings.gradeSystem === "ufaz"}
                            onChange={(e) => handleAcademicChange("gradeSystem", e.target.value)}
                            className="mr-3 text-blue-600"
                          />
                          <span className="font-medium">UFAZ 20-point system</span>
                        </label>
                        <label className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-white cursor-pointer transition-colors">
                          <input
                            type="radio"
                            name="gradeSystem"
                            value="standard"
                            checked={academicSettings.gradeSystem === "standard"}
                            onChange={(e) => handleAcademicChange("gradeSystem", e.target.value)}
                            className="mr-3 text-blue-600"
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
                          value={academicSettings.defaultCredits}
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
                          value={academicSettings.semesterGoal}
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
                          value={academicSettings.studyGoalHours}
                          onChange={(e) => handleAcademicChange("studyGoalHours", parseInt(e.target.value))}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reminderTime" className="text-sm font-semibold text-gray-700">
                          Class Reminder (minutes before)
                        </Label>
                        <select
                          id="reminderTime"
                          value={academicSettings.reminderTime}
                          onChange={(e) => handleAcademicChange("reminderTime", e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="15">15 minutes</option>
                          <option value="30">30 minutes</option>
                          <option value="60">1 hour</option>
                          <option value="120">2 hours</option>
                        </select>
                      </div>
                    </div>

                    {/* Academic Toggles */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
                        <div>
                          <Label className="font-semibold text-gray-900">Show GPA on Dashboard</Label>
                          <p className="text-sm text-gray-500">Display your current GPA prominently</p>
                        </div>
                        <Checkbox
                          checked={academicSettings.showGPA}
                          onCheckedChange={(checked) => handleAcademicChange("showGPA", checked)}
                          className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
                        <div>
                          <Label className="font-semibold text-gray-900">Track Attendance</Label>
                          <p className="text-sm text-gray-500">Monitor class attendance automatically</p>
                        </div>
                        <Checkbox
                          checked={academicSettings.trackAttendance}
                          onCheckedChange={(checked) => handleAcademicChange("trackAttendance", checked)}
                          className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Settings */}
              {activeTab === "notifications" && (
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center">
                      <span className="text-white text-xl">🔔</span>
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
                            checked={notificationSettings.emailNotifications}
                            onCheckedChange={(checked) => handleNotificationChange("emailNotifications", checked)}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
                          <div>
                            <Label className="font-semibold text-gray-900">Push Notifications</Label>
                            <p className="text-sm text-gray-500">Browser and mobile push notifications</p>
                          </div>
                          <Checkbox
                            checked={notificationSettings.pushNotifications}
                            onCheckedChange={(checked) => handleNotificationChange("pushNotifications", checked)}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                        </div>
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
                            checked={notificationSettings.assignmentReminders}
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
                            checked={notificationSettings.gradeUpdates}
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
                            checked={notificationSettings.eventReminders}
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
                            checked={notificationSettings.communityMessages}
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
                            checked={notificationSettings.weeklyReports}
                            onCheckedChange={(checked) => handleNotificationChange("weeklyReports", checked)}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Other tab contents */}
              {!["profile", "academic", "notifications"].includes(activeTab) && (
                <div className="p-8">
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🚧</div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{tabs.find(t => t.id === activeTab)?.name} Settings</h2>
                    <p className="text-gray-600">This section is under development.</p>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="border-t bg-gray-50 px-8 py-6">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Changes are saved automatically to your profile</p>
                  <Button
                    onClick={saveSettings}
                    disabled={saving}
                    className="min-w-[140px] bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 shadow-lg"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
    </div>
  )
}

export default Settings
