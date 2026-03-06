"use client";

import React, { useRef } from "react";

const MAX_SIZE = 500_000; // ~500 KB base64

export default function LogoUpload({
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
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-600 mb-1">Logo</label>
      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Logo" className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-white p-1" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              &times;
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        {value && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-xs text-blue-600 hover:underline cursor-pointer"
          >
            Ganti
          </button>
        )}
      </div>
    </div>
  );
}
