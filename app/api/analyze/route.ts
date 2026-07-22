const schema = {
  type: "object",
  additionalProperties: false,
  required: ["document", "questions"],
  properties: {
    document: {
      type: "object",
      additionalProperties: false,
      required: ["title", "language", "pages"],
      properties: {
        title: { type: "string" },
        language: { type: "string" },
        pages: { type: "integer" },
      },
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "page", "text", "type", "choices", "answer", "diagram", "confidence"],
        properties: {
          id: { type: "string" },
          page: { type: "integer" },
          text: { type: "string" },
          type: { type: "string", enum: ["text", "geometry", "chart", "table", "mixed"] },
          choices: { type: "array", items: { type: "string" } },
          answer: { type: ["string", "null"] },
          diagram: {
            anyOf: [
              { type: "null" },
              {
                type: "object",
                additionalProperties: false,
                required: ["kind", "description", "svg", "objects"],
                properties: {
                  kind: { type: "string", enum: ["geometry", "chart", "table", "other"] },
                  description: { type: "string" },
                  svg: { type: "string", description: "Self-contained SVG recreating the diagram." },
                  objects: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["type", "label", "coordinates", "value"],
                      properties: {
                        type: { type: "string" },
                        label: { type: "string" },
                        coordinates: { type: "array", items: { type: "number" } },
                        value: { type: ["string", "null"] },
                      },
                    },
                  },
                },
              },
            ],
          },
          confidence: {
            type: "object",
            additionalProperties: false,
            required: ["text", "diagram"],
            properties: {
              text: { type: "number", minimum: 0, maximum: 1 },
              diagram: { type: "number", minimum: 0, maximum: 1 },
            },
          },
        },
      },
    },
  },
};

export async function POST(request: Request) {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return Response.json({ error: "مفتاح OpenAI غير مضبوط." }, { status: 500 });
    const contentType = request.headers.get("content-type") ?? "";
    let filename = "document.pdf";
    let pageOffset = 0;
    const inputContent: Array<Record<string, string>> = [];

    if (contentType.includes("application/json")) {
      const body = await request.json() as { images?: string[]; filename?: string; pageOffset?: number };
      const images = body.images ?? [];
      if (!images.length || images.length > 2 || images.some((image) => !image.startsWith("data:image/jpeg;base64,"))) {
        return Response.json({ error: "دفعة الصفحات غير صالحة." }, { status: 400 });
      }
      filename = body.filename?.slice(0, 160) || filename;
      pageOffset = Math.max(0, body.pageOffset ?? 0);
      images.forEach((image) => inputContent.push({ type: "input_image", image_url: image }));
    } else {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File) || file.type !== "application/pdf") {
        return Response.json({ error: "يجب اختيار ملف PDF صالح." }, { status: 400 });
      }
      if (file.size > 7 * 1024 * 1024) {
        return Response.json({ error: "استخدم وضع تقسيم الصفحات للملفات الكبيرة." }, { status: 413 });
      }
      filename = file.name;
      const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      inputContent.push({ type: "input_file", filename: file.name, file_data: `data:application/pdf;base64,${base64}` });
    }

    inputContent.push({
      type: "input_text",
      text: `حلّل الأسئلة في الملف ${filename}. أرقام الصفحات في هذه الدفعة تبدأ من ${pageOffset + 1}. استخرج كل سؤال وخياراته ورقمه وصفحته الأصلية. أعد إنشاء أي رسم هندسي أو رسم بياني كـSVG نظيف ودقيق، واكتب عناصره وإحداثياته. لا تخمّن الإجابة؛ استخدم null إذا لم تكن مذكورة صراحة. حافظ على النص العربي والرموز الرياضية كما تظهر.`,
    });
    const openai = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.6-sol",
        reasoning: { effort: "medium" },
        input: [{
          role: "user",
          content: inputContent,
        }],
        text: { format: { type: "json_schema", name: "question_document", strict: true, schema } },
      }),
    });

    const payload = await openai.json() as Record<string, unknown>;
    if (!openai.ok) {
      const apiError = payload.error as { message?: string } | undefined;
      return Response.json({ error: apiError?.message ?? "فشل تحليل الملف." }, { status: openai.status });
    }

    const output = payload.output as Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> | undefined;
    const text = output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!text) return Response.json({ error: "لم يرجع المحرك نتيجة قابلة للقراءة." }, { status: 502 });
    return Response.json(JSON.parse(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع.";
    return Response.json({ error: message }, { status: 500 });
  }
}
