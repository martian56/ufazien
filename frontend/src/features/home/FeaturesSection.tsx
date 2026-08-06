import { ArrowRight } from "lucide-react"

import type React from "react"

interface Feature {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  link: string
  color: string
  featured?: boolean
  stats?: string
}

interface Technology {
  name: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  description: string
}

interface FeaturesSectionProps {
  features: Feature[]
  technologies: Technology[]
  featuresRef: React.RefObject<HTMLDivElement | null>
  navigate: (path: string) => void
}


export default function FeaturesSection({ features, technologies, featuresRef, navigate }: FeaturesSectionProps) {
  return (
    <>
    <section id="features" className="py-20 sm:py-28 bg-gray-50 border-y border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 mb-4">
            What is in it
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            Nine tools, all free. Most of them exist because somebody needed them for a
            deadline and there was nothing that fit UFAZ.
          </p>
        </div>

        <div ref={featuresRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature) => (
            <button
              key={feature.title}
              type="button"
              onClick={() => navigate(feature.link)}
              className="feature-card cursor-pointer text-left bg-white rounded-xl p-6 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-50 mb-4">
                <feature.icon className="w-5 h-5 text-blue-600" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">{feature.description}</p>
              <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="text-xs text-gray-500">{feature.stats}</span>
                <span className="flex items-center gap-1.5 text-blue-600 text-sm font-medium">
                  Open
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-20">
          <h3 className="text-sm font-medium text-gray-500 mb-6 text-center">
            What it runs on
          </h3>
          <div className="flex flex-wrap justify-center gap-2">
            {technologies.map((tech) => (
              <div
                key={tech.name}
                className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200"
              >
                <tech.icon className={`w-4 h-4 ${tech.color}`} aria-hidden="true" />
                <span className="text-sm text-gray-700">{tech.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
    </>
  )
}
