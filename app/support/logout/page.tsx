import LogoutConfirmation from "@/components/LogoutConfirmation";

export const metadata = {
  title: "Log Out | Support Admin",
};

export default function SupportAdminLogoutPage() {
  return (
    <LogoutConfirmation
      title="Leave your Support Admin workspace?"
      description="You will need to sign in again with your email and password to manage resources, banners, groups and follow-ups."
      cancelHref="/support"
    />
  );
}
