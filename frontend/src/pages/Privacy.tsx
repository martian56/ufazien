import { useEffect } from 'react'
import { Shield, Eye, Lock, Database, Users, Globe, Bell, Trash2, Download, Settings } from 'lucide-react'

export default function Privacy() {
  useEffect(() => {
    document.title = 'Privacy Policy - Ufazien'
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-gray-700" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
            </div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Your privacy is important to us. This policy explains how we collect, use, and protect your information on Ufazien.
            </p>
            <div className="mt-4 text-sm text-gray-500">
              Last updated: September 7, 2025
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg border border-gray-200 p-8 md:p-12">
          
          {/* 1. Information We Collect */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Database className="w-6 h-6 text-blue-600" />
              1. Information We Collect
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Account Information
                </h3>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>• Name and email address</li>
                  <li>• Username and password (encrypted)</li>
                  <li>• Profile information (optional)</li>
                  <li>• Academic year and major (optional)</li>
                </ul>
              </div>

              <div className="bg-green-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-green-600" />
                  Usage Information
                </h3>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>• Pages visited and features used</li>
                  <li>• Time spent on platform</li>
                  <li>• Device and browser information</li>
                  <li>• IP address and location (general)</li>
                </ul>
              </div>

              <div className="bg-purple-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-600" />
                  Academic Data
                </h3>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>• GPA calculations and course grades</li>
                  <li>• Average calculation schemas</li>
                  <li>• Academic calendar events</li>
                  <li>• Study group participation</li>
                </ul>
              </div>

              <div className="bg-orange-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-orange-600" />
                  Content & Communications
                </h3>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>• Blog posts and comments</li>
                  <li>• Chat messages and forum posts</li>
                  <li>• Files uploaded to hosting service</li>
                  <li>• Website content and analytics</li>
                </ul>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Cookies and Similar Technologies</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                We use essential cookies for authentication and platform functionality. We also use analytics cookies 
                to understand how students use our platform and improve the experience. You can control cookie preferences 
                in your browser settings.
              </p>
            </div>
          </section>

          {/* 2. How We Use Your Information */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Settings className="w-6 h-6 text-blue-600" />
              2. How We Use Your Information
            </h2>
            
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-6">
                We use your information to provide and improve our educational platform services:
              </p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Core Platform Services</h3>
                  <ul className="text-gray-700 space-y-2 text-sm">
                    <li>• Provide GPA and average calculation tools</li>
                    <li>• Enable study group and chat features</li>
                    <li>• Host your websites and blogs</li>
                    <li>• Deliver AI-powered writing tools</li>
                    <li>• Maintain academic calendar functionality</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Platform Improvement</h3>
                  <ul className="text-gray-700 space-y-2 text-sm">
                    <li>• Analyze usage patterns to improve features</li>
                    <li>• Monitor performance and fix issues</li>
                    <li>• Develop new tools based on student needs</li>
                    <li>• Ensure platform security and prevent abuse</li>
                    <li>• Provide customer support and assistance</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Information Sharing */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Lock className="w-6 h-6 text-blue-600" />
              3. How We Share Your Information
            </h2>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3 text-green-800">Our Commitment</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                <strong>We do not sell, rent, or trade your personal information to third parties.</strong> Your academic data, 
                personal information, and usage patterns remain private and are only used to provide you with better services.
              </p>
            </div>

            <div className="prose prose-gray max-w-none">
              <h3 className="font-semibold text-gray-900 mb-4">Limited Sharing Scenarios</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                We may share information only in these specific circumstances:
              </p>
              
              <ul className="text-gray-700 space-y-3 mb-6">
                <li><strong>Public Content:</strong> Blog posts, forum comments, and study group discussions you choose to make public</li>
                <li><strong>Service Providers:</strong> Trusted third-party services (like AWS) that help us operate the platform under strict privacy agreements</li>
                <li><strong>Legal Requirements:</strong> When required by law, court order, or to protect user safety and platform security</li>
                <li><strong>With Your Consent:</strong> Any other sharing will only occur with your explicit permission</li>
              </ul>

              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-gray-700 text-sm">
                  <strong>Note:</strong> If you participate in public study groups or forums, your messages and profile information 
                  may be visible to other students in those spaces.
                </p>
              </div>
            </div>
          </section>

          {/* 4. Data Security */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Shield className="w-6 h-6 text-blue-600" />
              4. Data Security
            </h2>
            
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-6">
                We implement multiple layers of security to protect your information:
              </p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-indigo-50 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Technical Security</h3>
                  <ul className="text-gray-700 space-y-2 text-sm">
                    <li>• SSL/TLS encryption for all data transmission</li>
                    <li>• Encrypted password storage</li>
                    <li>• Secure AWS cloud infrastructure</li>
                    <li>• Regular security updates and monitoring</li>
                    <li>• Protected database access</li>
                  </ul>
                </div>
                
                <div className="bg-cyan-50 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Operational Security</h3>
                  <ul className="text-gray-700 space-y-2 text-sm">
                    <li>• Limited employee access to personal data</li>
                    <li>• Regular security audits and assessments</li>
                    <li>• Incident response procedures</li>
                    <li>• Backup and disaster recovery systems</li>
                    <li>• Privacy-by-design development practices</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
                <p className="text-gray-700 text-sm">
                  <strong>Your Role:</strong> Keep your account secure by using a strong password, not sharing your login credentials, 
                  and logging out from shared devices.
                </p>
              </div>
            </div>
          </section>

          {/* 5. Your Privacy Rights */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-600" />
              5. Your Privacy Rights
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-green-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-green-600" />
                  Access & Control
                </h3>
                <ul className="text-gray-700 space-y-2 text-sm">
                  <li>• View and edit your profile information</li>
                  <li>• Access your academic data and calculations</li>
                  <li>• Control your privacy settings</li>
                  <li>• Manage notification preferences</li>
                </ul>
              </div>

              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Download className="w-5 h-5 text-blue-600" />
                  Data Portability
                </h3>
                <ul className="text-gray-700 space-y-2 text-sm">
                  <li>• Export your academic data and calculations</li>
                  <li>• Download your blog posts and content</li>
                  <li>• Request a copy of your personal information</li>
                  <li>• Transfer data to other platforms</li>
                </ul>
              </div>

              <div className="bg-red-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-red-600" />
                  Deletion Rights
                </h3>
                <ul className="text-gray-700 space-y-2 text-sm">
                  <li>• Delete specific academic records</li>
                  <li>• Remove blog posts and comments</li>
                  <li>• Close your account completely</li>
                  <li>• Request data deletion (with some limitations)</li>
                </ul>
              </div>

              <div className="bg-purple-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-purple-600" />
                  Communication Preferences
                </h3>
                <ul className="text-gray-700 space-y-2 text-sm">
                  <li>• Opt out of promotional emails</li>
                  <li>• Control push notifications</li>
                  <li>• Manage study group notifications</li>
                  <li>• Choose what updates you receive</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6 mt-6">
              <h3 className="font-semibold text-gray-900 mb-3">How to Exercise Your Rights</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                Most privacy controls are available directly in your account settings. For additional requests, 
                contact our support team at <strong>privacy@ufazien.com</strong>. We'll respond to valid requests 
                within 30 days and may need to verify your identity for security purposes.
              </p>
            </div>
          </section>

          {/* 6. Data Retention */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Database className="w-6 h-6 text-blue-600" />
              6. Data Retention
            </h2>
            
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-6">
                We retain your information for as long as necessary to provide our services and fulfill the purposes outlined in this policy:
              </p>
              
              <div className="space-y-4">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold text-gray-900">Account Information</h4>
                  <p className="text-gray-700 text-sm">Retained while your account is active, plus 30 days after deletion for recovery purposes</p>
                </div>
                
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-semibold text-gray-900">Academic Data</h4>
                  <p className="text-gray-700 text-sm">Kept while useful for your studies, automatically deleted after 3 years of inactivity</p>
                </div>
                
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-semibold text-gray-900">Content & Communications</h4>
                  <p className="text-gray-700 text-sm">Blog posts and public content may remain published unless you delete them</p>
                </div>
                
                <div className="border-l-4 border-orange-500 pl-4">
                  <h4 className="font-semibold text-gray-900">Usage Analytics</h4>
                  <p className="text-gray-700 text-sm">Anonymized usage data may be retained for platform improvement purposes</p>
                </div>
              </div>
            </div>
          </section>

          {/* 7. Third-Party Services */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Globe className="w-6 h-6 text-blue-600" />
              7. Third-Party Services
            </h2>
            
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-6">
                Ufazien uses trusted third-party services to provide our platform functionality:
              </p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Infrastructure Providers</h3>
                  <ul className="text-gray-700 space-y-2 text-sm">
                    <li>• <strong>Amazon Web Services (AWS):</strong> Cloud hosting and storage</li>
                    <li>• <strong>CloudFlare:</strong> Content delivery and security</li>
                    <li>• <strong>SendGrid:</strong> Email delivery services</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Analytics & Monitoring</h3>
                  <ul className="text-gray-700 space-y-2 text-sm">
                    <li>• <strong>Google Analytics:</strong> Website usage analytics</li>
                    <li>• <strong>Sentry:</strong> Error tracking and monitoring</li>
                    <li>• <strong>Internal Tools:</strong> Custom analytics for platform improvement</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4 mt-6">
                <p className="text-gray-700 text-sm">
                  All third-party providers are carefully selected and must meet our privacy and security standards. 
                  They're contractually bound to protect your information and use it only for providing services to Ufazien.
                </p>
              </div>
            </div>
          </section>

          {/* 8. International Users */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Globe className="w-6 h-6 text-blue-600" />
              8. International Users
            </h2>
            
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                Ufazien is operated from Azerbaijan and uses global cloud infrastructure. If you're accessing our platform 
                from outside Azerbaijan, please note:
              </p>
              
              <ul className="text-gray-700 space-y-2 mb-6">
                <li>• Your data may be transferred to and processed in other countries</li>
                <li>• We use appropriate safeguards to protect your information during international transfers</li>
                <li>• Our privacy practices comply with applicable international privacy laws</li>
                <li>• You have the same privacy rights regardless of your location</li>
              </ul>
              
              <div className="bg-indigo-50 rounded-lg p-4">
                <p className="text-gray-700 text-sm">
                  If you have specific privacy requirements under your local laws (such as GDPR), please contact us at 
                  <strong> privacy@ufazien.com</strong> for assistance.
                </p>
              </div>
            </div>
          </section>

          {/* 9. Changes to Privacy Policy */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Bell className="w-6 h-6 text-blue-600" />
              9. Changes to This Privacy Policy
            </h2>
            
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. 
                When we make changes, we will:
              </p>
              
              <ul className="text-gray-700 space-y-2 mb-6">
                <li>• Update the "Last updated" date at the top of this policy</li>
                <li>• Notify you via email for significant changes</li>
                <li>• Post announcements on our platform for major updates</li>
                <li>• Give you time to review changes before they take effect</li>
              </ul>
              
              <p className="text-gray-700 leading-relaxed">
                Your continued use of Ufazien after changes take effect constitutes acceptance of the updated Privacy Policy. 
                If you don't agree with changes, you can close your account or contact us with concerns.
              </p>
            </div>
          </section>

          {/* Contact Information */}
          <section className="bg-blue-50 rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Privacy Questions or Concerns?</h2>
            <p className="text-gray-700 mb-4">
              We're committed to protecting your privacy and are happy to answer any questions about this policy or our practices.
            </p>
            <div className="space-y-2 text-gray-700">
              <p><strong>Privacy Team:</strong> privacy@ufazien.com</p>
              <p><strong>General Support:</strong> support@ufazien.com</p>
              <p><strong>Response Time:</strong> We respond to privacy inquiries within 48 hours</p>
              <p><strong>Mailing Address:</strong> Available upon request for formal inquiries</p>
            </div>
            
            <div className="mt-6 p-4 bg-white rounded-lg border border-blue-200">
              <h3 className="font-semibold text-gray-900 mb-2">Quick Privacy Controls</h3>
              <p className="text-gray-700 text-sm">
                Visit your account settings to manage privacy preferences, export your data, or delete your account. 
                Most privacy controls are available immediately without needing to contact support.
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}