"use client"

import { useEffect, useState, useRef } from "react"
import { formatCount, usePlatformStats } from "../features/home/usePlatformStats"
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
  Instagram, Layers, House, SwatchBook, Gamepad2
} from "lucide-react"

import {
  SiReact, SiDjango, SiPostgresql, SiDocker,
  SiTraefikproxy, SiNginx, SiRedis, SiWebrtc, SiHetzner
} from "react-icons/si";
import { TbApi } from "react-icons/tb";
import UfazienMark from "../components/ui/UfazienMark"
// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, TextPlugin)

/** Kept in step with the `testimonials` array below. */
const TESTIMONIAL_COUNT = 3

export default function Home() {
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Refs for GSAP animations
  const heroRef = useRef<HTMLDivElement>(null)
  const heroTitleRef = useRef<HTMLDivElement>(null)
  const heroSubtitleRef = useRef<HTMLDivElement>(null)
  const heroButtonsRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLDivElement>(null)
  const testimonialsRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)

  // Check authentication status
  useEffect(() => {
    const accessToken = localStorage.getItem("access")
    setIsAuthenticated(!!accessToken)
  }, [])

  // GSAP Animations Setup
  useEffect(() => {
    // fromTo, never from. A from() tween records whatever the element reads as
    // at creation time as its end value, and StrictMode mounts the effect
    // twice: the second pass read the mid-tween opacity of 0 and animated
    // 0 -> 0, so both hero CTA buttons sat invisible on the live site.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const ctx = gsap.context(() => {
      // `y` is the distance to rise from and must not reach the end vars: a
      // spread that carried it through set the destination to the start offset
      // too, so everything animated from y:60 to y:60 and stayed displaced.
      const rise = (
        targets: gsap.TweenTarget,
        { y = 40, ...vars }: gsap.TweenVars & { y?: number } = {},
      ) =>
        gsap.fromTo(
          targets,
          { y, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", ...vars, overwrite: "auto" },
        )

      if (reduced) {
        // Land everything in its final state and skip the motion entirely.
        gsap.set(
          [heroTitleRef.current, heroSubtitleRef.current, heroButtonsRef.current],
          { clearProps: "all" },
        )
      } else {
        const tl = gsap.timeline()
        tl.add(rise(heroTitleRef.current, { y: 60, duration: 1 }))
          .add(rise(heroSubtitleRef.current, { y: 30 }), "-=0.7")
          .add(rise(heroButtonsRef.current!.children, { y: 20, stagger: 0.12 }), "-=0.55")
      }

      // Section entrances. once: true, so a section settles instead of
      // replaying every time it scrolls back into view.
      const onEnter = (
        trigger: Element | null,
        targets: gsap.TweenTarget,
        vars?: gsap.TweenVars & { y?: number },
      ) => {
        if (!trigger || reduced) return
        ScrollTrigger.create({
          trigger,
          start: "top 85%",
          once: true,
          onEnter: () => rise(targets, vars),
        })
      }

      onEnter(statsRef.current, statsRef.current!.children, { stagger: 0.08 })
      onEnter(featuresRef.current, featuresRef.current!.querySelectorAll(".feature-card"), { stagger: 0.05, duration: 0.5, y: 24 })
      onEnter(testimonialsRef.current, testimonialsRef.current!.querySelector(".testimonial-card"))
      onEnter(ctaRef.current, ctaRef.current!.children, { stagger: 0.12 })
    }, heroRef.current ?? undefined)

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

  // Rotate the testimonials. The sibling interval that drove `currentFeature`
  // is gone: nothing read it, so it re-rendered the whole page every 5s for
  // nothing. Eight seconds rather than four, because four is not long enough
  // to finish reading a quote.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % TESTIMONIAL_COUNT)
    }, 8000)
    return () => clearInterval(id)
  }, [])

  // No `badge` field any more. Every card carried one ("Trending", "Most
  // Popular", "Pro Feature") and none of them meant anything; "Pro Feature"
  // advertised a paid tier that does not exist.
  const features = [
    {
      icon: Calculator,
      title: "GPA Calculator",
      description:
        "Enter your semester or yearly averages and get a GPA on the 4.0 scale, converted from the UFAZ 20-point system.",
      link: "/gpa-calculator",
      color: "",
      stats: "20-point scale",
    },
    {
      icon: TrendingUp,
      title: "Average Calculator",
      description:
        "Build a weighted schema for a course, fill in your marks, and share the schema with your year if it is useful.",
      link: "/average-calculator",
      color: "",
      stats: "Shareable schemas",
    },
    {
      icon: House,
      title: "Website Hosting",
      description:
        "A subdomain, a database and SSL for a student project. Upload a zip or point it at a Git repository.",
      link: "/hosting",
      color: "",
      stats: "Free tier with SSL",
    },
    {
      icon: BarChart3,
      title: "User Sites",
      description: "A directory of what other students have built and hosted here.",
      link: "/user-sites",
      color: "",
      stats: "Public directory",
    },
    {
      icon: PenTool,
      title: "Blog",
      description:
        "Write posts with a rich editor, save drafts, schedule publishing, and choose who can read each one.",
      link: "/blog",
      color: "",
      stats: "Drafts and scheduling",
    },
    {
      icon: MessageCircle,
      title: "Community",
      description:
        "Study groups with real-time chat, and forums for the questions that come round every semester.",
      link: "/community",
      color: "",
      stats: "Groups and forums",
    },
    {
      icon: Brain,
      title: "AI Tools",
      description: "A humanizer, a paraphraser, a summarizer and a grammar checker.",
      link: "/ai-tools",
      color: "",
      stats: "Four tools",
    },
    {
      icon: Calendar,
      title: "Calendar",
      description:
        "Classes, exams and deadlines in one place, with CSV export when you want them elsewhere.",
      link: "/calendar",
      color: "",
      stats: "CSV export",
    },
    {
      icon: Gamepad2,
      title: "Campus Simulator",
      description:
        "A 3D campus you can walk around with other students, with voice that fades in as you get closer.",
      link: "/campus-simulator",
      color: "",
      stats: "Proximity voice",
    },
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
      role: "Computer Science, 3rd Year",
      avatar: "https://ik.imagekit.io/ufazien/testimonials/valiyyaddin_aliyev.jpeg?updatedAt=1756362329574",
      content:
        "The Hosting service with free tier is a game changer for me. It allows me to experiment with my projects without worrying about costs.",
      rating: 5,
      verified: true,
    },
  ]

  // Was AWS, EC2, Aurora, Lambda and Route53, none of which this has run on
  // since the move to Hetzner. Also gone: "AI/ML" with a TensorFlow logo, and
  // "Mobile", neither of which exists.
  const technologies = [
    { name: "React", icon: SiReact, color: "text-sky-500", description: "" },
    { name: "Django", icon: SiDjango, color: "text-green-700", description: "" },
    { name: "PostgreSQL", icon: SiPostgresql, color: "text-blue-700", description: "" },
    { name: "Redis", icon: SiRedis, color: "text-red-600", description: "" },
    { name: "WebSockets", icon: TbApi, color: "text-gray-600", description: "" },
    { name: "WebRTC", icon: SiWebrtc, color: "text-gray-700", description: "" },
    { name: "Docker", icon: SiDocker, color: "text-blue-500", description: "" },
    { name: "Traefik", icon: SiTraefikproxy, color: "text-orange-600", description: "" },
    { name: "Nginx", icon: SiNginx, color: "text-green-700", description: "" },
    { name: "Hetzner", icon: SiHetzner, color: "text-red-600", description: "" },
  ];


  // "4.9/5 Student Rating, based on 200+ reviews" used to sit here. Nothing
  // collects ratings or reviews anywhere in the platform, so the figure had no
  // source at all. The student count comes from the same endpoint as the band
  // above rather than being typed in.

  return (
    <div className="min-h-screen bg-white overflow-x-hidden relative">
      {/* Scroll Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gray-200/50 z-50">
        <div ref={progressBarRef} className="h-full w-0 bg-blue-600" />
      </div>

      {/* Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 border-b transition-[background-color,border-color,padding] duration-300 ${
          isScrolled
            ? "bg-white/90 backdrop-blur-xl border-gray-200 py-3"
            : "bg-transparent border-transparent py-4"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2.5 rounded-lg cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
              aria-label="Ufazien home"
            >
              <UfazienMark className="w-8 h-8" />
              <span className="text-xl font-semibold tracking-tight text-gray-900">Ufazien</span>
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-8">
              {[
                { name: "Features", href: "#features" },
                { name: "Community", href: "#community" },
                { name: "Blog", href: "/blog" },
              ].map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200 relative group"
                >
                  {item.name}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-200" />
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
                className="cursor-pointer bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {isAuthenticated ? "Dashboard" : "Get Started"}
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={isMenuOpen}
                className="cursor-pointer lg:hidden p-2.5 rounded-lg hover:bg-gray-100 transition-colors duration-200"
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
                  { name: "Community", href: "#community" },
                  { name: "Blog", href: "/blog" },
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
                      className="cursor-pointer w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200"
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
      <section ref={heroRef} className="relative pt-28 pb-20 sm:pt-32 sm:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1
            ref={heroTitleRef}
            className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.1] text-gray-900 mb-8 max-w-4xl mx-auto"
          >
            Grade tools built for UFAZ
          </h1>

          <p
            ref={heroSubtitleRef}
            className="text-lg sm:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            GPA and weighted average calculators that use the 20-point French system, plus
            hosting, a blog and a community for UFAZ students. Free, and it stays that way.
          </p>

          <div ref={heroButtonsRef} className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
            <button
              onClick={() => navigate(isAuthenticated ? "/gpa-calculator" : "/auth")}
              className="cursor-pointer bg-blue-600 text-white px-6 py-3.5 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Calculator className="w-5 h-5" aria-hidden="true" />
              Open the calculator
            </button>
            <button
              onClick={() => navigate("/blog")}
              className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-6 py-3.5 rounded-lg font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Browse the blog
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Hero Stats */}
          <div
            id="stats"
            ref={statsRef}
            className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto"
          >
            {stats.slice(0, 4).map((stat) => (
              <div
                key={stat.label}
                className="bg-white border border-gray-200 rounded-lg px-5 py-4 text-center min-w-[9rem] flex-1 sm:flex-none"
              >
                <div className="text-2xl font-semibold text-gray-900 tabular-nums">{stat.number}</div>
                <div className="text-sm text-gray-500 mt-0.5">{stat.label}</div>
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

      {/* Community CTA Section */}
      <section ref={ctaRef} id="community" className="py-20 sm:py-28 bg-blue-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-5">
            There is a community behind it too
          </h2>
          <p className="text-lg text-blue-100 mb-10 leading-relaxed">
            Study groups with real-time chat, forums for the questions that come up every
            semester, and a blog anyone can write on.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
            <button
              onClick={() => navigate("/community")}
              className="cursor-pointer bg-white text-blue-700 px-6 py-3.5 rounded-lg font-medium hover:bg-blue-50 transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <MessageCircle className="w-5 h-5" aria-hidden="true" />
              Join a study group
            </button>
            <button
              onClick={() => navigate("/blog")}
              className="cursor-pointer border border-blue-400 text-white px-6 py-3.5 rounded-lg font-medium hover:bg-blue-500 transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <PenTool className="w-5 h-5" aria-hidden="true" />
              Write a post
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-blue-100 text-sm">
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" aria-hidden="true" />
              Free, with no paid tier
            </span>
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4" aria-hidden="true" />
              Your grades stay private
            </span>
            <span className="flex items-center gap-2">
              <Target className="w-4 h-4" aria-hidden="true" />
              Built for UFAZ
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-14 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <UfazienMark className="w-8 h-8" />
                <span className="text-xl font-semibold">Ufazien</span>
              </div>
              <p className="text-gray-400 max-w-md leading-relaxed">
                Grade calculators, hosting, a blog and a community for students at the
                French-Azerbaijani University. Built and maintained by UFAZ students.
              </p>
            </div>

            <div>
              <h3 className="font-medium mb-4 text-sm text-gray-300">Tools</h3>
              <div className="space-y-2.5">
                {[
                  { name: "GPA Calculator", link: "/gpa-calculator" },
                  { name: "Average Calculator", link: "/average-calculator" },
                  { name: "Calendar", link: "/calendar" },
                  { name: "Hosting", link: "/hosting" },
                  { name: "Blog", link: "/blog" },
                  { name: "Community", link: "/community" },
                  { name: "AI Tools", link: "/ai-tools" },
                ].map((item) => (
                  <a
                    key={item.name}
                    href={item.link}
                    className="block text-gray-400 hover:text-white transition-colors duration-200 text-sm"
                  >
                    {item.name}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-4 text-sm text-gray-300">More</h3>
              <div className="space-y-2.5">
                {/* /help, /contact and /status were listed here and none of the
                    three had a route, so all three landed on the 404 page. */}
                {[
                  { name: "Feedback", link: "/feedback" },
                  { name: "Privacy Policy", link: "/privacy" },
                  { name: "Terms of Service", link: "/terms" },
                  { name: "API Documentation", link: "https://api.ufazien.com/api/docs" },
                  { name: "Source on GitHub", link: "https://github.com/martian56/ufazien" },
                ].map((item) => (
                  <a
                    key={item.name}
                    href={item.link}
                    className="block text-gray-400 hover:text-white transition-colors duration-200 text-sm"
                  >
                    {item.name}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} Ufazien.com
            </div>

            <div className="flex items-center gap-2">
              {[
                { icon: Github, href: "https://github.com/martian56", label: "GitHub" },
                { icon: Twitter, href: "https://twitter.com/martian588", label: "Twitter" },
                { icon: Linkedin, href: "https://www.linkedin.com/in/martian58", label: "LinkedIn" },
                { icon: Instagram, href: "https://instagram.com/ufaz.university", label: "Instagram" },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors duration-200"
                >
                  <social.icon className="w-4 h-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
