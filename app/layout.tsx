import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "مِرسم JSON — تحويل الأسئلة من PDF",
  description: "واجهة عربية لتحويل ملفات الأسئلة والرسومات من PDF إلى JSON منظم.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
