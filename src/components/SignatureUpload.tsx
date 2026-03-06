"use client";

import React, { useRef } from "react";

const MAX_SIZE = 500_000; // ~500 KB base64

export default function SignatureUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (dataUri: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Hanya file gambar yang diperbolehkan.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result.length > MAX_SIZE) {
        alert("Ukuran gambar terlalu besar. Gunakan gambar di bawah 500 KB.");
        return;
      }
      onChange(result);
    };
    reader.readAsDataURL(file);
    // Reset input so re-uploading the same file still triggers onChange
    e.target.value = "";
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-600">Tanda Tangan</label>
        {value && (
          <button type="button" onClick={() => onChange("")} className="text-xs text-red-500 hover:underline cursor-pointer">
            Hapus
          </button>
        )}
      </div>

      {value ? (
        <div className="relative group inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Tanda tangan"
            className="max-w-[320px] max-h-[120px] object-contain rounded-lg border border-gray-200 bg-white p-2"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            Ganti
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors cursor-pointer text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Upload tanda tangan
        </button>
      )}

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <p className="text-xs text-gray-400">Upload gambar tanda tangan (PNG/JPG, maks 500 KB)</p>
    </div>
  );
}
