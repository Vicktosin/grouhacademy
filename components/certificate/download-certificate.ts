import { CERT_HEIGHT, CERT_WIDTH } from "./Certificate";

// Letter landscape in PDF points (72 per inch), the same 11in x 8.5in the
// certificate is laid out at, so the page is exactly the certificate.
const PAGE_WIDTH_PT = 792;
const PAGE_HEIGHT_PT = 612;

/**
 * Saves a rendered certificate as a one-page PDF that matches it exactly:
 * the browser's own rendering is captured at print resolution (288dpi) and
 * placed edge to edge on a page of the same size. No print dialog, no
 * margins, no cropping, identical on phones and desktops.
 */
export async function downloadCertificatePdf(
  face: HTMLElement,
  fileName: string,
) {
  const [{ domToJpeg }, { PDFDocument }] = await Promise.all([
    import("modern-screenshot"),
    import("pdf-lib"),
  ]);
  await document.fonts.ready;

  const image = await domToJpeg(face, {
    width: CERT_WIDTH,
    height: CERT_HEIGHT,
    scale: 3,
    quality: 0.95,
    backgroundColor: "#ffffff",
    // Capture the certificate itself, not the on-screen scaling around it.
    style: { transform: "none", margin: "0" },
  });

  const pdf = await PDFDocument.create();
  pdf.setTitle(fileName.replace(/\.pdf$/i, ""));
  pdf.setCreator("Grouh Academy");
  const jpg = await pdf.embedJpg(image);
  const page = pdf.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
  page.drawImage(jpg, {
    x: 0,
    y: 0,
    width: PAGE_WIDTH_PT,
    height: PAGE_HEIGHT_PT,
  });
  const bytes = await pdf.save();

  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: "application/pdf" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "Ada Obi - Social Media Marketing Certificate.pdf", safe for file systems. */
export function certificateFileName(name: string, achievement: string) {
  return `${name} - ${achievement} Certificate`
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .concat(".pdf");
}
