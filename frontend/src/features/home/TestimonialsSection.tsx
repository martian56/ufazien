import { CheckCircle, Heart, Star } from "lucide-react"

import type React from "react"

interface Testimonial {
  name: string
  role: string
  avatar: string
  content: string
  rating: number
  verified?: boolean
}

interface TestimonialsSectionProps {
  testimonials: Testimonial[]
  currentTestimonial: number
  setCurrentTestimonial: (index: number) => void
  testimonialsRef: React.RefObject<HTMLDivElement | null>
}


export default function TestimonialsSection({ testimonials, currentTestimonial, setCurrentTestimonial, testimonialsRef }: TestimonialsSectionProps) {
  return (
    <>
    {/* Testimonials Section */}
    <section
      ref={testimonialsRef}
      className="py-20 sm:py-28"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Was "Join hundreds of UFAZ students", with the real count sitting
            in the stat strip further up the same page. */}
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 mb-10 max-w-2xl">
          What students say
        </h2>

        {/* Testimonial Carousel */}
        <div className="relative max-w-3xl">
          <div className="testimonial-card bg-white rounded-xl p-8 sm:p-10 border border-gray-200">
            <div>
              {/* Stars */}
              <div className="flex gap-1 mb-5" aria-label={`${testimonials[currentTestimonial].rating} out of 5`}>
                {[...Array(testimonials[currentTestimonial].rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-amber-400 fill-current" aria-hidden="true" />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-lg sm:text-xl text-gray-900 mb-8 leading-relaxed">
                "{testimonials[currentTestimonial].content}"
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-3">
                <img
                  src={testimonials[currentTestimonial].avatar || "/placeholder.svg"}
                  alt={testimonials[currentTestimonial].name}
                  loading="lazy"
                  className="w-11 h-11 rounded-full object-cover"
                />
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900 text-sm sm:text-base">
                      {testimonials[currentTestimonial].name}
                    </h4>
                    {testimonials[currentTestimonial].verified && (
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                    )}
                  </div>
                  <p className="text-gray-600 text-sm sm:text-base">{testimonials[currentTestimonial].role}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Dots */}
          <div className="flex gap-2 mt-6">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentTestimonial(index)}
                aria-label={`Show testimonial ${index + 1}`}
                aria-current={currentTestimonial === index}
                // The dot stays 8px; the padding is what makes the tap target
                // big enough to hit on a phone.
                className="cursor-pointer w-11 h-11 -m-1.5 flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <span
                  className={`block w-2 h-2 rounded-full transition-colors duration-200 ${
                    currentTestimonial === index ? "bg-blue-600" : "bg-gray-300 hover:bg-gray-400"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
    </>
  )
}
