-- Graduation flyer and the three ways to share an experience (video link,
-- voice note, writing). Media are Storage URLs only.
ALTER TABLE "InternTestimonial" ADD COLUMN "voiceNoteUrl" TEXT;
ALTER TABLE "InternTestimonial" ADD COLUMN "flyerUrl" TEXT;
ALTER TABLE "InternTestimonial" ALTER COLUMN "testimonial" SET DEFAULT '';
ALTER TABLE "InternTestimonial" ALTER COLUMN "rating" DROP NOT NULL;
