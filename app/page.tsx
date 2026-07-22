"use client";

import { ChangeEvent, DragEvent, useMemo, useState } from "react";

type Result = {
  document: { file_name: string; pages: number; language: string };
  questions: Array<{
    id: string;
    page: number;
    text: string;
    type: string;
    choices: string[];
    diagram: { format: string; source: string; objects: Array<Record<string, unknown>> };
    confidence: { text: number; diagram: number };
  }>;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState(0);
  const [status, setStatus] = useState<"idle" | "ready" | "working" | "done">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const json = useMemo(() => (result ? JSON.stringify(result, null, 2) : ""), [result]);

  async function acceptFile(candidate?: File) {
    if (!candidate || candidate.type !== "application/pdf") return;
    setFile(candidate);
    setStatus("ready");
    setResult(null);
    setError("");
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const data = new Uint8Array(await candidate.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;
      setPages(pdf.numPages);
    } catch {
      setPages(0);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void acceptFile(event.dataTransfer.files[0]);
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    void acceptFile(event.target.files?.[0]);
  }

  async function analyze() {
    if (!file) return;
    setStatus("working");
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "فشل تحليل الملف");
      setResult(data as Result);
      setStatus("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحليل الملف");
      setStatus("ready");
    }
  }

  function download() {
    if (!json) return;
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${file?.name.replace(/\.pdf$/i, "") || "questions"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <nav className="nav">
        <a className="brand" href="#">مِرسم <span>JSON</span></a>
        <div className="nav-links"><a href="#how">كيف يعمل؟</a><a href="#schema">صيغة البيانات</a><span className="badge">نسخة تجريبية</span></div>
      </nav>

      <section className="hero">
        <div className="eyebrow"><i /> استخراج ذكي للأسئلة والرسومات</div>
        <h1>حوّل ملفات الأسئلة من<br /><em>PDF إلى JSON منظم</em></h1>
        <p>استخرج نصوص الأسئلة، الخيارات، المعادلات والرسومات الهندسية في ملف بيانات واحد جاهز لتطبيقك.</p>
      </section>

      <section className="workspace" aria-label="رفع وتحليل ملف PDF">
        <div className="panel upload-panel">
          <div className="step"><b>01</b><div><strong>ارفع ملف الأسئلة</strong><small>ملف PDF واحد — حتى 50 ميجابايت</small></div></div>
          <label
            className={`dropzone ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input type="file" accept="application/pdf" onChange={onPick} />
            <div className="file-icon">PDF</div>
            {file ? <><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB {pages ? `• ${pages} صفحة` : ""}</span></> : <><strong>اسحب ملف PDF وأفلته هنا</strong><span>أو اضغط لاختيار الملف من جهازك</span></>}
          </label>
          <button className="primary" disabled={!file || status === "working"} onClick={analyze}>
            {status === "working" ? "جارٍ تحليل الصفحات..." : "ابدأ التحويل"}<span>←</span>
          </button>
          {error && <p className="error-message" role="alert">{error}</p>}
          <p className="privacy">◈ تتم قراءة الملف محلياً في هذه النسخة ولا يُرفع إلى خادم.</p>
        </div>

        <div className="panel result-panel" id="schema">
          <div className="step"><b>02</b><div><strong>راجع النتيجة</strong><small>JSON منظم وقابل للتصدير</small></div></div>
          {result ? (
            <>
              <div className="result-head"><span><i /> اكتمل التحليل</span><button onClick={() => navigator.clipboard.writeText(json)}>نسخ</button></div>
              <pre>{json}</pre>
              <button className="download" onClick={download}>تنزيل ملف JSON ↓</button>
            </>
          ) : (
            <div className="empty">
              <div className="code-art"><span>{"{"}</span><i>···</i><span>{"}"}</span></div>
              <strong>النتيجة ستظهر هنا</strong>
              <p>بعد رفع الملف وتشغيل التحويل، ستشاهد بنية الأسئلة والرسومات ودرجات الثقة.</p>
            </div>
          )}
        </div>
      </section>

      <section className="features" id="how">
        <article><b>نص ومعادلات</b><p>هيكل واضح لنص السؤال والخيارات والرموز الرياضية.</p></article>
        <article><b>رسومات محفوظة</b><p>صورة أصلية مع وصف للنقاط والخطوط والمحاور.</p></article>
        <article><b>درجة ثقة</b><p>مؤشر مستقل لدقة النص وتحليل كل رسم.</p></article>
      </section>

      <footer>مِرسم JSON <span>•</span> أساس احترافي قابل للربط بمحرك تحليل وGitHub</footer>
    </main>
  );
}
