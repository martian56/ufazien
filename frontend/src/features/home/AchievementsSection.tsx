import type React from "react"

interface Achievement {
  icon: React.ComponentType<{ className?: string }>
  title: string
  org: string
}

interface AchievementsSectionProps {
  achievements: Achievement[]
}

export default function AchievementsSection({ achievements }: AchievementsSectionProps) {
  return (
    <>
    {/* Achievements Section */}
    <section className="py-16 sm:py-24 lg:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16 lg:mb-20">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 mb-6 sm:mb-8">
            Recognized Excellence
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
            Our commitment to student success has been recognized by leading educational institutions and technology
            organizations
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {achievements.map((achievement, index) => (
            <div
              key={index}
              className="group bg-white/60 backdrop-blur-sm rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-white/30 hover:bg-white hover:shadow-xl hover:scale-105 transition-all duration-300 text-center"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                <achievement.icon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <h3 className="font-black text-gray-900 mb-2 text-sm sm:text-base">{achievement.title}</h3>
              <p className="text-gray-600 text-xs sm:text-sm">{achievement.org}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
    </>
  )
}
