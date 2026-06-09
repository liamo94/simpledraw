import { jsPDF } from "jspdf";

export async function exportToPdf(
  dataUrl: string,
  widthPt: number,
  heightPt: number,
  filename?: string,
): Promise<void> {
  const doc = new jsPDF({
    orientation: widthPt > heightPt ? "l" : "p",
    unit: "pt",
    format: [widthPt, heightPt],
  });

  doc.addImage(dataUrl, "PNG", 0, 0, widthPt, heightPt);

  const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  doc.save(`${filename ?? `drawtool-${ts}`}.pdf`);
}
