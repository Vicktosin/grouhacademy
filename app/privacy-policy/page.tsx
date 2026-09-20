import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | Grouh Academy',
  description: 'Learn how Grouh Academy collects, uses, and protects your personal information.',
}

const sections = [
  {
    title: 'Information we collect',
    content: 'We collect information you provide when you create an account, enrol in a course or internship, contact us, or make a payment. This may include your name, email address, phone number, profile information, learning activity, assessment responses, internship application details, and payment references. We also collect limited technical information such as your device, browser, IP address, and how you use our platform.',
  },
  {
    title: 'How we use your information',
    content: 'We use your information to provide and improve learning, assessment, internship, mentoring, and support services; process and verify payments; communicate important account and programme updates; keep the platform secure; comply with legal obligations; and understand how our services are used.',
  },
  {
    title: 'Payments',
    content: 'Payments are processed by trusted payment providers. Grouh Academy does not store your full card or bank details. We retain payment references, amounts, status, and related records needed to confirm your purchase, provide support, prevent fraud, and meet accounting obligations.',
  },
  {
    title: 'When we share information',
    content: 'We share information only when needed to operate our services—for example, with payment processors, cloud and communications providers, mentors assigned to your internship, and service providers acting on our instructions. We may also disclose information where required by law or to protect the safety, rights, and security of Grouh Academy, our learners, or others. We do not sell your personal information.',
  },
  {
    title: 'Your choices and rights',
    content: 'You can review and update certain account information through your profile settings. Depending on where you live, you may have rights to request access to, correction of, deletion of, or restriction of the personal information we hold about you. You may also opt out of non-essential marketing messages. Some information must be retained where needed for a legitimate business, legal, security, or payment-record purpose.',
  },
  {
    title: 'Data retention and security',
    content: 'We keep personal information only for as long as necessary for the purposes described in this policy, including programme delivery, support, security, and legal obligations. We use reasonable technical and organisational safeguards to protect your information, but no internet service can guarantee absolute security.',
  },
  {
    title: 'Children',
    content: 'Grouh Academy is not intended for children who cannot lawfully consent to data processing in their country. If you believe a child has provided us personal information without appropriate consent, please contact us so we can take appropriate action.',
  },
  {
    title: 'Changes to this policy',
    content: 'We may update this policy as our services or legal obligations change. When we do, we will post the revised version here and update the effective date below. Continued use of the platform after an update means you acknowledge the revised policy.',
  },
]

export default function PrivacyPolicyPage() {
  return (
    <main className="flex-1 bg-[#f8fbff] py-12 sm:py-16">
      <article className="mx-auto max-w-3xl px-6 lg:px-8">
        <Link href="/" className="text-sm font-semibold text-[#397d3a] hover:text-[#1C1D52]">← Back to Grouh Academy</Link>
        <header className="mt-8 rounded-3xl bg-[#1C1D52] px-7 py-10 text-white shadow-[0_16px_45px_rgba(28,29,82,0.18)] sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9be28a]">Legal</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Privacy Policy</h1>
          <p className="mt-4 text-sm leading-6 text-white/70">Effective date: September 20, 2026</p>
        </header>

        <div className="mt-8 rounded-3xl bg-white px-7 py-8 shadow-[0_8px_24px_rgba(28,29,82,0.08)] sm:px-10 sm:py-10">
          <p className="text-sm leading-7 text-slate-600">Grouh Academy respects your privacy. This policy explains what personal information we collect, why we collect it, and the choices available to you when you use our website, courses, internship programmes, and related services.</p>
          <div className="mt-9 space-y-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-lg font-bold text-[#1C1D52]">{section.title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">{section.content}</p>
              </section>
            ))}
            <section>
              <h2 className="text-lg font-bold text-[#1C1D52]">Contact us</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">For privacy questions or requests, please use our <Link href="/contact" className="font-semibold text-[#397d3a] underline underline-offset-2">contact page</Link> and include “Privacy” in your message subject.</p>
            </section>
          </div>
        </div>
      </article>
    </main>
  )
}
