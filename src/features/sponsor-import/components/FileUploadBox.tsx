"use client";

import { useRef, useState } from "react";

import { Button } from "@/src/components/common";

const ACCEPT =
  ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type FileUploadBoxProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
};

export function FileUploadBox({ file, onFileChange, disabled = false }: FileUploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function pickFile(next: File | null) {
    if (disabled) return;
    onFileChange(next);
  }

  function clearFile(e: React.MouseEvent) {
    e.stopPropagation();
    pickFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    pickFile(e.target.files?.[0] ?? null);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files[0];
    if (dropped) pickFile(dropped);
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-slate-700">Spreadsheet file</span>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={[
          "rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragOver ? "border-brand-primary bg-brand-primary-muted" : "border-slate-300 bg-slate-50",
          file ? "border-emerald-400 bg-emerald-50/50" : "",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        ].join(" ")}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={file ? "Replace spreadsheet file" : "Upload spreadsheet file"}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={disabled}
          onChange={handleInputChange}
        />

        {file ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-emerald-900">File selected</p>
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm text-slate-900">{file.name}</p>
              <button
                type="button"
                disabled={disabled}
                onClick={clearFile}
                className={[
                  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition",
                  disabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:bg-emerald-100 hover:text-slate-800",
                ].join(" ")}
                aria-label={`Remove ${file.name}`}
              >
                ×
              </button>
            </div>
            <p className="text-xs text-slate-600">
              {file.type || "Unknown type"} · {formatFileSize(file.size)}
            </p>
            <p className="text-xs text-slate-500">Click or drop to replace</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">
              Drag and drop your file here
            </p>
            <p className="text-xs text-slate-500">or use the button below</p>
            <p className="text-xs text-slate-500">.xlsx, .xls, or .csv · max 500 rows</p>
          </div>
        )}
      </div>

      {!file ? (
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Choose file
        </Button>
      ) : null}
    </div>
  );
}
