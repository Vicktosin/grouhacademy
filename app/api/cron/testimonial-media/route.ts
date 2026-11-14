import { NextResponse } from "next/server";
import { testimonialMediaInUse } from "@/lib/testimonials";
import { sweepUnusedTestimonialMedia } from "@/lib/testimonial-media";

// Every 12 hours (vercel.json: twice a day, since the Hobby plan allows each
// cron job only once a day): frees Supabase Storage by deleting flyers and
// voice notes that no testimonial points to any more, such as the flyer
// from before an intern changed their photo. Each intern's current flyer and
// voice note are kept, so admins can still download them.

export const maxDuration = 300;

export async function GET(request: Request) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const result = await sweepUnusedTestimonialMedia(await testimonialMediaInUse());
    return NextResponse.json(result);
  } catch (error) {
    console.error("Testimonial media cleanup failed:", error);
    return NextResponse.json({ error: "Cleanup failed." }, { status: 500 });
  }
}
