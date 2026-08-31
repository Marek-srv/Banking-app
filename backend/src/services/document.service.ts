import PDFDocument from "pdfkit";

export type GeneratedDocument = {
  buffer: Buffer;
  contentType: "application/pdf" | "text/csv; charset=utf-8";
  fileName: string;
};

export function createPdf(render: (document: PDFKit.PDFDocument) => void) {
  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 42, info: { Creator: "Pi Bank" } });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    render(document);
    document.end();
  });
}

export function drawBankHeader(document: PDFKit.PDFDocument, subtitle: string) {
  const startX = document.x;
  const startY = document.y;
  document.font("Symbol").fontSize(24).fillColor("#0B63E5").text("p", startX, startY, { continued: true });
  document.font("Helvetica-Bold").fontSize(19).fillColor("#0B1F3A").text(" Bank");
  document.moveDown(0.25).font("Helvetica").fontSize(10).fillColor("#667085").text(subtitle);
  document.moveDown(0.8).strokeColor("#0B63E5").lineWidth(1.5).moveTo(42, document.y).lineTo(553, document.y).stroke();
  document.moveDown(0.8);
}

export function safeFilePart(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "document";
}

export function formatDocumentDate(value: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(value);
}

export function formatDocumentDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "UTC" }).format(value);
}

export function formatDocumentAmount(value: string | number) {
  return `INR ${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
