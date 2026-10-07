-- Admins can take an intern out of the internship (and restore them).
ALTER TYPE "InternshipApplicationStatus" ADD VALUE 'REMOVED';
