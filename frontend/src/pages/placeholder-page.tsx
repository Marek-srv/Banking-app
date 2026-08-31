import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { BrandMark } from "@/components/brand-mark";

export function PlaceholderPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bank-page px-6">
      <div className="text-center">
        <BrandMark className="mb-8" />
        <p className="text-lg font-semibold text-bank-navy">This service is coming in a future phase.</p>
        <Link className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-bank-blue hover:underline" to="/login">
          <ArrowLeft size={16} /> Back to login
        </Link>
      </div>
    </main>
  );
}
