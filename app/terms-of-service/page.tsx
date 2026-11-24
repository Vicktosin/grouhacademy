import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | SabiRole",
  description: "The terms governing your use of SabiRole.",
};

const sections = [
  {
    title: "Using SabiRole",
    content:
      "You may use SabiRole only in compliance with these terms and applicable law. You are responsible for the accuracy of information you submit, maintaining the confidentiality of your account credentials, and all activity that occurs through your account. Please notify us promptly if you believe your account has been accessed without permission.",
  },
  {
    title: "Courses, assessments, and internships",
    content:
      "Programme availability, entry requirements, assessment outcomes, mentors, cohorts, schedules, and learning materials may change. An optional assessment provides a skills snapshot. Access to an internship is granted after successful payment verification; this does not guarantee employment, a placement, certification, or a particular outcome.",
  },
  {
    title: "Fees and payments",
    content:
      "Where a programme has a fee, the applicable amount and currency will be shown before payment. By submitting payment, you authorise our payment provider to process the transaction. Access is granted after successful payment verification. Refunds, if available, are handled according to the terms shown for the relevant programme or as required by law.",
  },
  {
    title: "Acceptable use",
    content:
      "Do not misuse the platform. This includes attempting to gain unauthorised access, sharing accounts, interfering with the service, submitting fraudulent information, copying or distributing protected materials without permission, harassing others, or using automated means to access the platform except where we have expressly allowed it.",
  },
  {
    title: "Your content and our materials",
    content:
      "You retain ownership of work you submit, but grant SabiRole a limited licence to host, review, and use it as needed to provide the service, assess your work, and operate the programme. Platform content, course materials, branding, software, and other materials provided by SabiRole are protected by intellectual-property laws and are for your personal, non-commercial use unless we agree otherwise in writing.",
  },
  {
    title: "Suspension or termination",
    content:
      "We may suspend or end access to the platform where reasonably necessary to protect users, investigate misuse, comply with law, or enforce these terms. You may stop using the service at any time. Terms that by their nature should survive termination, including those about intellectual property, disclaimers, and limitations of liability, will continue to apply.",
  },
  {
    title: "Disclaimers and liability",
    content:
      "The platform is provided on an “as is” and “as available” basis to the extent permitted by law. We work to keep it reliable and useful, but do not guarantee uninterrupted, error-free, or fully secure service, or any specific learning, career, or employment result. To the extent permitted by law, SabiRole is not liable for indirect, incidental, special, consequential, or punitive damages arising from your use of the service.",
  },
  {
    title: "Changes to these terms",
    content:
      "We may revise these terms to reflect changes to our services, business, or legal obligations. We will post the updated terms here and update the effective date. If you continue to use SabiRole after changes take effect, you agree to the updated terms.",
  },
];

export default function TermsOfServicePage() {
  return (
    <main className="flex-1 bg-[#f8fbff] py-12 sm:py-16">
      <article className="mx-auto max-w-3xl px-6 lg:px-8">
        <Link
          href="/"
          className="text-sm font-semibold text-[#397d3a] hover:text-[#1C1D52]"
        >
          ← Back to SabiRole
        </Link>
        <header className="mt-8 rounded-3xl bg-[#1C1D52] px-7 py-10 text-white shadow-[0_16px_45px_rgba(28,29,82,0.18)] sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9be28a]">
            Legal
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-4 text-sm leading-6 text-white/70">
            Effective date: September 20, 2026
          </p>
        </header>

        <div className="mt-8 rounded-3xl bg-white px-7 py-8 shadow-[0_8px_24px_rgba(28,29,82,0.08)] sm:px-10 sm:py-10">
          <p className="text-sm leading-7 text-slate-600">
            These Terms of Service govern your access to and use of Grouh
            Academy. By creating an account or using our services, you agree to
            these terms and our{" "}
            <Link
              href="/privacy-policy"
              className="font-semibold text-[#397d3a] underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            .
          </p>
          <div className="mt-9 space-y-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-lg font-bold text-[#1C1D52]">
                  {section.title}
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {section.content}
                </p>
              </section>
            ))}
            <section>
              <h2 className="text-lg font-bold text-[#1C1D52]">Contact us</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Questions about these terms can be sent through our{" "}
                <Link
                  href="/contact"
                  className="font-semibold text-[#397d3a] underline underline-offset-2"
                >
                  contact page
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </article>
    </main>
  );
}
