"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  Award,
  Bell,
  BookOpen,
  CalendarRange,
  ClipboardCheck,
  CreditCard,
  GalleryHorizontalEnd,
  GraduationCap,
  LayoutDashboard,
  Layers,
  LogOut,
  PhoneCall,
  Settings,
  ShieldCheck,
  UserCircle2,
  UserRound,
  Users,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type { AdminContext } from "@/lib/admin-context";

const studentItems = [
  { label: "Dashboard", href: "/admin/student", icon: LayoutDashboard },
  { label: "Courses", href: "/admin/student/courses", icon: BookOpen },
  {
    label: "Categories",
    href: "/admin/student/course-categories",
    icon: BookOpen,
  },
  { label: "Students", href: "/admin/student/students", icon: Users },
  {
    label: "Enrollments",
    href: "/admin/student/enrollments",
    icon: GraduationCap,
  },
  { label: "Payments", href: "/admin/student/payments", icon: CreditCard },
  { label: "Certificates", href: "/admin/student/certificates", icon: Award },
  { label: "Instructors", href: "/admin/student/instructors", icon: Users },
  { label: "Notifications", href: "/admin/student/notifications", icon: Bell },
  { label: "Settings", href: "/admin/student/settings", icon: Settings },
  { label: "Security", href: "/auth/mfa/setup", icon: ShieldCheck },
];

const internshipItems = [
  { label: "Dashboard", href: "/admin/internship", icon: LayoutDashboard },
  { label: "Interns", href: "/admin/internship/interns", icon: Users },
  { label: "Tracks", href: "/admin/internship/tracks", icon: GraduationCap },
  { label: "Levels", href: "/admin/internship/levels", icon: Layers },
  {
    label: "Onboarding Questions",
    href: "/admin/internship/onboarding-questions",
    icon: ClipboardCheck,
  },
  { label: "Enrollees", href: "/admin/internship/enrollees", icon: UserRound },
  {
    label: "Follow-ups",
    href: "/admin/internship/follow-ups",
    icon: PhoneCall,
  },
  { label: "Cohorts", href: "/admin/internship/cohorts", icon: CalendarRange },
  { label: "Groups", href: "/admin/internship/groups", icon: UsersRound },
  {
    label: "Assessments",
    href: "/admin/internship/assessments",
    icon: GraduationCap,
  },
  { label: "Tasks", href: "/admin/internship/tasks", icon: ClipboardCheck },
  { label: "Resources", href: "/admin/internship/resources", icon: BookOpen },
  { label: "Mentors", href: "/admin/internship/mentors", icon: Users },
  { label: "Payments", href: "/admin/internship/payments", icon: WalletCards },
  {
    label: "Certificates",
    href: "/admin/internship/certificates",
    icon: Award,
  },
  {
    label: "Notifications",
    href: "/admin/internship/notifications",
    icon: Bell,
  },
  {
    label: "Dashboard Banners",
    href: "/admin/internship/banners",
    icon: GalleryHorizontalEnd,
  },
  { label: "Settings", href: "/admin/internship/settings", icon: Settings },
  { label: "Profile", href: "/admin/internship/profile", icon: UserCircle2 },
  { label: "Security", href: "/auth/mfa/setup", icon: ShieldCheck },
];

export default function AdminSidebar({
  workspace,
  admin,
  mobile = false,
}: {
  workspace: "student" | "internship";
  admin: AdminContext | null;
  mobile?: boolean;
}) {
  const pathname = usePathname() || `/admin/${workspace}`;
  const items = workspace === "student" ? studentItems : internshipItems;

  return (
    <aside
      className={`flex-col overflow-hidden rounded-[28px] bg-[#1C1D52] px-4 py-6 text-white shadow-[0_12px_40px_rgba(28,29,82,0.18)] sm:py-8 ${mobile ? "fixed inset-y-4 left-4 z-40 flex h-auto w-[calc(100vw-2rem)] max-w-64 md:hidden" : "hidden h-full w-[248px] shrink-0 md:flex"}`}
    >
      <div className="border-b border-white/10 px-2 pb-5 text-center">
        <div className="mb-3 flex justify-center">
          <Image
            src={admin?.avatarUrl ?? "/avatar-placeholder.png"}
            alt={`${admin?.name ?? "Administrator"} avatar`}
            width={78}
            height={78}
            className="h-[78px] w-[78px] rounded-full object-cover"
          />
        </div>
        <h3 className="text-sm font-semibold tracking-tight">
          {admin?.name ?? "Administrator"}
        </h3>
        <p className="mt-1 text-xs font-medium text-white/55">Administrator</p>
      </div>
      <nav
        aria-label="Admin navigation"
        className="mt-7 flex-1 overflow-y-auto px-1"
      >
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === `/admin/${workspace}`
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  // Each admin page runs a slow access check in the layout, so
                  // prefetching every sidebar link multiplied that cost per page view.
                  prefetch={false}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${active ? "bg-[#5FBB46] text-white" : "text-white/90 hover:bg-white/10"}`}
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Link
        href="/admin/logout"
        prefetch={false}
        className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white/90 hover:bg-white/10"
      >
        <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.75} />
        Log Out
      </Link>
    </aside>
  );
}
