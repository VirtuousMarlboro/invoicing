"use client";

import React, { useState, useEffect, useRef } from "react";
import { pdf } from "@react-pdf/renderer";
import { InvoicePDF } from "@/lib/pdf-template";
import type { InvoiceData } from "@/lib/invoice";

export default function PDFPreview({ data }: { data: InvoiceData }) {
  const [url, setUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevUrlRef = useRef<string>(undefined);

  useEffect(() => {
    // Debounce PDF generation to avoid excessive re-renders
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setGenerating(true);
      try {
        const blob = await pdf(<InvoicePDF data={data} />).toBlob();
        const newUrl = URL.createObjectURL(blob);
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = newUrl;
        setUrl(newUrl);
      } catch {
        // Ignore render errors during typing
      } finally {
        setGenerating(false);
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [data]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Preview PDF</h3>
        {generating && <span className="text-xs text-gray-400 animate-pulse">Memperbarui…</span>}
      </div>
      <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden bg-gray-100 min-h-[500px]">
        {url ? (
          <iframe src={url} className="w-full h-full min-h-[500px]" title="PDF Preview" />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Memuat preview…
          </div>
        )}
      </div>
    </div>
  );
}
