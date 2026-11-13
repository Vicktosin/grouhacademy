import { NextResponse } from "next/server";
import { getCertificateBranding } from "@/lib/certificate-branding";

// Public: the issuer name and logo printed on every certificate (nothing
// that isn't already on a certificate). Read by components/certificate.
export async function GET() {
  try {
    return NextResponse.json(await getCertificateBranding(), {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (error) {
    console.error("Failed to load certificate branding:", error);
    return NextResponse.json({ error: "Unable to load branding." }, { status: 500 });
  }
}
