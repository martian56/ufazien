"use client"

import { useEffect, useState, useRef } from "react"
import { formatCount, usePlatformStats } from "../features/home/usePlatformStats"
import AchievementsSection from "../features/home/AchievementsSection"
import FeaturesSection from "../features/home/FeaturesSection"
import TestimonialsSection from "../features/home/TestimonialsSection"
import { useNavigate } from "react-router-dom"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { TextPlugin } from "gsap/TextPlugin"
import {
  Calculator, TrendingUp, PenTool, MessageCircle,
  Users, Sparkles, ChevronRight, BookOpen, ArrowRight,
  CheckCircle, BarChart3, Calendar, Award, Target, Zap,
  Globe, Shield, Rocket, Brain, Heart, Play, Menu,
  X, Star, Activity, Github, Twitter, Linkedin,
  Instagram, Layers, House, SwatchBook
} from "lucide-react"

import { 
  SiReact, SiDjango, SiTensorflow, 
  SiAmazonec2, SiPostgresql, SiAwslambda,
  SiAmazonroute53, SiDocker, SiTraefikproxy,
  SiNginx, SiNodedotjs, SiRedis 
} from "react-icons/si";

import { FaMobileAlt, FaChartBar,FaAws  } from "react-icons/fa";
import { TbApi } from "react-icons/tb";
import { MdSecurity } from "react-icons/md";
// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, TextPlugin)

