import { useEffect } from 'react'
import { BookOpen, Shield, Users, Calendar, Calculator, TrendingUp, PenTool, Brain, MessageCircle, Globe, ChevronRight } from 'lucide-react'

export default function Terms() {
  useEffect(() => {
    document.title = 'Terms of Service - Ufazien'
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
            </div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              These terms govern your use of Ufazien's academic platform and services
            </p>
            <div className="mt-4 text-sm text-gray-500">
              Last updated: September 7, 2025
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          
          {/* 1. Acceptance of Terms */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-blue-600" />
              1. Acceptance of Terms
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                By accessing and using Ufazien (the "Platform"), you accept and agree to be bound by these Terms of Service ("Terms"). 
                If you do not agree to these Terms, please do not use our services.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Ufazien is an academic platform providing educational tools, collaboration features, and hosting services to enhance your learning and development experience.
              </p>
            </div>
          </section>

          {/* 2. Service Description */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-600" />
              2. Our Services
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-6">
                Ufazien provides the following services to UFAZ students:
              </p>
              
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-blue-600" />
                    Academic Tools (Free)
                  </h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• GPA Calculator with UFAZ 20-point system</li>
                    <li>• Average Calculator with weighted grades</li>
                    <li>• Academic performance analytics</li>
                    <li>• Grade prediction and planning tools</li>
                  </ul>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-600" />
                    AI Tools (Free)
                  </h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Text humanizer and summarizer</li>
                    <li>• Language translator</li>
                    <li>• Research assistant</li>
                    <li>• Academic writing tools</li>
                  </ul>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                    Community Features (Free)
                  </h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Study groups and chat rooms</li>
                    <li>• Course-specific discussions</li>
                    <li>• Peer-to-peer collaboration</li>
                    <li>• Real-time messaging</li>
                  </ul>
                </div>

                <div className="bg-orange-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <PenTool className="w-5 h-5 text-orange-600" />
                    Content Creation (Free)
                  </h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Blog platform with rich editor</li>
                    <li>• Academic calendar management</li>
                    <li>• Project showcasing</li>
                    <li>• Portfolio building</li>
                  </ul>
                </div>
              </div>

              <div className="bg-indigo-50 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-600" />
                  Hosting Services (Free & Paid Tiers)
                </h3>
                
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <h4 className="font-bold text-gray-900 mb-3 text-green-600">Free Plan</h4>
                    <div className="text-sm text-gray-700 space-y-2">
                      <div className="flex justify-between"><span>Websites:</span> <strong>5</strong></div>
                      <div className="flex justify-between"><span>Databases:</span> <strong>5</strong></div>
                      <div className="flex justify-between"><span>Storage:</span> <strong>1 GB</strong></div>
                      <div className="flex justify-between"><span>Bandwidth:</span> <strong>10 GB</strong></div>
                      <div className="flex justify-between"><span>SSL:</span> <strong>✓</strong></div>
                      <div className="flex justify-between"><span>Support:</span> <strong>Community</strong></div>
                      <div className="flex justify-between"><span>Backups:</span> <strong>Manual only</strong></div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 border-2 border-blue-500 relative">
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                      Most Popular
                    </div>
                    <h4 className="font-bold text-gray-900 mb-3 text-blue-600">Developer - $5/month</h4>
                    <div className="text-sm text-gray-700 space-y-2">
                      <div className="flex justify-between"><span>Websites:</span> <strong>10</strong></div>
                      <div className="flex justify-between"><span>Databases:</span> <strong>10</strong></div>
                      <div className="flex justify-between"><span>Storage:</span> <strong>10 GB</strong></div>
                      <div className="flex justify-between"><span>Bandwidth:</span> <strong>100 GB</strong></div>
                      <div className="flex justify-between"><span>SSL:</span> <strong>✓</strong></div>
                      <div className="flex justify-between"><span>Support:</span> <strong>Email</strong></div>
                      <div className="flex justify-between"><span>Backups:</span> <strong>Daily automated</strong></div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <h4 className="font-bold text-gray-900 mb-3 text-purple-600">Pro - $10/month</h4>
                    <div className="text-sm text-gray-700 space-y-2">
                      <div className="flex justify-between"><span>Websites:</span> <strong>25</strong></div>
                      <div className="flex justify-between"><span>Databases:</span> <strong>25</strong></div>
                      <div className="flex justify-between"><span>Storage:</span> <strong>50 GB</strong></div>
                      <div className="flex justify-between"><span>Bandwidth:</span> <strong>500 GB</strong></div>
                      <div className="flex justify-between"><span>SSL:</span> <strong>✓</strong></div>
                      <div className="flex justify-between"><span>Support:</span> <strong>Priority</strong></div>
                      <div className="flex justify-between"><span>Backups:</span> <strong>Daily automated</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3. User Eligibility */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Shield className="w-6 h-6 text-blue-600" />
              3. User Eligibility
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                Ufazien is available to anyone who wishes to use our educational and development tools. 
                By using our platform, you represent that:
              </p>
              <ul className="text-gray-700 space-y-2 mb-4">
                <li>• You are at least 13 years of age</li>
                <li>• You have the authority to enter into this agreement</li>
                <li>• You will provide accurate and complete information</li>
                <li>• You will use the platform responsibly and respectfully</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                We welcome students, educators, developers, and anyone interested in learning and collaboration.
              </p>
            </div>
          </section>

          {/* 4. Account Responsibilities */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-600" />
              4. Account Responsibilities
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                You are responsible for maintaining the confidentiality of your account credentials and for all activities 
                that occur under your account. You agree to:
              </p>
              <ul className="text-gray-700 space-y-2 mb-4">
                <li>• Keep your login information secure and confidential</li>
                <li>• Notify us immediately of any unauthorized use</li>
                <li>• Use the platform respectfully and responsibly</li>
                <li>• Respect intellectual property rights</li>
                <li>• Maintain respectful communication in community features</li>
                <li>• Not share your account with others</li>
                <li>• Ensure content posted on hosted websites and community areas is appropriate</li>
              </ul>
            </div>
          </section>

          {/* 5. Hosting Services & Subscriptions */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Globe className="w-6 h-6 text-blue-600" />
              5. Hosting Services & Subscriptions
            </h2>
            <div className="prose prose-gray max-w-none">
              
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Free Hosting Tier</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Our free hosting tier is provided at no cost and includes basic website hosting with reasonable usage limits. 
                We reserve the right to modify or discontinue free services with 30 days notice.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mb-3">Paid Subscriptions</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Paid hosting subscriptions are billed monthly or annually. By subscribing, you agree to:
              </p>
              <ul className="text-gray-700 space-y-2 mb-6">
                <li>• Pay all subscription fees on time</li>
                <li>• Automatic renewal unless cancelled</li>
                <li>• Usage within specified limits</li>
                <li>• Compliance with acceptable use policies</li>
              </ul>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ChevronRight className="w-5 h-5 text-yellow-600" />
                  Refund Policy for Hosting Subscriptions
                </h4>
                <div className="text-gray-700 space-y-2">
                  <p><strong>Monthly Subscriptions:</strong> Full refund available within 7 days of purchase if no resources have been used.</p>
                  <p><strong>Annual Subscriptions:</strong> Prorated refund available within 30 days of purchase, minus any resources used.</p>
                  <p><strong>Cancellation:</strong> You may cancel anytime. Service continues until the end of your billing period.</p>
                  <p><strong>Refund Process:</strong> Refund requests must be submitted through our support system and will be processed within 5-10 business days.</p>
                  <p><strong>No Refund Scenarios:</strong> Violation of terms, excessive resource usage, or requests after the specified refund period.</p>
                </div>
              </div>
            </div>
          </section>

          {/* 6. Acceptable Use */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Shield className="w-6 h-6 text-blue-600" />
              6. Acceptable Use Policy
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                You agree not to use our platform for:
              </p>
              <ul className="text-gray-700 space-y-2 mb-4">
                <li>• Illegal activities or content that violates laws</li>
                <li>• Harassment, bullying, or discriminatory behavior</li>
                <li>• Spam, malware, or malicious software</li>
                <li>• Inappropriate content in community areas or hosted websites</li>
                <li>• Adult content, hate speech, or offensive material</li>
                <li>• Sharing copyrighted material without permission</li>
                <li>• Attempting to breach security or access unauthorized areas</li>
                <li>• Excessive resource usage that affects other users</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                Violation of these policies may result in content removal, account suspension, or termination. 
                We reserve the right to review and moderate content posted on our platform.
              </p>
            </div>
          </section>

          {/* 7. Privacy & Data */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Shield className="w-6 h-6 text-blue-600" />
              7. Privacy & Data Protection
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                We take your privacy seriously and are committed to protecting your personal information. 
                Our data practices include:
              </p>
              <ul className="text-gray-700 space-y-2 mb-4">
                <li>• Collecting only necessary academic and account information</li>
                <li>• Secure storage and transmission of your data</li>
                <li>• No sharing of personal information with third parties without consent</li>
                <li>• Right to export or delete your data upon request</li>
                <li>• Compliance with applicable data protection regulations</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                For detailed information about our data practices, please review our Privacy Policy.
              </p>
            </div>
          </section>

          {/* 8. Service Availability */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Calendar className="w-6 h-6 text-blue-600" />
              8. Service Availability
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                While we strive to maintain 99.9% uptime, we cannot guarantee uninterrupted service. 
                We reserve the right to:
              </p>
              <ul className="text-gray-700 space-y-2 mb-4">
                <li>• Perform scheduled maintenance with advance notice</li>
                <li>• Temporarily suspend services for security or technical reasons</li>
                <li>• Modify or discontinue features with reasonable notice</li>
                <li>• Implement usage limits to ensure fair access for all users</li>
              </ul>
            </div>
          </section>

          {/* 9. Intellectual Property */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-blue-600" />
              9. Intellectual Property
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                The Ufazien platform, including its design, features, and content, is owned by us and protected by intellectual property laws. 
                You retain ownership of content you create, but grant us a license to host and display it as necessary for service operation.
              </p>
              <p className="text-gray-700 leading-relaxed">
                You are responsible for ensuring you have the right to upload and share any content on our platform.
              </p>
            </div>
          </section>

          {/* 10. Limitation of Liability */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Shield className="w-6 h-6 text-blue-600" />
              10. Limitation of Liability
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                Ufazien is provided "as is" without warranties of any kind. We are not liable for:
              </p>
              <ul className="text-gray-700 space-y-2 mb-4">
                <li>• Academic decisions made based on our tools</li>
                <li>• Data loss or service interruptions</li>
                <li>• Third-party content or actions of other users</li>
                <li>• Indirect, incidental, or consequential damages</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                Our maximum liability is limited to the amount you have paid for paid services in the past 12 months.
              </p>
            </div>
          </section>

          {/* 11. Termination */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-600" />
              11. Account Termination
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                Either party may terminate this agreement at any time. We may suspend or terminate your account for:
              </p>
              <ul className="text-gray-700 space-y-2 mb-4">
                <li>• Violation of these Terms of Service</li>
                <li>• Misuse of our services or resources</li>
                <li>• Posting inappropriate content on hosted websites or community areas</li>
                <li>• Extended inactivity (12+ months)</li>
                <li>• Failure to pay for subscribed services</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                Upon termination, you may export your data within 30 days, after which it may be permanently deleted.
              </p>
            </div>
          </section>

          {/* 12. Changes to Terms */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-blue-600" />
              12. Changes to These Terms
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                We may update these Terms from time to time to reflect changes in our services or legal requirements. 
                We will notify users of material changes through:
              </p>
              <ul className="text-gray-700 space-y-2 mb-4">
                <li>• Email notification to your registered address</li>
                <li>• Platform announcements</li>
                <li>• Updates to this page with revision date</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                Continued use of our services after changes constitute acceptance of the new Terms.
              </p>
            </div>
          </section>

          {/* Contact Information */}
          <section className="bg-blue-50 rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Questions or Concerns?</h2>
            <p className="text-gray-700 mb-4">
              If you have questions about these Terms of Service or need support, please contact us:
            </p>
            <div className="space-y-2 text-gray-700">
              <p><strong>Email:</strong> support@ufazien.com</p>
              <p><strong>Platform:</strong> Through our in-platform support system</p>
              <p><strong>Response Time:</strong> We aim to respond within 24-48 hours</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}