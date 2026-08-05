import { CheckCircle, Heart, Star } from "lucide-react"

export default function TestimonialsSection({ testimonials, currentTestimonial, setCurrentTestimonial, testimonialsRef }) {
  return (
    <>
    {/* Testimonials Section */}
    <section
      ref={testimonialsRef}
      className="py-16 sm:py-24 lg:py-32 bg-gradient-to-r from-blue-50 to-purple-50 relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16 lg:mb-20">
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-green-500/10 to-blue-500/10 text-green-700 px-4 sm:px-6 py-2 sm:py-3 rounded-full text-sm font-bold mb-6 sm:mb-8">
            <Heart className="w-4 h-4 sm:w-5 sm:h-5" />
            Student Success Stories
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 mb-6 sm:mb-8">
            What UFAZ Students
            <span className="block bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              Are Saying
            </span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
            Join hundreds of UFAZ students who have transformed their academic journey with Ufazien
          </p>
        </div>

        {/* Testimonial Carousel */}
        <div className="relative max-w-4xl mx-auto">
          <div className="testimonial-card bg-white/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-8 sm:p-12 shadow-2xl border border-white/30">
            <div className="text-center">
              {/* Stars */}
              <div className="flex justify-center gap-1 mb-6 sm:mb-8">
                {[...Array(testimonials[currentTestimonial].rating)].map((_, i) => (
                  <Star key={i} className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 fill-current" />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 leading-relaxed">
                "{testimonials[currentTestimonial].content}"
              </blockquote>

              {/* Author */}
              <div className="flex items-center justify-center gap-4">
                <img
                  src={testimonials[currentTestimonial].avatar || "/placeholder.svg"}
                  alt={testimonials[currentTestimonial].name}
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 border-white shadow-lg"
                />
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-gray-900 text-sm sm:text-base">
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
          <div className="flex justify-center gap-3 mt-6 sm:mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentTestimonial(index)}
                className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-300 ${
                  currentTestimonial === index ? "bg-blue-600 scale-125" : "bg-gray-300 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
    </>
  )
}