export default function Home() {
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [currentFeature, setCurrentFeature] = useState(0)
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Refs for GSAP animations
  const heroRef = useRef(null)
  const heroTitleRef = useRef(null)
  const heroSubtitleRef = useRef(null)
  const heroButtonsRef = useRef(null)
  const statsRef = useRef(null)
  const featuresRef = useRef(null)
  const testimonialsRef = useRef(null)
  const ctaRef = useRef(null)
  const floatingElementsRef = useRef([])
  const cursorRef = useRef(null)
  const progressBarRef = useRef(null)

  // Check authentication status
  useEffect(() => {
    const accessToken = localStorage.getItem("access")
    setIsAuthenticated(!!accessToken)
  }, [])

  // GSAP Animations Setup
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero animations
      const tl = gsap.timeline()

      tl.from(heroTitleRef.current, {
        y: 100,
        opacity: 0,
        duration: 1.2,
        ease: "power3.out",
      })
        .from(
          heroSubtitleRef.current,
          {
            y: 50,
            opacity: 0,
            duration: 1,
            ease: "power3.out",
          },
          "-=0.8",
        )
        .from(
          heroButtonsRef.current.children,
          {
            y: 30,
            opacity: 0,
            duration: 0.8,
            stagger: 0.2,
            ease: "power3.out",
          },
          "-=0.6",
        )

      // Floating elements animation
      floatingElementsRef.current.forEach((el, index) => {
        if (el) {
          gsap.to(el, {
            y: -20,
            rotation: 5,
            duration: 3 + index * 0.5,
            repeat: -1,
            yoyo: true,
            ease: "power2.inOut",
          })
        }
      })

      // Stats animation
      ScrollTrigger.create({
        trigger: statsRef.current,
        start: "top 80%",
        onEnter: () => {
          gsap.fromTo(statsRef.current.children, 
            {
              y: 50,
              opacity: 0,
            },
            {
              y: 0,
              opacity: 1,
              duration: 0.8,
              stagger: 0.1,
              ease: "power3.out",
            }
          )
        },
      })

      // Features animation
      ScrollTrigger.create({
        trigger: featuresRef.current,
        start: "top 80%",
        onEnter: () => {
          gsap.fromTo(featuresRef.current.querySelectorAll(".feature-card"),
            {
              y: 60,
              opacity: 0,
            },
            {
              y: 0,
              opacity: 1,
              duration: 1,
              stagger: 0.2,
              ease: "power3.out",
            }
          )
        },
      })

      // Testimonials animation
      ScrollTrigger.create({
        trigger: testimonialsRef.current,
        start: "top 80%",
        onEnter: () => {
          gsap.fromTo(testimonialsRef.current.querySelector(".testimonial-card"),
            {
              scale: 0.8,
              opacity: 0,
            },
            {
              scale: 1,
              opacity: 1,
              duration: 1,
              ease: "power3.out",
            }
          )
        },
      })

      // CTA animation
      ScrollTrigger.create({
        trigger: ctaRef.current,
        start: "top 80%",
        onEnter: () => {
          gsap.fromTo(ctaRef.current.children,
            {
              y: 40,
              opacity: 0,
            },
            {
              y: 0,
              opacity: 1,
              duration: 0.8,
              stagger: 0.2,
              ease: "power3.out",
            }
          )
        },
      })
    }, heroRef.current)

    return () => ctx.revert()
  }, [])

  // Scroll progress and header effects
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      const progress = (scrollY / (documentHeight - windowHeight)) * 100

      setIsScrolled(scrollY > 50)

      if (progressBarRef.current) {
        gsap.to(progressBarRef.current, {
          width: `${progress}%`,
          duration: 0.1,
          ease: "none",
        })
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Custom cursor effect
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (cursorRef.current) {
        gsap.to(cursorRef.current, {
          x: e.clientX - 16,
          y: e.clientY - 16,
          duration: 0.2,
          ease: "power2.out",
        })
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  // Auto-rotate features and testimonials
  useEffect(() => {
    const featureInterval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length)
    }, 5000)

    const testimonialInterval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)
    }, 4000)

    return () => {
      clearInterval(featureInterval)
      clearInterval(testimonialInterval)
    }
  }, [])

  const features = [
    {
      icon: TrendingUp,
      title: "Average Calculator",
      description: "Comprehensive grade analysis with weighted averages, public and private schemas, and performance insights.",
      link: "/average-calculator",
      color: "from-green-500 to-emerald-500",
      stats: "Weighted averages",
      badge: "Trending",
    },
    {
      icon: Calculator,
      title: "GPA Calculator",
      description: "Advanced GPA tracking with UFAZ's 20-point system, predictive analytics, and semester planning.",
      link: "/gpa-calculator",
      color: "from-blue-500 to-cyan-500",
      stats: "UFAZ 20-point scale",
      badge: "Most Popular",
    },
    {
      icon: House,
      title: "Website Hosting",
      description: "Deploy and manage your personal academic website with custom domains, SSL, and one-click setup.",
      link: "/hosting",
      color: "from-green-500 to-emerald-500",
      stats: "Free tier, SSL included",
      badge: "Free Tier",
    },
    {
      icon: BarChart3,
      title: "User Sites",
      description: "Showcase your projects, blogs, and portfolios with our easy-to-use hosting platform.",
      link: "/user-sites",
      color: "from-teal-500 to-blue-500",
      stats: "Public showcase",
      badge: "Public",
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description: "Comprehensive academic analytics, progress tracking, and performance visualization.",
      link: "/dashboard",
      color: "from-teal-500 to-blue-500",
      stats: "Real-time insights",
      badge: "Pro Feature",
    },
    {
      icon: PenTool,
      title: "Blog Platform",
      description: "AI-powered writing tools, rich editor, collaborative features, and community engagement.",
      link: "/blog",
      color: "from-purple-500 to-pink-500",
      stats: "Drafts and scheduling",
      badge: "New Features",
    },
    {
      icon: Brain,
      title: "AI Tools",
      description: "Humanizer, summarizer, translator, and research assistant to enhance your academic work.",
      link: "/ai-tools",
      color: "from-teal-500 to-blue-500",
      stats: "10+ tools",
      badge: "AI Powered",
    },
    {
      icon: MessageCircle,
      title: "Study Groups & Chat",
      description: "Real-time collaboration, course-specific groups, video calls, and peer-to-peer learning.",
      link: "/community",
      color: "from-orange-500 to-red-500",
      stats: "Real-time chat",
      badge: "Community",
    },
    {
      icon: Calendar,
      title: "Smart Academic Calendar",
      description: "AI-powered scheduling, deadline tracking, and integration with UFAZ academic calendar.",
      link: "/calendar",
      color: "from-indigo-500 to-purple-500",
      stats: "Import and export",
      badge: "Essential",
    }
  ]

  // Was a list of literals with invented growth percentages ("+156%"), never
  // updated after it was written. Counted from the database now, and simply
  // absent when the request fails rather than showing a number nobody checked.
  const platformStats = usePlatformStats()
  const stats = platformStats
    ? [
        { number: formatCount(platformStats.students), label: "Students", icon: Users, color: "text-blue-600" },
        { number: formatCount(platformStats.gpa_calculations), label: "GPA Calculations", icon: Calculator, color: "text-green-600" },
        { number: formatCount(platformStats.average_calculations), label: "Average Calculations", icon: Calculator, color: "text-red-600" },
        { number: formatCount(platformStats.average_schemas), label: "Average Schemas", icon: SwatchBook, color: "text-purple-600" },
        { number: formatCount(platformStats.hosted_websites), label: "Hosted Websites", icon: House, color: "text-cyan-600" },
        { number: formatCount(platformStats.blog_posts), label: "Blog Posts", icon: PenTool, color: "text-purple-600" },
        { number: formatCount(platformStats.study_groups), label: "Study Groups", icon: MessageCircle, color: "text-orange-600" },
      ]
    : []

  const testimonials = [
    {
      name: "Nadir Askarov",
      role: "Computer Science, 3rd Year",
      avatar: "https://ik.imagekit.io/ufazien/testimonials/nadir_askarov.jpeg?updatedAt=1756327720548",
      content:
        "The average calculator is really useful! It is simple, clear, and practical for students, making it much easier to keep track of grades and stay organized.",
      rating: 5,
      verified: true,
    },
    {
      name: "Zeynalabdin Huseynli",
      role: "Computer Science, 3rd Year",
      avatar: "https://ik.imagekit.io/ufazien/testimonials/zeynal.jpg?updatedAt=1757576718681",
      content:
        "The GPA Calculator is incredible. It was always tricky to calculate my GPA manually, but this tool made it so easy and accurate. Highly recommend it!",
      rating: 5,
      verified: true,
    },
    {
      name: "Valiyyaddin Aliyev",
      role: "Computer Science, 3th Year",
      avatar: "https://ik.imagekit.io/ufazien/testimonials/valiyyaddin_aliyev.jpeg?updatedAt=1756362329574",
      content:
        "The Hosting service with free tier is a game changer for me. It allows me to experiment with my projects without worrying about costs.",
      rating: 5,
      verified: true,
    },
  ]

  const technologies = [
    { name: "React 19", icon: SiReact, color: "text-sky-500", description: "Modern UI framework" },
    { name: "Django", icon: SiDjango, color: "text-green-600", description: "Scalable backend" },
    { name: "Django REST Framework", icon: TbApi, color: "text-red-500", description: "Powerful API layer" },
    { name: "AllAuth", icon: MdSecurity, color: "text-purple-600", description: "Authentication system" },
    { name: "AI/ML", icon: SiTensorflow, color: "text-orange-500", description: "Intelligent features" },
    { name: "AWS", icon: FaAws, color: "text-yellow-500", description: "Cloud platform" },
    { name: "Mobile", icon: FaMobileAlt, color: "text-pink-500", description: "Cross-platform" },
    { name: "EC2", icon: SiAmazonec2, color: "text-orange-500", description: "Compute instances" },
    { name: "Aurora", icon: SiPostgresql, color: "text-blue-600", description: "Managed SQL database" },
    { name: "Lambdas", icon: SiAwslambda , color: "text-emerald-600", description: "Serverless compute" },
    { name: "Route53", icon: SiAmazonroute53 , color: "text-indigo-500", description: "DNS & traffic routing" },
    { name: "WebSockets", icon: TbApi, color: "text-pink-500", description: "Realtime communication" },
    { name: "Docker", icon: SiDocker, color: "text-blue-500", description: "Containerization" },
    { name: "Traefik", icon: SiTraefikproxy, color: "text-orange-600", description: "Edge router & proxy" },
    { name: "Nginx", icon: SiNginx, color: "text-green-700", description: "Web server & reverse proxy" },
    { name: "Node.js", icon: SiNodedotjs, color: "text-green-500", description: "JS runtime" },
    { name: "Redis", icon: SiRedis, color: "text-red-600", description: "In-memory cache" },
    { name: "PostgreSQL", icon: SiPostgresql, color: "text-blue-600", description: "Relational database" },
  ];


  // "4.9/5 Student Rating, based on 200+ reviews" used to sit here. Nothing
  // collects ratings or reviews anywhere in the platform, so the figure had no
  // source at all. The student count comes from the same endpoint as the band
  // above rather than being typed in.
  const achievements = [
    {
      icon: Users,
      title: platformStats ? `${formatCount(platformStats.students)} Students` : "Built for UFAZ",
      org: "Growing UFAZ Community",
    },
    { icon: Star, title: "Free for Students", org: "Every tool, no charge" },
    { icon: Shield, title: "Secure & Private", org: "Student Data Protection" },
    { icon: Rocket, title: "Open Source", org: "Built and maintained by students" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 overflow-x-hidden relative">
      {/* Custom Cursor */}
      <div
        ref={cursorRef}
        className="fixed w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full pointer-events-none z-50 opacity-50 hidden lg:block"
      />

      {/* Scroll Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gray-200/50 z-50">
        <div ref={progressBarRef} className="h-full bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600" />
      </div>

      {/* Floating Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div
          ref={(el) => (floatingElementsRef.current[0] = el)}
          className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-r from-blue-400/10 to-purple-400/10 rounded-full blur-3xl"
        />
        <div
          ref={(el) => (floatingElementsRef.current[1] = el)}
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-r from-green-400/10 to-blue-400/10 rounded-full blur-3xl"
        />
        <div
          ref={(el) => (floatingElementsRef.current[2] = el)}
          className="absolute top-1/3 right-1/4 w-64 h-64 bg-gradient-to-r from-purple-400/8 to-pink-400/8 rounded-full blur-2xl"
        />
        <div
          ref={(el) => (floatingElementsRef.current[3] = el)}
          className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-gradient-to-r from-cyan-400/8 to-blue-400/8 rounded-full blur-2xl"
        />
      </div>

      {/* Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
          isScrolled ? "bg-white/90 backdrop-blur-xl shadow-xl border-b border-white/20 py-3" : "bg-transparent py-4"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate("/")}>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <span className="text-xl sm:text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Ufazien
                </span>
                <div className="text-xs text-gray-500 font-medium">Student Success Platform</div>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-8">
              {[
                { name: "Features", href: "#features" },
                { name: "Analytics", href: "#stats" },
                { name: "Community", href: "#community" },
                { name: "About", href: "#about" },
              ].map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-gray-700 hover:text-blue-600 font-medium transition-all duration-300 hover:scale-105 relative group"
                >
                  {item.name}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 group-hover:w-full transition-all duration-300" />
                </a>
              ))}
            </nav>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {!isAuthenticated && (
                <button
                  onClick={() => navigate("/auth")}
                  className="hidden sm:block px-4 py-2 text-gray-700 hover:text-blue-600 font-medium transition-all duration-300"
                >
                  Sign In
                </button>
              )}

              <button
                onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-bold hover:shadow-xl transition-all duration-300 flex items-center gap-2 text-sm sm:text-base"
              >
                <Rocket className="w-4 h-4 sm:w-5 sm:h-5" />
                {isAuthenticated ? "Dashboard" : "Get Started"}
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors duration-300"
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="lg:hidden mt-4 py-4 border-t border-gray-200/50 backdrop-blur-xl">
              <div className="flex flex-col space-y-3">
                {[
                  { name: "Features", href: "#features" },
                  { name: "Analytics", href: "#stats" },
                  { name: "Community", href: "#community" },
                  { name: "About", href: "#about" },
                ].map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className="text-gray-700 hover:text-blue-600 font-medium py-2 transition-colors duration-300"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.name}
                  </a>
                ))}
                {!isAuthenticated && (
                  <div className="pt-3 border-t border-gray-200/50">
                    <button
                      onClick={() => {
                        navigate("/auth")
                        setIsMenuOpen(false)
                      }}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 rounded-xl font-bold"
                    >
                      Get Started
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Hero Badge */}
          <div className="inline-flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm border border-white/30 text-blue-700 px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm font-bold mb-6 sm:mb-8 hover:scale-105 transition-all duration-300 cursor-pointer group">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-spin group-hover:animate-pulse" />🎉 Welcome to the
            Future of UFAZ Education
            <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform duration-300" />
          </div>

          {/* Main Heading */}
          <h1
            ref={heroTitleRef}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black text-gray-900 mb-6 sm:mb-8 leading-tight"
          >
            Your Academic
            <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Success Revolution
            </span>
          </h1>

          {/* Subtitle */}
          <p
            ref={heroSubtitleRef}
            className="text-lg sm:text-xl md:text-2xl text-gray-600 mb-8 sm:mb-12 max-w-4xl mx-auto leading-relaxed px-4"
          >
            Transform your UFAZ journey with AI-powered tools, real-time collaboration, and comprehensive academic
            management designed for the next generation of students.
          </p>

          {/* CTA Buttons */}
          <div
            ref={heroButtonsRef}
            className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center mb-12 sm:mb-16 px-4"
          >
            <button
              onClick={() => navigate(isAuthenticated ? "/gpa-calculator" : "/auth")}
              className="group bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 sm:px-12 py-4 sm:py-6 rounded-xl sm:rounded-2xl font-black text-lg sm:text-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center gap-3 sm:gap-4"
            >
              <Calculator className="w-6 h-6 sm:w-7 sm:h-7 group-hover:rotate-12 transition-transform duration-300" />
              Start Calculating
              <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-2 transition-transform duration-300" />
            </button>
            <button className="group bg-white/80 backdrop-blur-sm border-2 border-gray-200 text-gray-700 px-8 sm:px-12 py-4 sm:py-6 rounded-xl sm:rounded-2xl font-black text-lg sm:text-xl hover:border-blue-300 hover:shadow-xl hover:bg-white transition-all duration-300 flex items-center justify-center gap-3 sm:gap-4">
              <Play className="w-5 h-5 sm:w-6 sm:h-6 group-hover:scale-125 transition-transform duration-300" />
              Watch Demo
            </button>
          </div>

          {/* Hero Stats */}
          <div id="stats" ref={statsRef} className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-6xl mx-auto px-4">
            {stats.map((stat, index) => (
              <div
                key={index}
                className="group bg-white/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 border border-white/30 hover:bg-white/80 hover:shadow-2xl hover:scale-105 transition-all duration-500 cursor-pointer"
              >
                <div className="flex items-center justify-center mb-3 sm:mb-4">
                  <div
                    className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-r ${
                      stat.color === "text-blue-600"
                        ? "from-blue-500 to-cyan-500"
                        : stat.color === "text-green-600"
                          ? "from-green-500 to-emerald-500"
                          : stat.color === "text-purple-600"
                            ? "from-purple-500 to-pink-500"
                            : "from-orange-500 to-red-500"
                    }`}
                  >
                    <stat.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 mb-1 sm:mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600 font-bold mb-1 sm:mb-2 text-sm sm:text-base">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FeaturesSection
        features={features}
        technologies={technologies}
        featuresRef={featuresRef}
        navigate={navigate}
      />

      <TestimonialsSection
        testimonials={testimonials}
        currentTestimonial={currentTestimonial}
        setCurrentTestimonial={setCurrentTestimonial}
        testimonialsRef={testimonialsRef}
      />

      <AchievementsSection achievements={achievements} />

      {/* Community CTA Section */}
      <section ref={ctaRef} id="community" className="py-16 sm:py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600" />
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white/10 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-8 sm:p-12 lg:p-16 border border-white/20">
            <div className="flex items-center justify-center gap-4 mb-6 sm:mb-8">
              <Users className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-red-400 animate-pulse" />
              <Globe className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 sm:mb-8">
              Join the UFAZIEN Revolution
            </h2>
            <p className="text-lg sm:text-xl lg:text-2xl text-blue-100 mb-8 sm:mb-12 max-w-4xl mx-auto leading-relaxed">
              Connect with hundreds of UFAZ students, share knowledge, collaborate on projects, and build the future of
              education together in our thriving community.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 lg:gap-8 justify-center mb-8 sm:mb-12 lg:mb-16">
              <button
                onClick={() => navigate("/community")}
                className="group bg-white text-blue-600 px-8 sm:px-10 lg:px-12 py-4 sm:py-5 lg:py-6 rounded-xl sm:rounded-2xl font-black text-lg sm:text-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center gap-3 sm:gap-4"
              >
                <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 group-hover:rotate-12 transition-transform duration-300" />
                Join Study Groups
                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-2 transition-transform duration-300" />
              </button>
              <button
                onClick={() => navigate("/blog")}
                className="group border-2 border-white text-white px-8 sm:px-10 lg:px-12 py-4 sm:py-5 lg:py-6 rounded-xl sm:rounded-2xl font-black text-lg sm:text-xl hover:bg-white hover:text-blue-600 transition-all duration-300 flex items-center justify-center gap-3 sm:gap-4"
              >
                <PenTool className="w-6 h-6 sm:w-7 sm:h-7 group-hover:rotate-12 transition-transform duration-300" />
                Start Writing
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 group-hover:rotate-180 transition-transform duration-300" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 text-blue-100">
              <div className="flex items-center justify-center gap-3">
                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-400" />
                <span className="font-bold text-sm sm:text-base lg:text-lg">Free Forever</span>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
                <span className="font-bold text-sm sm:text-base lg:text-lg">Secure & Private</span>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Target className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400" />
                <span className="font-bold text-sm sm:text-base lg:text-lg">UFAZ Students Only</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 sm:py-16 lg:py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-blue-900/30 to-purple-900/30" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12 mb-12 sm:mb-16">
            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-4 mb-6 sm:mb-8">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl">
                  <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl font-black">Ufazien</span>
                  <div className="text-sm text-gray-400">Student Success Platform</div>
                </div>
              </div>
              <p className="text-gray-400 mb-6 sm:mb-8 max-w-md leading-relaxed text-sm sm:text-base lg:text-lg">
                Empowering UFAZ students with cutting-edge tools, AI-powered insights, and collaborative features to
                excel in their academic journey and beyond.
              </p>
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-gray-400 text-sm sm:text-base">Built and maintained by UFAZ students</span>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-black mb-6 sm:mb-8 text-lg sm:text-xl">Quick Access</h3>
              <div className="space-y-3 sm:space-y-4">
                {[
                  { name: "Analytics Dashboard", link: "/dashboard" },
                  { name: "GPA Calculator", link: "/gpa-calculator" },
                  { name: "Average Calculator", link: "/average-calculator" },
                  { name: "Academic Calendar", link: "/calendar" },
                  { name: "Ufazien Hosting", link: "/hosting" },
                  { name: "Blog Platform", link: "/blog" },
                  { name: "AI Tools", link: "/ai-tools" },
                ].map((item) => (
                  <a
                    key={item.name}
                    href={item.link}
                    className="block text-gray-400 hover:text-white transition-all duration-300 hover:translate-x-2 transform font-medium text-sm sm:text-base"
                  >
                    {item.name}
                  </a>
                ))}
              </div>
            </div>

            {/* Support */}
            <div>
              <h3 className="font-black mb-6 sm:mb-8 text-lg sm:text-xl">Support</h3>
              <div className="space-y-3 sm:space-y-4">
                {[
                  {name:"Help Center", link:"/help"},
                  {name:"Contact Us", link:"/contact"},
                  {name:"Privacy Policy", link:"/privacy"},
                  {name:"Terms of Service", link:"/terms"},
                  {name:"API Documentation", link:"https://api.ufazien.com/api/docs"},
                  {name:"System Status", link:"/status"},
                ].map((item) => (
                  <a
                    key={item.name}
                    href={item.link}
                    className="block text-gray-400 hover:text-white transition-all duration-300 hover:translate-x-2 transform font-medium text-sm sm:text-base"
                  >
                    {item.name}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="border-t border-gray-800 pt-8 sm:pt-12 flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8">
            <div className="text-gray-500 text-center lg:text-left text-sm sm:text-base">
              &copy; {new Date().getFullYear()} Ufazien.com - Crafted with ❤️ for UFAZ students
            </div>

            <div className="flex items-center gap-6 sm:gap-8">
              {/* Social Links */}
              <div className="flex items-center gap-3 sm:gap-4">
                {[
                  { icon: Github, href: "https://github.com/martian56" },
                  { icon: Twitter, href: "https://twitter.com/martian588" },
                  { icon: Linkedin, href: "https://www.linkedin.com/in/martian58" },
                  { icon: Instagram, href: "https://instagram.com/ufaz.university" },
                ].map((social, index) => (
                  <a
                    key={index}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-800 hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-600 rounded-lg sm:rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110"
                  >
                    <social.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </a>
                ))}
              </div>

              {/* Version & Stats */}
              <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Layers className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>v3.0.0</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Open Source</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
