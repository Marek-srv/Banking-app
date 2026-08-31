import { apiClient } from "@/lib/apiClient";

export type StatementFormat = "pdf" | "csv";

type DownloadedDocument = { blob: Blob; fileName: string };

function fileNameFromHeader(header: unknown, fallback: string) {
  if (typeof header !== "string") return fallback;
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return header.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;
}

export function saveDownloadedDocument(document: DownloadedDocument) {
  const url = URL.createObjectURL(document.blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = document.fileName;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const documentApi = {
  async downloadStatement(input: { accountId: string; from: string; to: string; format: StatementFormat }) {
    const response = await apiClient.get<Blob>(`/accounts/${input.accountId}/statement`, {
      params: { from: input.from, to: input.to, format: input.format },
      responseType: "blob",
    });
    const fallback = `pi-bank-statement-${input.from}-${input.to}.${input.format}`;
    return { blob: response.data, fileName: fileNameFromHeader(response.headers["content-disposition"], fallback) };
  },

  async downloadReceipt(transactionId: string, referenceNumber: string) {
    const response = await apiClient.get<Blob>(`/transactions/${transactionId}/receipt`, { responseType: "blob" });
    const safeReference = referenceNumber.replace(/[^A-Za-z0-9_-]/g, "-") || "transaction";
    return { blob: response.data, fileName: fileNameFromHeader(response.headers["content-disposition"], `pi-bank-transaction-${safeReference}.pdf`) };
  },
};
