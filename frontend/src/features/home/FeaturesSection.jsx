import { ChevronRight, Zap } from "lucide-react"

export default function FeaturesSection({ features, technologies, featuresRef, navigate }) {
  return (
    <>
    {/* Features Section */}
    <section id="features" className="py-16 sm:py-24 lg:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16 lg:mb-20">
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-700 px-4 sm:px-6 py-2 sm:py-3 rounded-full text-sm font-bold mb-6 sm:mb-8">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
            Powerful Features
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 mb-6 sm:mb-8">
            Everything You Need to
            <span className="block bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Excel at UFAZ
            </span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
            Cutting-edge tools and features designed to transform your academic journey with AI-powered insights,
            seamless collaboration, and intelligent automation.
          </p>
        </div>

        {/* Features Grid */}
        <div ref={featuresRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="feature-card group cursor-pointer bg-white/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/30 hover:bg-white hover:shadow-2xl hover:scale-105 transition-all duration-500"
              onClick={() => navigate(feature.link)}
            >
              <div className="flex items-start gap-4 sm:gap-6">
                <div
                  className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center bg-gradient-to-r ${feature.color} shadow-xl group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 sm:mb-3">
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-gray-900">{feature.title}</h3>
                    {feature.badge && (
                      <span className="px-2 py-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-bold rounded-full">
                        {feature.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base leading-relaxed">
                    {feature.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-bold text-gray-500">{feature.stats}</span>
                    <div className="flex items-center gap-2 text-blue-600 font-bold group-hover:gap-3 transition-all duration-300">
                      <span className="text-sm">Explore</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Technology Stack */}
        <div className="text-center mt-16 sm:mt-20 lg:mt-24">
          <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mb-8 sm:mb-12">
            Built with Cutting-Edge Technology
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
            {technologies.map((tech, index) => (
              <div
                key={index}
                className="group bg-white/60 backdrop-blur-sm p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-white/30 hover:bg-white hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer"
              >
                <div className="flex flex-col items-center gap-2 sm:gap-3">
                  <div
                    className={`p-2 sm:p-3 rounded-lg sm:rounded-xl bg-gradient-to-r ${
                      tech.color === "text-blue-500"
                        ? "from-blue-500 to-cyan-500"
                        : tech.color === "text-green-500"
                          ? "from-green-500 to-emerald-500"
                          : tech.color === "text-purple-500"
                            ? "from-purple-500 to-pink-500"
                            : tech.color === "text-cyan-500"
                              ? "from-cyan-500 to-blue-500"
                              : tech.color === "text-pink-500"
                                ? "from-pink-500 to-red-500"
                                : "from-indigo-500 to-purple-500"
                    }`}
                  >
                    <tech.icon className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-gray-900 text-sm sm:text-base">{tech.name}</div>
                    <div className="text-xs text-gray-500">{tech.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
    </>
  )
}
